import { NextResponse } from "next/server";
import { requireAuth, requireRole } from "@/lib/api-auth";
import prisma from "@/lib/prisma";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const user = await requireAuth();
    const target = await prisma.user.findUnique({
      where: { id },
      select: { id: true, name: true, email: true, role: true, organizationId: true, phone: true, availabilityStatus: true, isActive: true, createdAt: true, organization: { select: { id: true, name: true } } },
    });
    if (!target) return NextResponse.json({ error: "User not found" }, { status: 404 });
    if (user.role !== "SYSTEM_ADMIN" && target.id !== user.id &&
        !(["EMERGENCY_COORDINATOR", "RELIEF_ORGANIZATION"].includes(user.role) &&
          user.organizationId && target.organizationId === user.organizationId)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.json(target);
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Unauthorized" }, { status: err.status || 401 });
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const user = await requireAuth();
    const isAdmin = user.role === "SYSTEM_ADMIN";
    if (!isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const target = await prisma.user.findUnique({ where: { id } });
    if (!target) return NextResponse.json({ error: "User not found" }, { status: 404 });
    const body = await req.json();
    const { name, email, role, organizationId, phone, availabilityStatus, isActive } = body || {};
    const data: any = {};
    if (name !== undefined) data.name = name;
    if (email !== undefined) data.email = email;
    if (phone !== undefined) data.phone = phone;
    if (isActive !== undefined) data.isActive = isActive;
    if (availabilityStatus !== undefined) data.availabilityStatus = availabilityStatus;

    if (role !== undefined) {
      data.role = role;
    }

    if (organizationId !== undefined) {
      data.organizationId = organizationId || null;
    }

    const updated = await prisma.user.update({
      where: { id },
      data,
      select: { id: true, name: true, email: true, role: true, organizationId: true, phone: true, availabilityStatus: true, isActive: true, createdAt: true },
    });
    return NextResponse.json(updated);
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Forbidden" }, { status: err.status || 403 });
  }
}
