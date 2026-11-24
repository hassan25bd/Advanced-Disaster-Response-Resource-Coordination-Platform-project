import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import prisma from "@/lib/prisma";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const user = await requireAuth();
    const task = await prisma.volunteerTask.findUnique({ where: { id } });
    if (!task) return NextResponse.json({ error: "Task not found" }, { status: 404 });

    const isAdmin = user.role === "SYSTEM_ADMIN";
    const isCoordinator = user.role === "EMERGENCY_COORDINATOR";
    const isVolunteer = user.role === "VOLUNTEER";

    if (isVolunteer && task.volunteerId !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (!isAdmin && !isCoordinator && !isVolunteer) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const { status, fieldReport, fieldPhotos, teamId } = body || {};
    if (isVolunteer && teamId !== undefined) {
      return NextResponse.json({ error: "Volunteers cannot change task assignments" }, { status: 403 });
    }
    const updates: any = {};
    if (status !== undefined) updates.status = status;
    if (fieldReport !== undefined) updates.fieldReport = fieldReport;
    if (fieldPhotos !== undefined) updates.fieldPhotos = fieldPhotos;
    if (teamId !== undefined) updates.teamId = teamId;
    if (status === "COMPLETED") updates.completedAt = new Date();

    const updated = await prisma.volunteerTask.update({ where: { id }, data: updates });
    await prisma.activityLog.create({ data: { userId: user.id, action: "task_updated", entityType: "VolunteerTask", entityId: id, details: status || "updated" } });
    return NextResponse.json(updated);
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed" }, { status: err.status || 400 });
  }
}
