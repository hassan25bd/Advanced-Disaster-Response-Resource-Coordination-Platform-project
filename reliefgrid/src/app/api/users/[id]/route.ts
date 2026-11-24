import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import prisma from "@/lib/prisma";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const user = await requireAuth();
    const target = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true, name: true, email: true, role: true, organizationId: true, phone: true,
        availabilityStatus: true, isActive: true, createdAt: true,
        organization: { select: { id: true, name: true } },
        _count: { select: { incidents: true, allocations: true, teamsLed: true, tasks: true } },
      },
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
    const roles = ["SYSTEM_ADMIN", "EMERGENCY_COORDINATOR", "RELIEF_ORGANIZATION", "VOLUNTEER", "SHELTER_MANAGER"];
    const availabilityStatuses = ["AVAILABLE", "BUSY", "OFF_DUTY"];
    if ((name !== undefined && (typeof name !== "string" || !name.trim())) ||
        (email !== undefined && (typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) ||
        (role !== undefined && !roles.includes(role)) ||
        (phone !== undefined && phone !== null && typeof phone !== "string") ||
        (availabilityStatus !== undefined && !availabilityStatuses.includes(availabilityStatus)) ||
        (isActive !== undefined && typeof isActive !== "boolean") ||
        (organizationId !== undefined && organizationId !== null && typeof organizationId !== "string")) {
      return NextResponse.json({ error: "Invalid user update" }, { status: 400 });
    }
    if (id === user.id && (role !== undefined && role !== "SYSTEM_ADMIN" || isActive === false)) {
      return NextResponse.json({ error: "You cannot remove your own administrator access" }, { status: 400 });
    }
    if (organizationId) {
      const organization = await prisma.organization.findUnique({ where: { id: organizationId }, select: { id: true } });
      if (!organization) return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }
    const data: any = {};
    if (name !== undefined) data.name = name.trim();
    if (email !== undefined) data.email = email.trim().toLowerCase();
    if (phone !== undefined) data.phone = phone;
    if (isActive !== undefined) data.isActive = isActive;
    if (availabilityStatus !== undefined) data.availabilityStatus = availabilityStatus;

    if (role !== undefined) {
      data.role = role;
    }

    if (organizationId !== undefined) {
      data.organizationId = organizationId || null;
    }

    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.user.update({
        where: { id },
        data,
        select: { id: true, name: true, email: true, role: true, organizationId: true, phone: true, availabilityStatus: true, isActive: true, createdAt: true },
      });
      await tx.activityLog.create({
        data: { userId: user.id, action: "user_updated", entityType: "User", entityId: id, details: Object.keys(data).join(",") || "updated" },
      });
      return result;
    });
    return NextResponse.json(updated);
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Forbidden" }, { status: err.status || 403 });
  }
}
