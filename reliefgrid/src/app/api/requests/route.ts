import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import prisma from "@/lib/prisma";

export async function GET(req: Request) {
  try {
    const user = await requireAuth();
    const { searchParams } = new URL(req.url);
    const page = Math.max(parseInt(searchParams.get("page") || "1", 10), 1);
    const pageSize = Math.min(Math.max(parseInt(searchParams.get("pageSize") || "10", 10), 1), 100);
    const search = searchParams.get("search") || "";
    const type = searchParams.get("type") || undefined;
    const priority = searchParams.get("priority") || undefined;
    const status = searchParams.get("status") || undefined;

    const where: any = {
      ...(search ? { description: { contains: search, mode: "insensitive" } } : {}),
      ...(type ? { type } : {}),
      ...(priority ? { priority } : {}),
      ...(status ? { status } : {}),
    };

    if (user.role === "RELIEF_ORGANIZATION") {
      where.allocations = { some: { organizationId: user.organizationId } };
    }

    const [data, total] = await Promise.all([
      prisma.emergencyRequest.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: [{ priorityScore: "desc" }, { createdAt: "desc" }],
        include: {
          incident: { select: { id: true, title: true, category: true, severity: true } },
          allocations: { include: { resource: true, organization: true } },
        },
      }),
      prisma.emergencyRequest.count({ where }),
    ]);

    return NextResponse.json({ data, total, page, pageSize });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Unauthorized" }, { status: err.status || 401 });
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireAuth();
    const body = await req.json();
    const { incidentId, type, quantity, location, latitude, longitude, priority, affectedPeople, description } = body || {};

    if (!incidentId || !type || !location) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const incident = await prisma.incident.findUnique({ where: { id: incidentId } });
    if (!incident) return NextResponse.json({ error: "Incident not found" }, { status: 404 });

    const isAdmin = user.role === "SYSTEM_ADMIN";
    const isCoordinator = user.role === "EMERGENCY_COORDINATOR";
    const isOrg = user.role === "RELIEF_ORGANIZATION";
    if (!isAdmin && !isCoordinator && !isOrg) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const pWeight = { LOW: 1, MEDIUM: 3, HIGH: 6, CRITICAL: 10 }[priority as "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"] || 3;
    const priorityScore = Math.round(pWeight * 10 + Math.log10(Math.max(affectedPeople || 1, 1)) * 10);

    const duplicate = await prisma.emergencyRequest.findFirst({
      where: { incidentId, type, status: { not: "REJECTED" } },
    });

    const createdRequest = await prisma.$transaction(async (tx) => {
      const req = await tx.emergencyRequest.create({
        data: {
          incidentId,
          type,
          quantity: quantity || 0,
          location,
          latitude: latitude || 0,
          longitude: longitude || 0,
          priority: priority || "MEDIUM",
          priorityScore,
          affectedPeople: affectedPeople || 0,
          description: description || null,
          status: duplicate ? "REJECTED" : "PENDING",
          duplicateFlag: !!duplicate,
        },
      });
      await tx.activityLog.create({
        data: { userId: user.id, action: "request_created", entityType: "EmergencyRequest", entityId: req.id, details: type },
      });
      return req;
    });

    return NextResponse.json(createdRequest, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed" }, { status: err.status || 400 });
  }
}
