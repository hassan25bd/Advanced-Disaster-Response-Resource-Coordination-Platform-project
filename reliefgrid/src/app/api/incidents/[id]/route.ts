import { NextResponse } from "next/server";
import { requireAuth, requireRole } from "@/lib/api-auth";
import prisma from "@/lib/prisma";
import { calculateIncidentPriority, getLocationRiskScore } from "@/lib/priority";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const user = await requireAuth();
    const incident = await prisma.incident.findUnique({
      where: { id },
      include: {
        reportedBy: { select: { id: true, name: true, email: true, organizationId: true } },
        coordinator: { select: { id: true, name: true, email: true } },
        history: { include: { changedBy: { select: { id: true, name: true } } }, orderBy: { timestamp: "desc" } },
        requests: { include: { allocations: {
          where: user.role === "RELIEF_ORGANIZATION" ? { organizationId: user.organizationId! } : {},
          include: { resource: true, organization: true },
        } } },
        tasks: {
          where: user.role === "RELIEF_ORGANIZATION" ? { team: { organizationId: user.organizationId! } } : {},
          include: { volunteer: { select: { id: true, name: true } }, team: true },
        },
      },
    });
    if (!incident) return NextResponse.json({ error: "Incident not found" }, { status: 404 });
    if (user.role === "RELIEF_ORGANIZATION" &&
        (!user.organizationId || incident.reportedBy.organizationId !== user.organizationId)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const locationRiskScore = getLocationRiskScore(incident.history.filter((entry) => entry.action === "location_risk_assessed"));
    return NextResponse.json({
      ...incident,
      locationRiskScore,
      priorityScore: calculateIncidentPriority({ ...incident, locationRiskScore }),
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Unauthorized" }, { status: err.status || 401 });
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const user = await requireAuth();
    const incident = await prisma.incident.findUnique({
      where: { id },
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
    if (user.role === "RELIEF_ORGANIZATION" &&
        (!user.organizationId || incident.reportedBy.organizationId !== user.organizationId)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (!isAdmin && !isCoordinator && incident.reportedById !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const { title, description, category, location, latitude, longitude, severity, affectedPopulation, status, imageUrl, coordinatorId, locationRiskScore } = body || {};
    if (body && Object.prototype.hasOwnProperty.call(body, "priorityScore")) {
      return NextResponse.json({ error: "Priority score is calculated by the server" }, { status: 400 });
    }
    if (locationRiskScore !== undefined &&
        ((!isAdmin && !isCoordinator) || !Number.isInteger(locationRiskScore) || locationRiskScore < 0 || locationRiskScore > 5)) {
      return NextResponse.json({ error: "Location risk must be assessed by a coordinator or administrator on a scale from 0 to 5" }, { status: 400 });
    }
    if (!isAdmin && !isCoordinator &&
        ["category", "severity", "affectedPopulation", "status", "coordinatorId"].some((field) => body?.[field] !== undefined)) {
      return NextResponse.json({ error: "Only coordinators and administrators can change operational incident fields" }, { status: 403 });
    }

    const updates: any = {};
    const historyEntries: any[] = [];
    const track = (field: string, prev: any, next: any, action: string) => {
      if (prev !== undefined && prev !== next) {
        historyEntries.push({ incidentId: id, action, previousValue: String(prev), newValue: String(next), changedById: user.id });
      }
      if (next !== undefined) updates[field] = next;
    };

    track("title", incident.title, title, "title_updated");
    track("description", incident.description, description, "description_updated");
    track("category", incident.category, category, "category_updated");
    track("location", incident.location, location, "location_updated");
    track("severity", incident.severity, severity, "severity_changed");
    const currentRiskScore = getLocationRiskScore(incident.history);
    if (locationRiskScore !== undefined && locationRiskScore !== currentRiskScore) {
      historyEntries.push({
        incidentId: id,
        action: "location_risk_assessed",
        previousValue: String(currentRiskScore),
        newValue: String(locationRiskScore),
        changedById: user.id,
      });
    }
    track("affectedPopulation", incident.affectedPopulation, affectedPopulation, "affected_population_updated");
    track("status", incident.status, status, "status_changed");
    track("coordinatorId", incident.coordinatorId, coordinatorId, "coordinator_assigned");
    if (imageUrl !== undefined) updates.imageUrl = imageUrl;
    if (latitude !== undefined) updates.latitude = latitude;
    if (longitude !== undefined) updates.longitude = longitude;
    if (severity !== undefined || affectedPopulation !== undefined || locationRiskScore !== undefined) {
      updates.priorityScore = calculateIncidentPriority({
        severity: severity ?? incident.severity,
        affectedPopulation: affectedPopulation ?? incident.affectedPopulation,
        locationRiskScore: locationRiskScore ?? currentRiskScore,
        createdAt: incident.createdAt,
      });
      if (updates.priorityScore !== incident.priorityScore) {
        historyEntries.push({
          incidentId: id,
          action: "priority_recalculated",
          previousValue: String(incident.priorityScore),
          newValue: String(updates.priorityScore),
          changedById: user.id,
        });
      }
    }

    const result = await prisma.$transaction(async (tx) => {
      const inc = await tx.incident.update({ where: { id }, data: updates });
      for (const h of historyEntries) {
        await tx.incidentHistory.create({ data: h });
      }
      await tx.activityLog.create({
        data: { userId: user.id, action: "incident_updated", entityType: "Incident", entityId: id, details: Object.keys(updates).join(",") },
      });
      return inc;
    });

    return NextResponse.json({ ...result, locationRiskScore: locationRiskScore ?? currentRiskScore });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed" }, { status: err.status || 400 });
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await requireRole("SYSTEM_ADMIN");
    await prisma.incident.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Forbidden" }, { status: err.status || 403 });
  }
}
