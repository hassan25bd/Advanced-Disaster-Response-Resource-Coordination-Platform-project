import { NextResponse } from "next/server";
import { requireRole } from "@/lib/api-auth";
import prisma from "@/lib/prisma";
import { demoDataWhere, includeDemoRecords } from "@/lib/demo-data";

export async function GET(req: Request) {
  try {
    const user = await requireRole("SYSTEM_ADMIN", "EMERGENCY_COORDINATOR", "RELIEF_ORGANIZATION", "VOLUNTEER", "SHELTER_MANAGER");
    const { searchParams } = new URL(req.url);
    const page = Math.max(parseInt(searchParams.get("page") || "1", 10), 1);
    const pageSize = Math.min(Math.max(parseInt(searchParams.get("pageSize") || "10", 10), 1), 100);
    const search = searchParams.get("search")?.trim() || "";
    const where: any = {
      ...(search ? { name: { contains: search, mode: "insensitive" } } : {}),
    };
    if (user.role !== "SYSTEM_ADMIN") {
      const organizationScope = user.role === "VOLUNTEER"
        ? { tasks: { some: { volunteerId: user.id } } }
        : user.organizationId
          ? { organizationId: user.organizationId }
          : undefined;
      includeDemoRecords(where, organizationScope, demoDataWhere.team);
    }

    const [data, total] = await Promise.all([
      prisma.team.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: "desc" },
        include: { organization: { select: { id: true, name: true } }, leader: { select: { id: true, name: true } }, _count: { select: { tasks: true } } },
      }),
      prisma.team.count({ where }),
    ]);

    return NextResponse.json({
      data: data.map((team) => ({
        ...team,
        isDemo: team.name.startsWith("RGDEMO-"),
      })),
      total,
      page,
      pageSize,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Unauthorized" }, { status: err.status || 401 });
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireRole("SYSTEM_ADMIN", "EMERGENCY_COORDINATOR", "RELIEF_ORGANIZATION");
    const body = await req.json();
    const { name, organizationId, leaderId, status } = body || {};

    if (typeof name !== "string" || !name.trim()) return NextResponse.json({ error: "Team name is required" }, { status: 400 });
    if (name.trim().startsWith("RGDEMO-")) {
      return NextResponse.json({ error: "This prefix is reserved for shared demo records" }, { status: 400 });
    }

    const orgId = user.role === "RELIEF_ORGANIZATION"
      ? user.organizationId
      : (organizationId || user.organizationId);
    if (!orgId) return NextResponse.json({ error: "No organization associated" }, { status: 400 });
    if (user.role !== "SYSTEM_ADMIN" && orgId !== user.organizationId) {
      return NextResponse.json({ error: "You can only manage teams for your organization" }, { status: 403 });
    }
    if (status !== undefined && !["ACTIVE", "DEPLOYED", "STANDBY"].includes(status)) {
      return NextResponse.json({ error: "Invalid team status" }, { status: 400 });
    }
    const organization = await prisma.organization.findUnique({ where: { id: orgId }, select: { id: true } });
    if (!organization) return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    if (leaderId) {
      const leader = await prisma.user.findFirst({
        where: { id: leaderId, role: "VOLUNTEER", organizationId: orgId, isActive: true },
        select: { id: true, email: true },
      });
      if (!leader) return NextResponse.json({ error: "Team leader must be an active volunteer in this organization" }, { status: 400 });
      if (leader.email.startsWith("rgdemo-") && leader.email.endsWith("@example.invalid")) {
        return NextResponse.json({ error: "Shared demo volunteers cannot be assigned to live teams" }, { status: 409 });
      }
    }

    const team = await prisma.$transaction(async (tx) => {
      const created = await tx.team.create({
        data: { name: name.trim(), organizationId: orgId, leaderId: leaderId || null, status: status || "STANDBY" },
      });
      await tx.activityLog.create({ data: { userId: user.id, action: "team_created", entityType: "Team", entityId: created.id, details: created.name } });
      return created;
    });
    return NextResponse.json(team, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed" }, { status: err.status || 400 });
  }
}
