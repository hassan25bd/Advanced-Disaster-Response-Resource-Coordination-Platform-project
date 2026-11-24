import { NextResponse } from "next/server";
import { requireRole } from "@/lib/api-auth";
import prisma from "@/lib/prisma";

function orgFilter(user: any) {
  if (user.role === "SYSTEM_ADMIN") return {};
  return { organizationId: user.organizationId };
}

export async function GET(req: Request) {
  try {
    const user = await requireRole("SYSTEM_ADMIN", "EMERGENCY_COORDINATOR", "RELIEF_ORGANIZATION");
    if (user.role !== "SYSTEM_ADMIN" && !user.organizationId) {
      return NextResponse.json({ error: "No organization associated" }, { status: 403 });
    }
    const { searchParams } = new URL(req.url);
    const page = Math.max(parseInt(searchParams.get("page") || "1", 10), 1);
    const pageSize = Math.min(Math.max(parseInt(searchParams.get("pageSize") || "10", 10), 1), 100);
    const search = searchParams.get("search") || "";
    const category = searchParams.get("category") || undefined;

    const where: any = {
      ...orgFilter(user),
      ...(search ? { name: { contains: search, mode: "insensitive" } } : {}),
      ...(category ? { category } : {}),
    };

    const [data, total] = await Promise.all([
      prisma.resource.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { updatedAt: "desc" },
        include: { organization: { select: { id: true, name: true } } },
      }),
      prisma.resource.count({ where }),
    ]);

    return NextResponse.json({ data, total, page, pageSize });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Unauthorized" }, { status: err.status || 401 });
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireRole("SYSTEM_ADMIN", "EMERGENCY_COORDINATOR", "RELIEF_ORGANIZATION");
    const body = await req.json();
    const { name, category, totalQuantity, availableQuantity, unit, storageLocation, latitude, longitude } = body || {};

    if (typeof name !== "string" || !name.trim() || !category || totalQuantity === undefined) {
      return NextResponse.json({ error: "Name, category, and total quantity are required" }, { status: 400 });
    }

    const orgId = user.role === "RELIEF_ORGANIZATION"
      ? user.organizationId
      : (body.organizationId || user.organizationId);
    if (!orgId) return NextResponse.json({ error: "No organization associated" }, { status: 400 });
    if (user.role === "EMERGENCY_COORDINATOR" && orgId !== user.organizationId) {
      return NextResponse.json({ error: "You can only manage resources for your organization" }, { status: 403 });
    }
    if (!["FOOD_PACKAGES", "DRINKING_WATER", "MEDICAL_SUPPLIES", "EMERGENCY_KITS", "BLANKETS", "RESCUE_EQUIPMENT", "TRANSPORTATION"].includes(category)) {
      return NextResponse.json({ error: "Invalid resource category" }, { status: 400 });
    }
    if ((latitude !== undefined && (!Number.isFinite(latitude) || latitude < -90 || latitude > 90)) ||
        (longitude !== undefined && (!Number.isFinite(longitude) || longitude < -180 || longitude > 180))) {
      return NextResponse.json({ error: "Invalid resource coordinates" }, { status: 400 });
    }

    const available = availableQuantity !== undefined ? availableQuantity : totalQuantity;
    if (!Number.isSafeInteger(totalQuantity) || totalQuantity < 0 ||
        !Number.isSafeInteger(available) || available < 0 || available > totalQuantity) {
      return NextResponse.json({ error: "Quantities must be non-negative integers and available quantity cannot exceed total quantity" }, { status: 400 });
    }

    const resource = await prisma.$transaction(async (tx) => {
      const r = await tx.resource.create({
        data: {
          organizationId: orgId,
          name,
          category,
          totalQuantity,
          availableQuantity: available,
          unit: unit || "units",
          storageLocation: storageLocation || "",
          latitude: latitude || 0,
          longitude: longitude || 0,
        },
      });
      await tx.resourceStockHistory.create({
        data: { resourceId: r.id, changeAmount: available, type: "RESTOCK", notes: "Initial stock registration", timestamp: new Date() },
      });
      await tx.activityLog.create({ data: { userId: user.id, action: "resource_created", entityType: "Resource", entityId: r.id, details: name } });
      return r;
    });

    return NextResponse.json(resource, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed" }, { status: err.status || 400 });
  }
}
