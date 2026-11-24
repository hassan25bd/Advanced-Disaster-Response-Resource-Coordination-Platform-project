import { NextResponse } from "next/server";
import { requireAuth, requireRole } from "@/lib/api-auth";
import prisma from "@/lib/prisma";

function orgFilter(user: any) {
  if (user.role === "SYSTEM_ADMIN") return {};
  return { organizationId: user.organizationId };
}

export async function GET(req: Request) {
  try {
    const user = await requireAuth();
    const { searchParams } = new URL(req.url);
    const page = Math.max(parseInt(searchParams.get("page") || "1", 10), 1);
    const pageSize = Math.min(Math.max(parseInt(searchParams.get("pageSize") || "10", 10), 1), 100);

    const [data, total] = await Promise.all([
      prisma.team.findMany({
        where: orgFilter(user),
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: "desc" },
        include: { organization: { select: { id: true, name: true } }, leader: { select: { id: true, name: true } }, _count: { select: { tasks: true } } },
      }),
      prisma.team.count({ where: orgFilter(user) }),
    ]);

    return NextResponse.json({ data, total, page, pageSize });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Unauthorized" }, { status: err.status || 401 });
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireRole("SYSTEM_ADMIN", "EMERGENCY_COORDINATOR", "RELIEF_ORGANIZATION");
    const body = await req.json();
    const { name, organizationId, leaderId, status } = body || {};

    if (!name) return NextResponse.json({ error: "Team name is required" }, { status: 400 });

    const orgId = user.role === "SYSTEM_ADMIN" ? (organizationId || user.organizationId) : user.organizationId;
    if (!orgId) return NextResponse.json({ error: "No organization associated" }, { status: 400 });

    const team = await prisma.team.create({
      data: { name, organizationId: orgId, leaderId: leaderId || null, status: status || "STANDBY" },
    });
    await prisma.activityLog.create({ data: { userId: user.id, action: "team_created", entityType: "Team", entityId: team.id, details: name } });
    return NextResponse.json(team, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed" }, { status: err.status || 400 });
  }
}
