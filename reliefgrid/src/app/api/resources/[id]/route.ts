import { NextResponse } from "next/server";
import { requireAuth, requireRole } from "@/lib/api-auth";
import prisma from "@/lib/prisma";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await requireAuth();
    const resource = await prisma.resource.findUnique({
      where: { id },
      include: { organization: true, stockHistory: { orderBy: { timestamp: "desc" }, take: 50 }, allocations: true },
    });
    if (!resource) return NextResponse.json({ error: "Resource not found" }, { status: 404 });
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
    const updates: any = {};
    if (name !== undefined) updates.name = name;
    if (category !== undefined) updates.category = category;
    if (totalQuantity !== undefined) updates.totalQuantity = totalQuantity;
    if (availableQuantity !== undefined) updates.availableQuantity = availableQuantity;
    if (unit !== undefined) updates.unit = unit;
    if (storageLocation !== undefined) updates.storageLocation = storageLocation;
    if (latitude !== undefined) updates.latitude = latitude;
    if (longitude !== undefined) updates.longitude = longitude;

    const updated = await prisma.resource.update({ where: { id }, data: updates });
    await prisma.activityLog.create({ data: { userId: user.id, action: "resource_updated", entityType: "Resource", entityId: id, details: name || resource.name } });
    return NextResponse.json(updated);
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Forbidden" }, { status: err.status || 403 });
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await requireRole("SYSTEM_ADMIN", "RELIEF_ORGANIZATION");
    const resource = await prisma.resource.findUnique({ where: { id } });
    if (!resource) return NextResponse.json({ error: "Resource not found" }, { status: 404 });
    await prisma.resource.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Forbidden" }, { status: err.status || 403 });
  }
}
