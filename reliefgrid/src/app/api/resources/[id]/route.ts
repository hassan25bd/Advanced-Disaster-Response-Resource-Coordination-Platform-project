import { NextResponse } from "next/server";
import { requireAuth, requireRole } from "@/lib/api-auth";
import prisma from "@/lib/prisma";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const user = await requireAuth();
    const resource = await prisma.resource.findUnique({
      where: { id },
      include: { organization: true, stockHistory: { orderBy: { timestamp: "desc" }, take: 50 }, allocations: true },
    });
    if (!resource) return NextResponse.json({ error: "Resource not found" }, { status: 404 });
    if (user.role === "RELIEF_ORGANIZATION" && resource.organizationId !== user.organizationId) {
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
    const updates: any = {};
    if (name !== undefined) updates.name = name;
    if (category !== undefined) updates.category = category;
    if (totalQuantity !== undefined) updates.totalQuantity = totalQuantity;
    if (availableQuantity !== undefined) updates.availableQuantity = availableQuantity;
    if (unit !== undefined) updates.unit = unit;
    if (storageLocation !== undefined) updates.storageLocation = storageLocation;
    if (latitude !== undefined) updates.latitude = latitude;
    if (longitude !== undefined) updates.longitude = longitude;

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
      if (available !== resource.availableQuantity) {
        await tx.resourceStockHistory.create({
          data: { resourceId: id, changeAmount: available - resource.availableQuantity, type: "ADJUSTMENT", notes: "Stock updated" },
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
