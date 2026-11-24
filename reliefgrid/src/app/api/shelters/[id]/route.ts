import { NextResponse } from "next/server";
import { requireAuth, requireRole } from "@/lib/api-auth";
import prisma from "@/lib/prisma";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await requireAuth();
    const shelter = await prisma.shelter.findUnique({
      where: { id },
      include: { manager: true, occupancyLogs: { orderBy: { timestamp: "desc" } } },
    });
    if (!shelter) return NextResponse.json({ error: "Shelter not found" }, { status: 404 });
    return NextResponse.json(shelter);
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

    if (user.role !== "SYSTEM_ADMIN" && shelter.managerId !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const { name, location, latitude, longitude, totalCapacity, currentOccupancy, facilities, status, managerId } = body || {};
    const updates: any = {};
    if (name !== undefined) updates.name = name;
    if (location !== undefined) updates.location = location;
    if (latitude !== undefined) updates.latitude = latitude;
    if (longitude !== undefined) updates.longitude = longitude;
    if (totalCapacity !== undefined) updates.totalCapacity = totalCapacity;
    if (facilities !== undefined) updates.facilities = facilities;
    if (status !== undefined) updates.status = status;
    if (managerId !== undefined) updates.managerId = managerId;

    let newOccupancy = shelter.currentOccupancy;
    if (currentOccupancy !== undefined) {
      if (currentOccupancy < 0) return NextResponse.json({ error: "Occupancy cannot be negative" }, { status: 400 });
      if (currentOccupancy > (totalCapacity !== undefined ? totalCapacity : shelter.totalCapacity)) {
        return NextResponse.json({ error: "Occupancy exceeds shelter capacity" }, { status: 400 });
      }
      newOccupancy = currentOccupancy;
      updates.currentOccupancy = currentOccupancy;
    }

    const updated = await prisma.$transaction(async (tx) => {
      const s = await tx.shelter.update({ where: { id }, data: updates });
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
