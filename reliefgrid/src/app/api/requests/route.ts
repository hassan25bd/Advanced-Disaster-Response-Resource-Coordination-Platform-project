import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import prisma from "@/lib/prisma";
import { calculateRequestPriority, getLocationRiskScore } from "@/lib/priority";

export async function GET(req: Request) {
  try {
    const user = await requireAuth();
    const { searchParams } = new URL(req.url);
    const requestedPage = Number(searchParams.get("page") || 1);
    const page = Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
    const requestedPageSize = Number(searchParams.get("pageSize") || 10);
    const pageSize = Number.isInteger(requestedPageSize) ? Math.min(Math.max(requestedPageSize, 1), 100) : 10;
    const search = searchParams.get("search")?.trim() || "";
    const type = searchParams.get("type") || undefined;
    const priority = searchParams.get("priority") || undefined;
    const status = searchParams.get("status") || undefined;

    const where: any = {
      ...(type ? { type } : {}),
      ...(priority ? { priority } : {}),
      ...(status ? { status } : {}),
    };

    if (user.role === "RELIEF_ORGANIZATION") {
      if (!user.organizationId) return NextResponse.json({ error: "No organization associated" }, { status: 403 });
      where.AND = [...(where.AND || []), { OR: [
        { incident: { reportedBy: { organizationId: user.organizationId } } },
        { allocations: { some: { organizationId: user.organizationId } } },
      ] }];
    }

    if (search) {
      where.AND = [...(where.AND || []), { OR: [
        { description: { contains: search, mode: "insensitive" } },
        { location: { contains: search, mode: "insensitive" } },
        { incident: { title: { contains: search, mode: "insensitive" } } },
        { incident: { location: { contains: search, mode: "insensitive" } } },
      ] }];
    }

    const candidates = await prisma.emergencyRequest.findMany({
      where,
      select: {
        id: true, priority: true, affectedPeople: true, createdAt: true,
        incident: {
          select: {
            history: {
              where: { action: "location_risk_assessed" },
              orderBy: { timestamp: "desc" },
              take: 1,
              select: { newValue: true },
            },
          },
        },
      },
    });
    const ranked = candidates.map((request) => ({
      id: request.id,
      score: calculateRequestPriority({
        priority: request.priority,
        affectedPeople: request.affectedPeople,
        locationRiskScore: getLocationRiskScore(request.incident.history),
        createdAt: request.createdAt,
      }),
      createdAt: request.createdAt,
    })).sort((a, b) => b.score - a.score || a.createdAt.getTime() - b.createdAt.getTime());
    const total = ranked.length;
    const pageItems = ranked.slice((page - 1) * pageSize, page * pageSize);
    const pageData = pageItems.length ? await prisma.emergencyRequest.findMany({
      where: { id: { in: pageItems.map((item) => item.id) } },
      include: {
        incident: { select: { id: true, title: true, category: true, severity: true, location: true } },
        allocations: {
          where: user.role === "RELIEF_ORGANIZATION" ? { organizationId: user.organizationId! } : {},
          include: { resource: true, organization: true },
        },
      },
    }) : [];
    const dataById = new Map(pageData.map((request) => [request.id, request]));
    const data = pageItems.flatMap((item) => {
      const request = dataById.get(item.id);
      return request ? [{ ...request, priorityScore: item.score }] : [];
    });

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

    if (typeof incidentId !== "string" || !incidentId || typeof location !== "string" || !location.trim()) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }
    if (!["FOOD", "WATER", "MEDICAL", "SHELTER", "RESCUE", "TRANSPORTATION"].includes(type) ||
        !["LOW", "MEDIUM", "HIGH", "CRITICAL"].includes(priority) ||
        !Number.isInteger(quantity) || quantity < 1 || quantity > 2147483647 ||
        !Number.isInteger(affectedPeople) || affectedPeople < 0 || affectedPeople > 2147483647 ||
        (latitude !== undefined && (typeof latitude !== "number" || !Number.isFinite(latitude) || latitude < -90 || latitude > 90)) ||
        (longitude !== undefined && (typeof longitude !== "number" || !Number.isFinite(longitude) || longitude < -180 || longitude > 180)) ||
        typeof description !== "string" || !description.trim()) {
      return NextResponse.json({ error: "Invalid request details" }, { status: 400 });
    }

    const incident = await prisma.incident.findUnique({
      where: { id: incidentId },
      include: {
        reportedBy: { select: { organizationId: true } },
        history: {
          where: { action: "location_risk_assessed" },
          orderBy: { timestamp: "desc" },
          take: 1,
          select: { newValue: true },
        },
      },
    });
    if (!incident) return NextResponse.json({ error: "Incident not found" }, { status: 404 });

    const isAdmin = user.role === "SYSTEM_ADMIN";
    const isCoordinator = user.role === "EMERGENCY_COORDINATOR";
    const isOrg = user.role === "RELIEF_ORGANIZATION";
    if (!isAdmin && !isCoordinator && !isOrg) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (isOrg && (!user.organizationId || incident.reportedBy.organizationId !== user.organizationId)) {
      return NextResponse.json({ error: "Organizations may create requests only for incidents reported by their organization" }, { status: 403 });
    }

    const createdAt = new Date();
    const priorityScore = calculateRequestPriority({
      priority,
      affectedPeople,
      locationRiskScore: getLocationRiskScore(incident.history),
      createdAt,
    }, createdAt);

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
          latitude: latitude ?? incident.latitude,
          longitude: longitude ?? incident.longitude,
          priority: priority || "MEDIUM",
          priorityScore,
          affectedPeople: affectedPeople || 0,
          description: description || null,
          status: duplicate ? "REJECTED" : "PENDING",
          duplicateFlag: !!duplicate,
          createdAt,
        },
      });
      await tx.activityLog.create({
        data: { userId: user.id, action: "request_created", entityType: "EmergencyRequest", entityId: req.id, details: type },
      });
      if (!duplicate) {
        const coordinators = await tx.user.findMany({
          where: { role: "EMERGENCY_COORDINATOR", isActive: true },
          select: { id: true },
        });
        if (coordinators.length) {
          await tx.notification.createMany({
            data: coordinators.map((coordinator) => ({
              userId: coordinator.id,
              title: "New emergency request",
              message: `${type} assistance is requested at ${location}.`,
              type: "REQUEST_CREATED",
              link: `/requests/${req.id}`,
            })),
          });
        }
      }
      return req;
    });

    return NextResponse.json(createdRequest, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed" }, { status: err.status || 400 });
  }
}
