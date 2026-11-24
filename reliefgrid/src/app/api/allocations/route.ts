import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { requireRole } from "@/lib/api-auth";
import prisma from "@/lib/prisma";

export async function GET(req: Request) {
  try {
    const user = await requireRole("SYSTEM_ADMIN", "EMERGENCY_COORDINATOR", "RELIEF_ORGANIZATION");
    const { searchParams } = new URL(req.url);
    const page = Math.max(parseInt(searchParams.get("page") || "1", 10), 1);
    const pageSize = Math.min(Math.max(parseInt(searchParams.get("pageSize") || "10", 10), 1), 100);
    const status = searchParams.get("status") || undefined;
    const organizationId = searchParams.get("organizationId") || undefined;
    const search = searchParams.get("search")?.trim() || "";

    const where: any = {};
    if (status) where.status = status;
    if (user.role === "RELIEF_ORGANIZATION" || user.role === "EMERGENCY_COORDINATOR") {
      if (!user.organizationId) return NextResponse.json({ error: "No organization associated" }, { status: 403 });
      where.organizationId = user.organizationId;
    } else if (organizationId) {
      where.organizationId = organizationId;
    }

    if (search) {
      where.AND = [{ OR: [
        { request: { location: { contains: search, mode: "insensitive" } } },
        { request: { incident: { title: { contains: search, mode: "insensitive" } } } },
        { resource: { name: { contains: search, mode: "insensitive" } } },
        { organization: { name: { contains: search, mode: "insensitive" } } },
      ] }];
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

    if (!requestId || !resourceId || !organizationId || !Number.isSafeInteger(allocatedQuantity) || allocatedQuantity < 1) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const [request, resource] = await Promise.all([
      prisma.emergencyRequest.findUnique({ where: { id: requestId } }),
      prisma.resource.findUnique({ where: { id: resourceId } }),
    ]);

    if (!request) return NextResponse.json({ error: "Request not found" }, { status: 404 });
    if (!resource) return NextResponse.json({ error: "Resource not found" }, { status: 404 });

    if (resource.organizationId !== organizationId) {
      return NextResponse.json({ error: "Resource does not belong to the assigned organization" }, { status: 400 });
    }
    const compatibleCategories: Record<string, string[]> = {
      FOOD: ["FOOD_PACKAGES"],
      WATER: ["DRINKING_WATER"],
      MEDICAL: ["MEDICAL_SUPPLIES"],
      SHELTER: ["EMERGENCY_KITS", "BLANKETS"],
      RESCUE: ["RESCUE_EQUIPMENT", "TRANSPORTATION"],
      TRANSPORTATION: ["TRANSPORTATION"],
    };
    if (!compatibleCategories[request.type]?.includes(resource.category)) {
      return NextResponse.json({ error: "Resource category does not match the emergency request" }, { status: 400 });
    }
    if (user.role === "EMERGENCY_COORDINATOR" && organizationId !== user.organizationId) {
      return NextResponse.json({ error: "You can only allocate resources from your organization" }, { status: 403 });
    }

    const qrCode = `RG-${randomUUID()}`;
    const coordinatorId = user.id;

    const allocation = await prisma.$transaction(async (tx) => {
      const requestUpdate = await tx.emergencyRequest.updateMany({
        where: { id: requestId, status: { in: ["VERIFIED", "ALLOCATED", "IN_TRANSIT"] } },
        data: { status: request.status === "IN_TRANSIT" ? "IN_TRANSIT" : "ALLOCATED" },
      });
      if (requestUpdate.count !== 1) {
        throw new Error("Request must be verified before allocation");
      }
      const requestAllocated = await tx.resourceAllocation.aggregate({
        where: { requestId, status: { not: "CANCELLED" } },
        _sum: { allocatedQuantity: true },
      });
      if ((requestAllocated._sum.allocatedQuantity || 0) + allocatedQuantity > request.quantity) {
        throw new Error("Allocation quantity exceeds the remaining request quantity");
      }

      const stockUpdate = await tx.resource.updateMany({
        where: { id: resourceId, organizationId, availableQuantity: { gte: allocatedQuantity } },
        data: { availableQuantity: { decrement: allocatedQuantity } },
      });
      if (stockUpdate.count !== 1) {
        throw new Error("Insufficient available quantity");
      }

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

      await tx.activityLog.create({
        data: { userId: coordinatorId, action: "resource_allocated", entityType: "ResourceAllocation", entityId: alloc.id, details: `Allocated ${allocatedQuantity} of ${resource.name}` },
      });
      const organizationUsers = await tx.user.findMany({
        where: { organizationId, role: "RELIEF_ORGANIZATION", isActive: true },
        select: { id: true },
      });
      if (organizationUsers.length) {
        await tx.notification.createMany({
          data: organizationUsers.map((orgUser) => ({
            userId: orgUser.id,
            title: "New resource allocation",
            message: `${allocatedQuantity} ${resource.unit} of ${resource.name} assigned for an emergency request.`,
            type: "RESOURCE_ALLOCATION",
            link: `/allocations/${alloc.id}`,
          })),
        });
      }

      return alloc;
    });

    return NextResponse.json(allocation, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed" }, { status: err.status || 400 });
  }
}
