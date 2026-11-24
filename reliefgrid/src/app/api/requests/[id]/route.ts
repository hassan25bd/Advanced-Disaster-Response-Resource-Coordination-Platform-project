import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import prisma from "@/lib/prisma";
import { calculateRequestPriority, getLocationRiskScore } from "@/lib/priority";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const user = await requireAuth();
    if (user.role === "RELIEF_ORGANIZATION" && !user.organizationId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const request = await prisma.emergencyRequest.findUnique({
      where: { id },
      include: {
        incident: {
          include: {
            reportedBy: { select: { organizationId: true } },
            history: {
              where: { action: "location_risk_assessed" },
              orderBy: { timestamp: "desc" },
              take: 1,
              select: { newValue: true },
            },
          },
        },
        allocations: {
          where: user.role === "RELIEF_ORGANIZATION" ? { organizationId: user.organizationId! } : {},
          include: { resource: true, organization: true, coordinator: { select: { id: true, name: true } } },
        },
      },
    });
    if (!request) return NextResponse.json({ error: "Request not found" }, { status: 404 });
    const isDemo = request.incident.description.startsWith("[RGDEMO-");
    if (!isDemo && user.role === "RELIEF_ORGANIZATION" &&
        request.incident.reportedBy.organizationId !== user.organizationId &&
        !request.allocations.some((allocation) => allocation.organizationId === user.organizationId)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.json({
      ...request,
      isDemo,
      priorityScore: calculateRequestPriority({
        priority: request.priority,
        affectedPeople: request.affectedPeople,
        locationRiskScore: getLocationRiskScore(request.incident.history),
        createdAt: request.createdAt,
      }),
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Unauthorized" }, { status: err.status || 401 });
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const user = await requireAuth();
    const request = await prisma.emergencyRequest.findUnique({
      where: { id },
      include: {
        incident: {
          select: {
            description: true,
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
    if (!request) return NextResponse.json({ error: "Request not found" }, { status: 404 });
    if (request.incident.description.startsWith("[RGDEMO-")) {
      return NextResponse.json({ error: "Shared demo records are read-only" }, { status: 409 });
    }

    const isAdmin = user.role === "SYSTEM_ADMIN";
    const isCoordinator = user.role === "EMERGENCY_COORDINATOR";
    const isOrg = user.role === "RELIEF_ORGANIZATION";
    if (!isAdmin && !isCoordinator && !isOrg) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (isOrg) {
      const assigned = user.organizationId && await prisma.resourceAllocation.findFirst({
        where: { requestId: id, organizationId: user.organizationId },
        select: { id: true },
      });
      if (!assigned) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const { priority, status, description } = body || {};
    if (body && Object.prototype.hasOwnProperty.call(body, "priorityScore")) {
      return NextResponse.json({ error: "Priority score is calculated by the server" }, { status: 400 });
    }
    if (isOrg && (priority !== undefined || status !== undefined)) {
      return NextResponse.json({ error: "Only administrators and coordinators can change request priority or status" }, { status: 403 });
    }
    if ((priority !== undefined && !["LOW", "MEDIUM", "HIGH", "CRITICAL"].includes(priority)) ||
        (status !== undefined && !["PENDING", "VERIFIED", "ALLOCATED", "IN_TRANSIT", "COMPLETED", "REJECTED"].includes(status)) ||
        (description !== undefined && (typeof description !== "string" || !description.trim()))) {
      return NextResponse.json({ error: "Invalid request update" }, { status: 400 });
    }

    const updates: any = {};
    const historyEntries: any[] = [];
    const track = (field: string, prev: any, next: any, action: string) => {
      if (next !== undefined && prev !== next) {
        historyEntries.push({ incidentId: request.incidentId, action, previousValue: String(prev), newValue: String(next), changedById: user.id });
      }
      if (next !== undefined) updates[field] = next;
    };

    track("priority", request.priority, priority, "priority_changed");
    if (priority !== undefined && priority !== request.priority) {
      const score = calculateRequestPriority({
        priority,
        affectedPeople: request.affectedPeople,
        locationRiskScore: getLocationRiskScore(request.incident.history),
        createdAt: request.createdAt,
      });
      track("priorityScore", request.priorityScore, score, "priority_recalculated");
    }
    track("status", request.status, status, "status_changed");
    if (description !== undefined) updates.description = description;

    const result = await prisma.$transaction(async (tx) => {
      const r = await tx.emergencyRequest.update({ where: { id }, data: updates });
      for (const h of historyEntries) {
        await tx.incidentHistory.create({ data: h });
      }
      await tx.activityLog.create({
        data: { userId: user.id, action: "request_updated", entityType: "EmergencyRequest", entityId: id, details: Object.keys(updates).join(",") },
      });
      return r;
    });

    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed" }, { status: err.status || 400 });
  }
}
