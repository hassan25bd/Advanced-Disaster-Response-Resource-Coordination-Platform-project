import { NextResponse } from "next/server";
import { requireAuth, requireRole } from "@/lib/api-auth";
import prisma from "@/lib/prisma";
import { demoDataWhere, isDemoAccount } from "@/lib/demo-data";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const user = await requireAuth();
    const organizationScope = user.role === "RELIEF_ORGANIZATION" && user.organizationId
      ? { manager: { organizationId: user.organizationId } }
      : user.role === "SHELTER_MANAGER" ? { managerId: user.id } : undefined;
    const where = {
      id,
      ...(["RELIEF_ORGANIZATION", "SHELTER_MANAGER", "VOLUNTEER"].includes(user.role)
        ? { OR: [...(organizationScope ? [organizationScope] : []), demoDataWhere.shelter] }
        : {}),
    };
    const shelter = await prisma.shelter.findFirst({
      where,
      include: { manager: { select: { id: true, name: true, email: true } }, occupancyLogs: { orderBy: { timestamp: "desc" } } },
    });
    if (!shelter) return NextResponse.json({ error: "Shelter not found" }, { status: 404 });
    const isDemo = shelter.name.startsWith("RGDEMO-");
    if (!isDemo && user.role === "SHELTER_MANAGER" && shelter.managerId !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.json({ ...shelter, isDemo });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Unauthorized" }, { status: err.status || 401 });
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const user = await requireRole("SYSTEM_ADMIN", "EMERGENCY_COORDINATOR", "SHELTER_MANAGER");
    const shelter = await prisma.shelter.findUnique({ where: { id } });
    if (!shelter) return NextResponse.json({ error: "Shelter not found" }, { status: 404 });
    if (shelter.name.startsWith("RGDEMO-")) {
      return NextResponse.json({ error: "Shared demo records are read-only" }, { status: 409 });
    }

    if (user.role === "SHELTER_MANAGER" && shelter.managerId !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const { name, location, latitude, longitude, totalCapacity, currentOccupancy, facilities, status, managerId } = body || {};
    const updates: any = {};
    if (name !== undefined && (typeof name !== "string" || !name.trim())) {
      return NextResponse.json({ error: "Shelter name cannot be empty" }, { status: 400 });
    }
    if (typeof name === "string" && name.trim().startsWith("RGDEMO-")) {
      return NextResponse.json({ error: "This prefix is reserved for shared demo records" }, { status: 400 });
    }
    if (location !== undefined && (typeof location !== "string" || !location.trim())) {
      return NextResponse.json({ error: "Shelter location cannot be empty" }, { status: 400 });
    }
    if (name !== undefined) updates.name = name.trim();
    if (location !== undefined) updates.location = location.trim();
    if (latitude !== undefined) updates.latitude = latitude;
    if (longitude !== undefined) updates.longitude = longitude;
    if (totalCapacity !== undefined) updates.totalCapacity = totalCapacity;
    if (facilities !== undefined) updates.facilities = facilities;
    if (status !== undefined) updates.status = status;
    if (managerId !== undefined) {
      if (user.role === "SHELTER_MANAGER") {
        return NextResponse.json({ error: "Only administrators and coordinators can change the shelter manager" }, { status: 403 });
      }
      if (managerId) {
        const manager = await prisma.user.findFirst({
          where: { id: managerId, role: "SHELTER_MANAGER", isActive: true },
          select: { id: true, email: true },
        });
        if (!manager) return NextResponse.json({ error: "Select an active shelter manager" }, { status: 400 });
        if (isDemoAccount(manager.email)) {
          return NextResponse.json({ error: "Shared demo accounts cannot manage live shelters" }, { status: 409 });
        }
      }
      updates.managerId = managerId;
    }
    if ((latitude !== undefined && (!Number.isFinite(latitude) || latitude < -90 || latitude > 90)) ||
        (longitude !== undefined && (!Number.isFinite(longitude) || longitude < -180 || longitude > 180)) ||
        (facilities !== undefined && (!Array.isArray(facilities) || facilities.some((facility) => typeof facility !== "string"))) ||
        (status !== undefined && !["OPEN", "FULL", "CLOSED", "MAINTENANCE"].includes(status))) {
      return NextResponse.json({ error: "Invalid shelter details" }, { status: 400 });
    }

    if (totalCapacity !== undefined && (!Number.isSafeInteger(totalCapacity) || totalCapacity < 0)) {
      return NextResponse.json({ error: "Capacity must be a non-negative integer" }, { status: 400 });
    }
    if (currentOccupancy !== undefined && (!Number.isSafeInteger(currentOccupancy) || currentOccupancy < 0)) {
      return NextResponse.json({ error: "Occupancy must be a non-negative integer" }, { status: 400 });
    }
    const newOccupancy = currentOccupancy !== undefined ? currentOccupancy : shelter.currentOccupancy;
    const newCapacity = totalCapacity !== undefined ? totalCapacity : shelter.totalCapacity;
    if (newOccupancy > newCapacity) {
      return NextResponse.json({ error: "Occupancy exceeds shelter capacity" }, { status: 400 });
    }
    if (currentOccupancy !== undefined) {
      updates.currentOccupancy = currentOccupancy;
    }

    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.shelter.updateMany({
        where: {
          id,
          totalCapacity: shelter.totalCapacity,
          currentOccupancy: shelter.currentOccupancy,
          managerId: shelter.managerId,
        },
        data: updates,
      });
      if (result.count !== 1) {
        const error = new Error("Shelter changed; reload and try again") as Error & { status: number };
        error.status = 409;
        throw error;
      }
      const s = await tx.shelter.findUniqueOrThrow({ where: { id } });
      if (currentOccupancy !== undefined && currentOccupancy !== shelter.currentOccupancy) {
        await tx.shelterOccupancyLog.create({
          data: {
            shelterId: id,
            previousOccupancy: shelter.currentOccupancy,
            newOccupancy: currentOccupancy,
            notes: "Occupancy updated",
            updatedById: user.id,
            timestamp: new Date(),
          },
        });
      }
      await tx.activityLog.create({ data: { userId: user.id, action: "shelter_updated", entityType: "Shelter", entityId: id, details: name || shelter.name } });
      return s;
    });

    return NextResponse.json(updated);
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed" }, { status: err.status || 400 });
  }
}
