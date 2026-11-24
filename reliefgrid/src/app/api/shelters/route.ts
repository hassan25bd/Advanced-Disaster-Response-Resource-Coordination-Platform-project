import { NextResponse } from "next/server";
import { requireRole } from "@/lib/api-auth";
import prisma from "@/lib/prisma";

export async function GET(req: Request) {
  try {
    const user = await requireRole("SYSTEM_ADMIN", "EMERGENCY_COORDINATOR", "RELIEF_ORGANIZATION", "SHELTER_MANAGER");
    const { searchParams } = new URL(req.url);
    const page = Math.max(parseInt(searchParams.get("page") || "1", 10), 1);
    const pageSize = Math.min(Math.max(parseInt(searchParams.get("pageSize") || "10", 10), 1), 100);
    const status = searchParams.get("status") || undefined;
    const search = searchParams.get("search")?.trim() || "";

    if (user.role === "RELIEF_ORGANIZATION" && !user.organizationId) {
      return NextResponse.json({ error: "No organization associated" }, { status: 403 });
    }
    const where: any = user.role === "SHELTER_MANAGER"
      ? { managerId: user.id }
      : user.role === "RELIEF_ORGANIZATION"
        ? { manager: { organizationId: user.organizationId } }
        : {};
    if (status) where.status = status;
    if (search) where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { location: { contains: search, mode: "insensitive" } },
    ];

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

    if (typeof name !== "string" || !name.trim() || typeof location !== "string" || !location.trim() || totalCapacity === undefined) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }
    if (!Number.isSafeInteger(totalCapacity) || totalCapacity < 0) {
      return NextResponse.json({ error: "Capacity must be a non-negative integer" }, { status: 400 });
    }
    if (user.role === "SHELTER_MANAGER" && managerId && managerId !== user.id) {
      return NextResponse.json({ error: "Shelter managers cannot assign another manager" }, { status: 403 });
    }
    if ((latitude !== undefined && (!Number.isFinite(latitude) || latitude < -90 || latitude > 90)) ||
        (longitude !== undefined && (!Number.isFinite(longitude) || longitude < -180 || longitude > 180)) ||
        (status !== undefined && !["OPEN", "FULL", "CLOSED", "MAINTENANCE"].includes(status)) ||
        (facilities !== undefined && (!Array.isArray(facilities) || facilities.some((facility) => typeof facility !== "string")))) {
      return NextResponse.json({ error: "Invalid shelter details" }, { status: 400 });
    }
    if (managerId && user.role !== "SHELTER_MANAGER") {
      const manager = await prisma.user.findFirst({
        where: { id: managerId, role: "SHELTER_MANAGER", isActive: true },
        select: { id: true },
      });
      if (!manager) return NextResponse.json({ error: "Select an active shelter manager" }, { status: 400 });
    }

    const shelter = await prisma.$transaction(async (tx) => {
      const s = await tx.shelter.create({
        data: {
          name: name.trim(),
          location: location.trim(),
          latitude: latitude || 0,
          longitude: longitude || 0,
          totalCapacity,
          currentOccupancy: 0,
          facilities: Array.isArray(facilities) ? facilities : [],
          status: status || "CLOSED",
          managerId: user.role === "SHELTER_MANAGER" ? user.id : managerId || null,
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
