import { NextResponse } from "next/server";
import { requireRole } from "@/lib/api-auth";
import prisma from "@/lib/prisma";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const user = await requireRole("SYSTEM_ADMIN", "EMERGENCY_COORDINATOR", "RELIEF_ORGANIZATION", "VOLUNTEER");
    const team = await prisma.team.findUnique({
      where: { id },
      include: {
        organization: { select: { id: true, name: true } },
        leader: { select: { id: true, name: true, email: true } },
        tasks: {
          orderBy: { assignedAt: "desc" },
          include: {
            incident: { select: { id: true, title: true } },
            volunteer: { select: { id: true, name: true, email: true } },
          },
        },
      },
    });
    if (!team) return NextResponse.json({ error: "Team not found" }, { status: 404 });
    if (user.role === "RELIEF_ORGANIZATION" && team.organizationId !== user.organizationId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (user.role === "EMERGENCY_COORDINATOR" && (!user.organizationId || team.organizationId !== user.organizationId)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (user.role === "VOLUNTEER" && !team.tasks.some((task) => task.volunteerId === user.id)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.json(team);
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Unauthorized" }, { status: err.status || 401 });
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const user = await requireRole("SYSTEM_ADMIN", "EMERGENCY_COORDINATOR", "RELIEF_ORGANIZATION");
    const team = await prisma.team.findUnique({ where: { id } });
    if (!team) return NextResponse.json({ error: "Team not found" }, { status: 404 });
    if (user.role !== "SYSTEM_ADMIN" && team.organizationId !== user.organizationId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const { name, leaderId, status } = body || {};
    if (name !== undefined && (typeof name !== "string" || !name.trim())) {
      return NextResponse.json({ error: "Team name cannot be empty" }, { status: 400 });
    }
    if (status !== undefined && !["ACTIVE", "DEPLOYED", "STANDBY"].includes(status)) {
      return NextResponse.json({ error: "Invalid team status" }, { status: 400 });
    }
    if (leaderId) {
      const leader = await prisma.user.findFirst({
        where: { id: leaderId, role: "VOLUNTEER", organizationId: team.organizationId, isActive: true },
        select: { id: true },
      });
      if (!leader) return NextResponse.json({ error: "Team leader must be an active volunteer in this organization" }, { status: 400 });
    }
    const updates: Record<string, unknown> = {};
    if (name !== undefined) updates.name = name.trim();
    if (leaderId !== undefined) updates.leaderId = leaderId || null;
    if (status !== undefined) updates.status = status;

    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.team.update({ where: { id }, data: updates });
      await tx.activityLog.create({ data: { userId: user.id, action: "team_updated", entityType: "Team", entityId: id, details: Object.keys(updates).join(",") } });
      return result;
    });
    return NextResponse.json(updated);
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to update team" }, { status: err.status || 400 });
  }
}
