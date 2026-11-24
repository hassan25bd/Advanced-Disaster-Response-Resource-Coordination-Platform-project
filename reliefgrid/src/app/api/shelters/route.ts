import { NextResponse } from "next/server";
import { requireAuth, requireRole } from "@/lib/api-auth";
import prisma from "@/lib/prisma";

export async function GET(req: Request) {
  try {
    await requireAuth();
    const { searchParams } = new URL(req.url);
    const page = Math.max(parseInt(searchParams.get("page") || "1", 10), 1);
    const pageSize = Math.min(Math.max(parseInt(searchParams.get("pageSize") || "10", 10), 1), 100);
    const status = searchParams.get("status") || undefined;

    const where: any = {};
    if (status) where.status = status;

    const [data, total] = await Promise.all([
      prisma.shelter.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { updatedAt: "desc" },
        include: { manager: { select: { id: true, name: true, email: true } }, occupancyLogs: { orderBy: { timestamp: "desc" }, take: 20 } },
      }),
      prisma.shelter.count({ where }),
    ]);

    return NextResponse.json({ data, total, page, pageSize });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Unauthorized" }, { status: err.status || 401 });
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireRole("SYSTEM_ADMIN", "EMERGENCY_COORDINATOR", "SHELTER_MANAGER");
    const body = await req.json();
    const { name, location, latitude, longitude, totalCapacity, facilities, status, managerId } = body || {};

    if (!name || !location || totalCapacity === undefined) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const shelter = await prisma.$transaction(async (tx) => {
      const s = await tx.shelter.create({
        data: {
          name,
          location,
          latitude: latitude || 0,
          longitude: longitude || 0,
          totalCapacity,
          currentOccupancy: 0,
          facilities: Array.isArray(facilities) ? facilities : [],
          status: status || "CLOSED",
          managerId: managerId || null,
        },
      });
      await tx.activityLog.create({ data: { userId: user.id, action: "shelter_created", entityType: "Shelter", entityId: s.id, details: name } });
      return s;
    });

    return NextResponse.json(shelter, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed" }, { status: err.status || 400 });
  }
}
