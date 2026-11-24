import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import prisma from "@/lib/prisma";
import { calculateIncidentPriority, getLocationRiskScore } from "@/lib/priority";

export async function GET(req: Request) {
  try {
    const user = await requireAuth();
    const { searchParams } = new URL(req.url);
    const requestedPage = Number(searchParams.get("page") || 1);
    const page = Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
    const requestedPageSize = Number(searchParams.get("pageSize") || 10);
    const pageSize = Number.isInteger(requestedPageSize) ? Math.min(Math.max(requestedPageSize, 1), 100) : 10;
    const search = searchParams.get("search")?.trim() || "";
    const category = searchParams.get("category") || undefined;
    const severity = searchParams.get("severity") || undefined;
    const status = searchParams.get("status") || undefined;

    const where: any = {
      ...(category ? { category } : {}),
      ...(severity ? { severity } : {}),
      ...(status ? { status } : {}),
    };

    if (search) {
      where.AND = [...(where.AND || []), { OR: [
        { title: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
        { location: { contains: search, mode: "insensitive" } },
      ] }];
    }

    if (user.role === "RELIEF_ORGANIZATION") {
      if (!user.organizationId) return NextResponse.json({ error: "No organization associated" }, { status: 403 });
      where.reportedBy = { organizationId: user.organizationId };
    } else if (user.role === "EMERGENCY_COORDINATOR") {
      where.AND = [...(where.AND || []), { OR: [{ coordinatorId: user.id }, { status: "REPORTED" }] }];
    } else if (user.role === "VOLUNTEER") {
      where.status = { in: ["VERIFIED", "IN_PROGRESS", "RESOLVED"] };
    }

    const candidates = await prisma.incident.findMany({
      where,
      select: {
        id: true, severity: true, affectedPopulation: true, createdAt: true,
        history: {
          where: { action: "location_risk_assessed" },
          orderBy: { timestamp: "desc" },
          take: 1,
          select: { newValue: true },
        },
      },
    });
    const ranked = candidates.map((incident) => ({
      id: incident.id,
      score: calculateIncidentPriority({ ...incident, locationRiskScore: getLocationRiskScore(incident.history) }),
      locationRiskScore: getLocationRiskScore(incident.history),
      createdAt: incident.createdAt,
    })).sort((a, b) => b.score - a.score || a.createdAt.getTime() - b.createdAt.getTime());
    const total = ranked.length;
    const pageItems = ranked.slice((page - 1) * pageSize, page * pageSize);
    const pageData = pageItems.length ? await prisma.incident.findMany({
      where: { id: { in: pageItems.map((item) => item.id) } },
      include: {
        reportedBy: { select: { id: true, name: true, email: true } },
        coordinator: { select: { id: true, name: true, email: true } },
        _count: { select: { requests: true, history: true } },
      },
    }) : [];
    const dataById = new Map(pageData.map((incident) => [incident.id, incident]));
    const data = pageItems.flatMap((item) => {
      const incident = dataById.get(item.id);
      return incident ? [{ ...incident, priorityScore: item.score, locationRiskScore: item.locationRiskScore }] : [];
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
    const { title, description, category, location, latitude, longitude, severity, affectedPopulation, imageUrl, locationRiskScore } = body || {};

    if (typeof title !== "string" || !title.trim() || typeof description !== "string" || !description.trim() ||
        typeof location !== "string" || !location.trim() ||
        !["FLOOD", "CYCLONE", "EARTHQUAKE", "FIRE", "LANDSLIDE", "INFRASTRUCTURE_FAILURE"].includes(category) ||
        !["LOW", "MEDIUM", "HIGH", "CRITICAL"].includes(severity) ||
        !Number.isSafeInteger(affectedPopulation) || affectedPopulation < 0 ||
        (latitude !== undefined && (!Number.isFinite(latitude) || latitude < -90 || latitude > 90)) ||
        (longitude !== undefined && (!Number.isFinite(longitude) || longitude < -180 || longitude > 180)) ||
        (locationRiskScore !== undefined && (!Number.isInteger(locationRiskScore) || locationRiskScore < 0 || locationRiskScore > 5))) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }
    if (locationRiskScore !== undefined && !["SYSTEM_ADMIN", "EMERGENCY_COORDINATOR"].includes(user.role)) {
      return NextResponse.json({ error: "Only coordinators and administrators can assess location risk" }, { status: 403 });
    }

    const incident = await prisma.$transaction(async (tx) => {
      const createdAt = new Date();
      const riskScore = locationRiskScore ?? 0;
      const inc = await tx.incident.create({
        data: {
          title,
          description,
          category,
          location,
          latitude: latitude ?? 0,
          longitude: longitude ?? 0,
          severity,
          affectedPopulation,
          priorityScore: calculateIncidentPriority({ severity, affectedPopulation, locationRiskScore: riskScore, createdAt }, createdAt),
          createdAt,
          imageUrl: imageUrl || null,
          reportedById: user.id,
        },
      });
      await tx.incidentHistory.createMany({ data: [
        { incidentId: inc.id, action: "incident_reported", previousValue: null, newValue: "REPORTED", changedById: user.id },
        { incidentId: inc.id, action: "location_risk_assessed", previousValue: null, newValue: String(riskScore), changedById: user.id },
      ] });
      await tx.activityLog.create({
        data: { userId: user.id, action: "incident_reported", entityType: "Incident", entityId: inc.id, details: title },
      });
      return inc;
    });

    return NextResponse.json(incident, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed" }, { status: err.status || 400 });
  }
}
