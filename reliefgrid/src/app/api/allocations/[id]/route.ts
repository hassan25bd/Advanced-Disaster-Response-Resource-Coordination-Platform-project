import { NextResponse } from "next/server";
import { requireAuth, requireRole } from "@/lib/api-auth";
import prisma from "@/lib/prisma";

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
    const { status, deliveredAt } = body || {};
    const updates: any = {};
    if (status) updates.status = status;
    if (deliveredAt) updates.deliveredAt = new Date(deliveredAt);

    const updated = await prisma.$transaction(async (tx) => {
      const a = await tx.resourceAllocation.update({ where: { id }, data: updates });
      if (status === "DELIVERED") {
        await tx.emergencyRequest.update({ where: { id: allocation.requestId }, data: { status: "COMPLETED" } });
      }
      await tx.activityLog.create({
        data: { userId: user.id, action: "allocation_updated", entityType: "ResourceAllocation", entityId: id, details: status || "updated" },
      });
      return a;
    });

    return NextResponse.json(updated);
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed" }, { status: err.status || 400 });
  }
}
