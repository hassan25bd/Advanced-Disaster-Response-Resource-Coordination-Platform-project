import { NextResponse } from "next/server";
import { requireRole } from "@/lib/api-auth";
import prisma from "@/lib/prisma";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const user = await requireRole("SYSTEM_ADMIN", "EMERGENCY_COORDINATOR", "RELIEF_ORGANIZATION");
    const allocation = await prisma.resourceAllocation.findUnique({
      where: { id },
      include: {
        request: { include: { incident: { select: { id: true, title: true, location: true } } } },
        resource: true,
        organization: { select: { id: true, name: true } },
        coordinator: { select: { id: true, name: true, email: true } },
      },
    });
    if (!allocation) return NextResponse.json({ error: "Allocation not found" }, { status: 404 });
    if (user.role === "RELIEF_ORGANIZATION" && allocation.organizationId !== user.organizationId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (user.role === "EMERGENCY_COORDINATOR" && (!user.organizationId || allocation.organizationId !== user.organizationId)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const history = await prisma.activityLog.findMany({
      where: { entityType: "ResourceAllocation", entityId: id },
      orderBy: { timestamp: "desc" },
      include: { user: { select: { name: true } } },
    });
    return NextResponse.json({ ...allocation, history });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Unauthorized" }, { status: err.status || 401 });
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const user = await requireRole("SYSTEM_ADMIN", "EMERGENCY_COORDINATOR", "RELIEF_ORGANIZATION");
    const allocation = await prisma.resourceAllocation.findUnique({
      where: { id },
      include: { resource: true, request: true },
    });
    if (!allocation) return NextResponse.json({ error: "Allocation not found" }, { status: 404 });

    if (user.role !== "SYSTEM_ADMIN" && allocation.organizationId !== user.organizationId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const { status } = body || {};
    if (!["ASSIGNED", "IN_TRANSIT", "DELIVERED", "CANCELLED"].includes(status)) {
      return NextResponse.json({ error: "Invalid allocation status" }, { status: 400 });
    }
    if (status === allocation.status) return NextResponse.json(allocation);
    if (user.role === "RELIEF_ORGANIZATION" && !["IN_TRANSIT", "DELIVERED"].includes(status)) {
      return NextResponse.json({ error: "Organizations may only mark allocations in transit or delivered" }, { status: 403 });
    }
    if (["DELIVERED", "CANCELLED"].includes(allocation.status) && status !== allocation.status) {
      return NextResponse.json({ error: "Completed or cancelled allocations cannot be reopened" }, { status: 409 });
    }
    if (status === "ASSIGNED" && allocation.status !== "ASSIGNED") {
      return NextResponse.json({ error: "An allocation cannot move back to assigned" }, { status: 409 });
    }
    if (allocation.status === "ASSIGNED" && status === "DELIVERED") {
      return NextResponse.json({ error: "An allocation must be in transit before it can be delivered" }, { status: 409 });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const changed = await tx.resourceAllocation.updateMany({
        where: { id, status: allocation.status },
        data: { status, ...(status === "DELIVERED" ? { deliveredAt: new Date() } : {}) },
      });
      if (changed.count !== 1) {
        const error = new Error("Allocation changed; reload and try again") as Error & { status: number };
        error.status = 409;
        throw error;
      }
      if (status === "CANCELLED") {
        const resourceUpdate = await tx.resource.updateMany({
          where: {
            id: allocation.resourceId,
            organizationId: allocation.organizationId,
            totalQuantity: allocation.resource.totalQuantity,
            availableQuantity: { lte: allocation.resource.totalQuantity - allocation.allocatedQuantity },
          },
          data: { availableQuantity: { increment: allocation.allocatedQuantity } },
        });
        if (resourceUpdate.count !== 1) {
          const error = new Error("Cannot restore this allocation to inventory; check resource totals") as Error & { status: number };
          error.status = 409;
          throw error;
        }
        await tx.resourceStockHistory.create({
          data: {
            resourceId: allocation.resourceId,
            changeAmount: allocation.allocatedQuantity,
            type: "ADJUSTMENT",
            notes: `Cancelled allocation ${id} returned to stock`,
          },
        });
      }
      const active = await tx.resourceAllocation.count({
        where: { requestId: allocation.requestId, status: { notIn: ["DELIVERED", "CANCELLED"] } },
      });
      const delivered = await tx.resourceAllocation.count({
        where: { requestId: allocation.requestId, status: "DELIVERED" },
      });
      const inTransit = await tx.resourceAllocation.count({
        where: { requestId: allocation.requestId, status: "IN_TRANSIT" },
      });
      const nextRequestStatus = active > 0
        ? inTransit > 0 ? "IN_TRANSIT" : "ALLOCATED"
        : status === "CANCELLED" && delivered === 0 ? "VERIFIED" : "COMPLETED";
      if (status === "IN_TRANSIT" || status === "DELIVERED" || status === "CANCELLED") {
        await tx.emergencyRequest.update({ where: { id: allocation.requestId }, data: { status: nextRequestStatus } });
      }
      await tx.activityLog.create({
        data: { userId: user.id, action: "allocation_updated", entityType: "ResourceAllocation", entityId: id, details: status || "updated" },
      });
      if (allocation.coordinatorId !== user.id) {
        await tx.notification.create({
          data: {
            userId: allocation.coordinatorId,
            title: "Allocation status updated",
            message: `Allocation ${id} is now ${status.toLowerCase().replaceAll("_", " ")}.`,
            type: "ALLOCATION_STATUS",
            link: `/allocations/${id}`,
          },
        });
      }
      return tx.resourceAllocation.findUniqueOrThrow({ where: { id } });
    });

    return NextResponse.json(updated);
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed" }, { status: err.status || 400 });
  }
}
