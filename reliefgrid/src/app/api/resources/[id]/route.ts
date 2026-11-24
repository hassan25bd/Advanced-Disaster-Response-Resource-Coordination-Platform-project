import { NextResponse } from "next/server";
import { requireRole } from "@/lib/api-auth";
import prisma from "@/lib/prisma";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const user = await requireRole("SYSTEM_ADMIN", "EMERGENCY_COORDINATOR", "RELIEF_ORGANIZATION");
    if (user.role === "EMERGENCY_COORDINATOR" && !user.organizationId) {
      return NextResponse.json({ error: "No organization associated" }, { status: 403 });
    }
    const resource = await prisma.resource.findUnique({
      where: { id },
      include: { organization: true, stockHistory: { orderBy: { timestamp: "desc" }, take: 50 }, allocations: true },
    });
    if (!resource) return NextResponse.json({ error: "Resource not found" }, { status: 404 });
    if (user.role !== "SYSTEM_ADMIN" && resource.organizationId !== user.organizationId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.json(resource);
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Unauthorized" }, { status: err.status || 401 });
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const user = await requireRole("SYSTEM_ADMIN", "EMERGENCY_COORDINATOR", "RELIEF_ORGANIZATION");
    const resource = await prisma.resource.findUnique({ where: { id } });
    if (!resource) return NextResponse.json({ error: "Resource not found" }, { status: 404 });

    if (user.role !== "SYSTEM_ADMIN" && resource.organizationId !== user.organizationId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const { name, category, totalQuantity, availableQuantity, unit, storageLocation, latitude, longitude } = body || {};
    const total = totalQuantity === undefined ? resource.totalQuantity : totalQuantity;
    const available = availableQuantity === undefined ? resource.availableQuantity : availableQuantity;
    if (!Number.isSafeInteger(total) || total < 0 || !Number.isSafeInteger(available) ||
        available < 0 || available > total) {
      return NextResponse.json({ error: "Quantities must be non-negative integers and available quantity cannot exceed total quantity" }, { status: 400 });
    }
    const activeAllocations = await prisma.resourceAllocation.aggregate({
      where: { resourceId: id, status: { in: ["ASSIGNED", "IN_TRANSIT"] } },
      _sum: { allocatedQuantity: true },
    });
    if (available + (activeAllocations._sum.allocatedQuantity || 0) > total) {
      return NextResponse.json({ error: "Total stock cannot be less than available stock plus active allocations" }, { status: 400 });
    }
    const updates: any = {};
    if (name !== undefined) updates.name = name;
    if (category !== undefined && !["FOOD_PACKAGES", "DRINKING_WATER", "MEDICAL_SUPPLIES", "EMERGENCY_KITS", "BLANKETS", "RESCUE_EQUIPMENT", "TRANSPORTATION"].includes(category)) {
      return NextResponse.json({ error: "Invalid resource category" }, { status: 400 });
    }
    if (category !== undefined) updates.category = category;
    if (totalQuantity !== undefined) updates.totalQuantity = totalQuantity;
    if (availableQuantity !== undefined) updates.availableQuantity = availableQuantity;
    if (unit !== undefined) updates.unit = unit;
    if (storageLocation !== undefined) updates.storageLocation = storageLocation;
    if (latitude !== undefined) updates.latitude = latitude;
    if (longitude !== undefined) updates.longitude = longitude;
    if ((latitude !== undefined && (!Number.isFinite(latitude) || latitude < -90 || latitude > 90)) ||
        (longitude !== undefined && (!Number.isFinite(longitude) || longitude < -180 || longitude > 180))) {
      return NextResponse.json({ error: "Invalid resource coordinates" }, { status: 400 });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.resource.updateMany({
        where: { id, organizationId: resource.organizationId, totalQuantity: resource.totalQuantity, availableQuantity: resource.availableQuantity },
        data: updates,
      });
      if (result.count !== 1) {
        const error = new Error("Resource changed; reload and try again") as Error & { status: number };
        error.status = 409;
        throw error;
      }
      if (available !== resource.availableQuantity || total !== resource.totalQuantity) {
        await tx.resourceStockHistory.create({
          data: {
            resourceId: id,
            changeAmount: available - resource.availableQuantity,
            type: "ADJUSTMENT",
            notes: `Stock updated: total ${resource.totalQuantity} → ${total}, available ${resource.availableQuantity} → ${available}`,
          },
        });
      }
      await tx.activityLog.create({ data: { userId: user.id, action: "resource_updated", entityType: "Resource", entityId: id, details: name || resource.name } });
      return tx.resource.findUniqueOrThrow({ where: { id } });
    });
    return NextResponse.json(updated);
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Forbidden" }, { status: err.status || 403 });
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const user = await requireRole("SYSTEM_ADMIN", "RELIEF_ORGANIZATION");
    const resource = await prisma.resource.findUnique({ where: { id } });
    if (!resource) return NextResponse.json({ error: "Resource not found" }, { status: 404 });
    if (user.role === "RELIEF_ORGANIZATION" && resource.organizationId !== user.organizationId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const deleted = await prisma.resource.deleteMany({
      where: { id, organizationId: resource.organizationId, allocations: { none: {} } },
    });
    if (deleted.count !== 1) {
      return NextResponse.json({ error: "Resources with allocations cannot be deleted" }, { status: 409 });
    }
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Forbidden" }, { status: err.status || 403 });
  }
}
