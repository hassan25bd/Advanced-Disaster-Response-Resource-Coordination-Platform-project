import { NextResponse } from "next/server";
import { requireAuth, requireRole } from "@/lib/api-auth";
import prisma from "@/lib/prisma";

function orgFilter(user: any) {
  if (user.role === "SYSTEM_ADMIN") return {};
  return { organizationId: user.organizationId };
}

export async function GET(req: Request) {
  try {
    const user = await requireAuth();
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

    if (!name || !category || totalQuantity === undefined) {
      return NextResponse.json({ error: "Name, category, and total quantity are required" }, { status: 400 });
    }

    const orgId = user.role === "SYSTEM_ADMIN" ? (body.organizationId || user.organizationId) : user.organizationId;
    if (!orgId) return NextResponse.json({ error: "No organization associated" }, { status: 400 });

    const available = availableQuantity !== undefined ? availableQuantity : totalQuantity;

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
        data: { resourceId: r.id, changeAmount: totalQuantity, type: "RESTOCK", notes: "Initial stock registration", timestamp: new Date() },
      });
      await tx.activityLog.create({ data: { userId: user.id, action: "resource_created", entityType: "Resource", entityId: r.id, details: name } });
      return r;
    });

    return NextResponse.json(resource, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed" }, { status: err.status || 400 });
  }
}
