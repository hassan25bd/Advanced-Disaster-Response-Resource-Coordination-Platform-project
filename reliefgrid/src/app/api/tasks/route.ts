import { NextResponse } from "next/server";
import { requireAuth, requireRole } from "@/lib/api-auth";
import prisma from "@/lib/prisma";

export async function GET(req: Request) {
  try {
    const user = await requireAuth();
    const { searchParams } = new URL(req.url);
    const page = Math.max(parseInt(searchParams.get("page") || "1", 10), 1);
    const pageSize = Math.min(Math.max(parseInt(searchParams.get("pageSize") || "10", 10), 1), 100);
    const status = searchParams.get("status") || undefined;

    const where: any = {};
    if (status) where.status = status;

    if (user.role === "VOLUNTEER") {
      where.volunteerId = user.id;
    } else if (user.role === "RELIEF_ORGANIZATION") {
      where.team = { organizationId: user.organizationId };
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

    if (!title || !incidentId) return NextResponse.json({ error: "Title and incident are required" }, { status: 400 });

    const task = await prisma.volunteerTask.create({
      data: { title, description: description || "", incidentId, teamId: teamId || null, volunteerId: volunteerId || null, location: location || "", latitude: latitude || 0, longitude: longitude || 0, status: "ASSIGNED" },
    });
    await prisma.activityLog.create({ data: { userId: user.id, action: "task_created", entityType: "VolunteerTask", entityId: task.id, details: title } });
    return NextResponse.json(task, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed" }, { status: err.status || 400 });
  }
}
