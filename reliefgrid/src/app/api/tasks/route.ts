import { NextResponse } from "next/server";
import { requireRole } from "@/lib/api-auth";
import prisma from "@/lib/prisma";

export async function GET(req: Request) {
  try {
    const user = await requireRole("SYSTEM_ADMIN", "EMERGENCY_COORDINATOR", "RELIEF_ORGANIZATION", "VOLUNTEER");
    const { searchParams } = new URL(req.url);
    const page = Math.max(parseInt(searchParams.get("page") || "1", 10), 1);
    const pageSize = Math.min(Math.max(parseInt(searchParams.get("pageSize") || "10", 10), 1), 100);
    const status = searchParams.get("status") || undefined;
    const search = searchParams.get("search")?.trim() || "";

    const where: any = search ? { AND: [{ OR: [
      { title: { contains: search, mode: "insensitive" } },
      { location: { contains: search, mode: "insensitive" } },
      { incident: { title: { contains: search, mode: "insensitive" } } },
    ] }] } : {};
    if (status) where.status = status;

    if (user.role === "VOLUNTEER") {
      where.volunteerId = user.id;
    } else if (user.role === "RELIEF_ORGANIZATION") {
      if (!user.organizationId) return NextResponse.json({ error: "No organization associated" }, { status: 403 });
      where.team = { organizationId: user.organizationId };
    } else if (user.role === "EMERGENCY_COORDINATOR") {
      const coordinatorScope: Record<string, unknown>[] = [{ incident: { coordinatorId: user.id } }];
      if (user.organizationId) {
        coordinatorScope.push(
          { incident: { reportedBy: { organizationId: user.organizationId } } },
          { team: { organizationId: user.organizationId } },
        );
      }
      where.AND = [
        ...(where.AND || []),
        { OR: coordinatorScope },
      ];
    }

    const [data, total] = await Promise.all([
      prisma.volunteerTask.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { assignedAt: "desc" },
        include: { incident: true, team: true, volunteer: { select: { id: true, name: true, email: true } } },
      }),
      prisma.volunteerTask.count({ where }),
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
    const { title, description, incidentId, teamId, volunteerId, location, latitude, longitude } = body || {};

    if (typeof title !== "string" || !title.trim() || typeof incidentId !== "string" || !incidentId) {
      return NextResponse.json({ error: "Title and incident are required" }, { status: 400 });
    }
    if ((latitude !== undefined && (!Number.isFinite(latitude) || latitude < -90 || latitude > 90)) ||
        (longitude !== undefined && (!Number.isFinite(longitude) || longitude < -180 || longitude > 180))) {
      return NextResponse.json({ error: "Invalid task coordinates" }, { status: 400 });
    }
    const incident = await prisma.incident.findUnique({
      where: { id: incidentId },
      select: { id: true, coordinatorId: true, reportedBy: { select: { organizationId: true } } },
    });
    if (!incident) return NextResponse.json({ error: "Incident not found" }, { status: 404 });
    if (user.role === "EMERGENCY_COORDINATOR" &&
        incident.coordinatorId !== user.id &&
        (!user.organizationId || incident.reportedBy.organizationId !== user.organizationId)) {
      return NextResponse.json({ error: "You cannot assign tasks for this incident" }, { status: 403 });
    }
    let teamOrgId: string | null = null;
    if (teamId) {
      const team = await prisma.team.findUnique({ where: { id: teamId }, select: { organizationId: true } });
      if (!team) return NextResponse.json({ error: "Team not found" }, { status: 404 });
      teamOrgId = team.organizationId;
      if (user.role === "EMERGENCY_COORDINATOR" && user.organizationId && teamOrgId !== user.organizationId) {
        return NextResponse.json({ error: "You cannot assign a team outside your organization" }, { status: 403 });
      }
    }
    if (volunteerId) {
      const volunteer = await prisma.user.findFirst({
        where: {
          id: volunteerId,
          role: "VOLUNTEER",
          isActive: true,
          ...((teamOrgId || (user.role === "EMERGENCY_COORDINATOR" ? user.organizationId : null))
            ? { organizationId: teamOrgId || user.organizationId }
            : {}),
        },
        select: { id: true },
      });
      if (!volunteer) return NextResponse.json({ error: "Volunteer must be active and belong to the assigned team organization" }, { status: 400 });
    }

    const task = await prisma.$transaction(async (tx) => {
      const created = await tx.volunteerTask.create({
        data: { title: title.trim(), description: typeof description === "string" ? description : "", incidentId, teamId: teamId || null, volunteerId: volunteerId || null, location: location || "", latitude: latitude || 0, longitude: longitude || 0, status: "ASSIGNED" },
      });
      await tx.activityLog.create({ data: { userId: user.id, action: "task_created", entityType: "VolunteerTask", entityId: created.id, details: created.title } });
      if (volunteerId) {
        await tx.notification.create({
          data: {
            userId: volunteerId,
            title: "Response task assigned",
            message: `You have been assigned: ${created.title}`,
            type: "TASK_ASSIGNED",
            link: `/tasks/${created.id}`,
          },
        });
      }
      return created;
    });
    return NextResponse.json(task, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed" }, { status: err.status || 400 });
  }
}
