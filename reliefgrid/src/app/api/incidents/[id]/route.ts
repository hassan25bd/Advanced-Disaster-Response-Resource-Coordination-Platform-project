import { NextResponse } from "next/server";
import { requireAuth, requireRole } from "@/lib/api-auth";
import prisma from "@/lib/prisma";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await requireAuth();
    const incident = await prisma.incident.findUnique({
      where: { id },
      include: {
        reportedBy: { select: { id: true, name: true, email: true } },
        coordinator: { select: { id: true, name: true, email: true } },
        history: { include: { changedBy: { select: { id: true, name: true } } }, orderBy: { timestamp: "desc" } },
        requests: { include: { allocations: { include: { resource: true, organization: true } } } },
        tasks: { include: { volunteer: { select: { id: true, name: true } }, team: true } },
      },
    });
    if (!incident) return NextResponse.json({ error: "Incident not found" }, { status: 404 });
    return NextResponse.json(incident);
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Unauthorized" }, { status: err.status || 401 });
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const user = await requireAuth();
    const incident = await prisma.incident.findUnique({ where: { id } });
    if (!incident) return NextResponse.json({ error: "Incident not found" }, { status: 404 });

    const isAdmin = user.role === "SYSTEM_ADMIN";
    const isCoordinator = user.role === "EMERGENCY_COORDINATOR";
    if (!isAdmin && !isCoordinator && incident.reportedById !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const { title, description, category, location, latitude, longitude, severity, priorityScore, affectedPopulation, status, imageUrl, coordinatorId } = body || {};

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
    track("priorityScore", incident.priorityScore, priorityScore, "priority_changed");
    track("affectedPopulation", incident.affectedPopulation, affectedPopulation, "affected_population_updated");
    track("status", incident.status, status, "status_changed");
    track("coordinatorId", incident.coordinatorId, coordinatorId, "coordinator_assigned");
    if (imageUrl !== undefined) updates.imageUrl = imageUrl;
    if (latitude !== undefined) updates.latitude = latitude;
    if (longitude !== undefined) updates.longitude = longitude;

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

    return NextResponse.json(result);
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
