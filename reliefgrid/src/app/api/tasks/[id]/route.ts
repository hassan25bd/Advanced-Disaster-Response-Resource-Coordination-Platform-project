import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import prisma from "@/lib/prisma";
import { MAX_TASK_FIELD_PHOTOS } from "@/lib/image-upload";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const user = await requireAuth();
    const task = await prisma.volunteerTask.findUnique({
      where: { id },
      include: {
        incident: { include: { reportedBy: { select: { organizationId: true } } } },
        team: { include: { organization: { select: { id: true, name: true } }, leader: { select: { id: true, name: true } } } },
        volunteer: { select: { id: true, name: true, email: true } },
      },
    });
    if (!task) return NextResponse.json({ error: "Task not found" }, { status: 404 });
    const isAdmin = user.role === "SYSTEM_ADMIN";
    const isCoordinator = user.role === "EMERGENCY_COORDINATOR" &&
      (task.incident?.coordinatorId === user.id ||
        (!!user.organizationId && task.team?.organizationId === user.organizationId) ||
        (!!user.organizationId && task.incident?.reportedBy.organizationId === user.organizationId));
    const isOrganization = user.role === "RELIEF_ORGANIZATION" &&
      !!user.organizationId && task.team?.organizationId === user.organizationId;
    const isVolunteer = user.role === "VOLUNTEER" && task.volunteerId === user.id;
    if (!isAdmin && !isCoordinator && !isOrganization && !isVolunteer) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const history = await prisma.activityLog.findMany({
      where: { entityType: "VolunteerTask", entityId: id },
      orderBy: { timestamp: "desc" },
      include: { user: { select: { name: true } } },
    });
    return NextResponse.json({ ...task, history });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Unauthorized" }, { status: err.status || 401 });
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const user = await requireAuth();
    const task = await prisma.volunteerTask.findUnique({
      where: { id },
      include: { incident: { include: { reportedBy: { select: { organizationId: true } } } }, team: { select: { organizationId: true } } },
    });
    if (!task) return NextResponse.json({ error: "Task not found" }, { status: 404 });

    const isAdmin = user.role === "SYSTEM_ADMIN";
    const isCoordinator = user.role === "EMERGENCY_COORDINATOR" &&
      (task.incident?.coordinatorId === user.id ||
        (!!user.organizationId && task.team?.organizationId === user.organizationId) ||
        (!!user.organizationId && task.incident?.reportedBy.organizationId === user.organizationId));
    const isVolunteer = user.role === "VOLUNTEER";
    const isOrganization = user.role === "RELIEF_ORGANIZATION" &&
      !!user.organizationId && task.team?.organizationId === user.organizationId;

    if (isVolunteer && task.volunteerId !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (!isAdmin && !isCoordinator && !isVolunteer && !isOrganization) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const { status, fieldReport, fieldPhotos, teamId } = body || {};
    if (isVolunteer && teamId !== undefined) {
      return NextResponse.json({ error: "Volunteers cannot change task assignments" }, { status: 403 });
    }
    if (isOrganization && (status !== undefined || teamId !== undefined || fieldPhotos !== undefined)) {
      return NextResponse.json({ error: "Organizations may update field reports only" }, { status: 403 });
    }
    if (task.status === "COMPLETED") {
      return NextResponse.json({ error: "Completed tasks are read-only" }, { status: 409 });
    }
    if (status !== undefined && !["ASSIGNED", "ACCEPTED", "IN_PROGRESS", "COMPLETED"].includes(status)) {
      return NextResponse.json({ error: "Invalid task status" }, { status: 400 });
    }
    if (isVolunteer && status !== undefined) {
      const allowedNext = task.status === "ASSIGNED"
        ? ["ACCEPTED", "IN_PROGRESS", "COMPLETED"]
        : task.status === "ACCEPTED"
          ? ["IN_PROGRESS", "COMPLETED"]
          : task.status === "IN_PROGRESS" ? ["COMPLETED"] : [];
      if (!allowedNext.includes(status)) {
        return NextResponse.json({ error: "Task status cannot move backwards" }, { status: 409 });
      }
    }
    if (fieldReport !== undefined && typeof fieldReport !== "string") {
      return NextResponse.json({ error: "Field report must be text" }, { status: 400 });
    }
    if (fieldPhotos !== undefined && (!Array.isArray(fieldPhotos) || fieldPhotos.length > MAX_TASK_FIELD_PHOTOS || fieldPhotos.some((photo: unknown) => typeof photo !== "string"))) {
      return NextResponse.json({ error: "Field photos must be a list of URLs" }, { status: 400 });
    }
    if (fieldPhotos !== undefined && fieldPhotos.some((photo: string) =>
      photo.length > 1_100_000 ||
      (!/^data:image\/(?:jpeg|png|webp|gif);base64,/i.test(photo) && !photo.startsWith("https://"))
    )) {
      return NextResponse.json({ error: "Each field photo must be an image data URL or HTTPS URL under 1.1 MB" }, { status: 400 });
    }
    if (isVolunteer && fieldPhotos !== undefined &&
        task.fieldPhotos.some((photo) => !fieldPhotos.includes(photo))) {
      return NextResponse.json({ error: "Volunteers may add photographs but cannot remove existing field records" }, { status: 403 });
    }
    const updates: any = {};
    if (status !== undefined) updates.status = status;
    if (fieldReport !== undefined) updates.fieldReport = fieldReport;
    if (fieldPhotos !== undefined) updates.fieldPhotos = fieldPhotos;
    if (teamId !== undefined) updates.teamId = teamId;
    if (status === "COMPLETED") updates.completedAt = new Date();

    if (teamId && (isAdmin || isCoordinator)) {
      const team = await prisma.team.findFirst({
        where: {
          id: teamId,
          ...(user.role === "EMERGENCY_COORDINATOR" && user.organizationId ? { organizationId: user.organizationId } : {}),
        },
        select: { organizationId: true },
      });
      if (!team) return NextResponse.json({ error: "Team not found or outside your organization" }, { status: 400 });
      if (task.volunteerId) {
        const volunteer = await prisma.user.findFirst({
          where: { id: task.volunteerId, role: "VOLUNTEER", organizationId: team.organizationId, isActive: true },
          select: { id: true },
        });
        if (!volunteer) return NextResponse.json({ error: "Assigned volunteer is not part of this team organization" }, { status: 400 });
      }
    }

    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.volunteerTask.update({ where: { id }, data: updates });
      await tx.activityLog.create({
        data: { userId: user.id, action: "task_updated", entityType: "VolunteerTask", entityId: id, details: status || Object.keys(updates).join(",") || "updated" },
      });
      return result;
    });
    return NextResponse.json(updated);
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed" }, { status: err.status || 400 });
  }
}
