import { NextResponse } from "next/server";
import { requireAuth, requireRole } from "@/lib/api-auth";
import prisma from "@/lib/prisma";

export async function GET(req: Request) {
  try {
    const user = await requireAuth();
    const { searchParams } = new URL(req.url);
    const page = Math.max(parseInt(searchParams.get("page") || "1", 10), 1);
    const pageSize = Math.min(Math.max(parseInt(searchParams.get("pageSize") || "10", 10), 1), 100);
    const status = searchParams.get("status") || undefined;
    const organizationId = searchParams.get("organizationId") || undefined;

    const where: any = {};
    if (status) where.status = status;
    if (organizationId) where.organizationId = organizationId;

    if (user.role === "RELIEF_ORGANIZATION") {
      where.organizationId = user.organizationId;
    } else if (user.role === "VOLUNTEER") {
      where.coordinatorId = user.id;
    }

    const [data, total] = await Promise.all([
      prisma.resourceAllocation.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { allocatedAt: "desc" },
        include: {
          request: { include: { incident: true } },
          resource: true,
          organization: { select: { id: true, name: true } },
          coordinator: { select: { id: true, name: true } },
        },
      }),
      prisma.resourceAllocation.count({ where }),
    ]);

    return NextResponse.json({ data, total, page, pageSize });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Unauthorized" }, { status: err.status || 401 });
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireRole("SYSTEM_ADMIN", "EMERGENCY_COORDINATOR");
    const body = await req.json();
    const { requestId, resourceId, organizationId, allocatedQuantity } = body || {};

    if (!requestId || !resourceId || !organizationId || !allocatedQuantity || allocatedQuantity < 1) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const [request, resource] = await Promise.all([
      prisma.emergencyRequest.findUnique({ where: { id: requestId } }),
      prisma.resource.findUnique({ where: { id: resourceId } }),
    ]);

    if (!request) return NextResponse.json({ error: "Request not found" }, { status: 404 });
    if (!resource) return NextResponse.json({ error: "Resource not found" }, { status: 404 });

    // Business rule: same resource cannot be allocated beyond available quantity
    if (resource.availableQuantity < allocatedQuantity) {
      return NextResponse.json({ error: "Insufficient available quantity" }, { status: 400 });
    }

    const qrCode = `RG-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const coordinatorId = user.id;

    const allocation = await prisma.$transaction(async (tx) => {
      const alloc = await tx.resourceAllocation.create({
        data: {
          requestId,
          resourceId,
          organizationId,
          coordinatorId,
          allocatedQuantity,
          status: "ASSIGNED",
          qrVerificationCode: qrCode,
        },
      });

      // Auto-update resource stock
      await tx.resource.update({
        where: { id: resourceId },
        data: { availableQuantity: { decrement: allocatedQuantity } },
      });

      // Stock history
      await tx.resourceStockHistory.create({
        data: {
          resourceId,
          changeAmount: -allocatedQuantity,
          type: "ALLOCATED",
          notes: `Allocated to request ${requestId}`,
          timestamp: new Date(),
        },
      });

      // Update request status
      await tx.emergencyRequest.update({
        where: { id: requestId },
        data: { status: "ALLOCATED" },
      });

      await tx.activityLog.create({
        data: { userId: coordinatorId, action: "resource_allocated", entityType: "ResourceAllocation", entityId: alloc.id, details: `Allocated ${allocatedQuantity} of ${resource.name}` },
      });

      return alloc;
    });

    return NextResponse.json(allocation, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed" }, { status: err.status || 400 });
  }
}
