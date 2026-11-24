import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import prisma from "@/lib/prisma";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await requireAuth();
    const request = await prisma.emergencyRequest.findUnique({
      where: { id },
      include: {
        incident: true,
        allocations: { include: { resource: true, organization: true, coordinator: true } },
      },
    });
    if (!request) return NextResponse.json({ error: "Request not found" }, { status: 404 });
    return NextResponse.json(request);
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Unauthorized" }, { status: err.status || 401 });
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const user = await requireAuth();
    const request = await prisma.emergencyRequest.findUnique({ where: { id } });
    if (!request) return NextResponse.json({ error: "Request not found" }, { status: 404 });

    const isAdmin = user.role === "SYSTEM_ADMIN";
    const isCoordinator = user.role === "EMERGENCY_COORDINATOR";
    const isOrg = user.role === "RELIEF_ORGANIZATION";
    if (!isAdmin && !isCoordinator && !isOrg) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const { priority, priorityScore, status, description } = body || {};

    const updates: any = {};
    const historyEntries: any[] = [];
    const track = (field: string, prev: any, next: any, action: string) => {
      if (prev !== undefined && prev !== next) {
        historyEntries.push({ incidentId: request.incidentId, action, previousValue: String(prev), newValue: String(next), changedById: user.id });
      }
      if (next !== undefined) updates[field] = next;
    };

    track("priority", request.priority, priority, "priority_changed");
    track("priorityScore", request.priorityScore, priorityScore, "priority_changed");
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
