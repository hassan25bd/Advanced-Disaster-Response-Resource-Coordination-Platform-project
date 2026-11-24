import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import prisma from "@/lib/prisma";

export async function GET(req: Request) {
  try {
    const user = await requireAuth();
    const { searchParams } = new URL(req.url);
    const page = Math.max(parseInt(searchParams.get("page") || "1", 10), 1);
    const pageSize = Math.min(Math.max(parseInt(searchParams.get("pageSize") || "10", 10), 1), 100);
    const search = searchParams.get("search") || "";
    const role = searchParams.get("role") || undefined;
    const organizationId = searchParams.get("organizationId") || undefined;
    const availabilityStatus = searchParams.get("availabilityStatus") || undefined;
    const isActive = searchParams.get("isActive");
    const roles = ["SYSTEM_ADMIN", "EMERGENCY_COORDINATOR", "RELIEF_ORGANIZATION", "VOLUNTEER", "SHELTER_MANAGER"];
    const availabilityStatuses = ["AVAILABLE", "BUSY", "OFF_DUTY"];
    if ((role && !roles.includes(role)) ||
        (availabilityStatus && !availabilityStatuses.includes(availabilityStatus))) {
      return NextResponse.json({ error: "Invalid user filter" }, { status: 400 });
    }

    const isAdmin = user.role === "SYSTEM_ADMIN";
    const where: any = {
      ...(search ? { OR: [
        { name: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
      ] } : {}),
      ...(role ? { role } : {}),
      ...(availabilityStatus ? { availabilityStatus } : {}),
      ...(isActive === "true" || isActive === "false" ? { isActive: isActive === "true" } : {}),
    };

    if (isAdmin) {
      if (organizationId) where.organizationId = organizationId;
    } else if (user.role === "EMERGENCY_COORDINATOR" || user.role === "RELIEF_ORGANIZATION") {
      where.organizationId = user.organizationId;
    } else {
      where.id = user.id;
    }

    const [data, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: "desc" },
        select: {
          id: true, name: true, email: true, role: true, organizationId: true,
          phone: true, availabilityStatus: true, isActive: true, createdAt: true,
          organization: { select: { id: true, name: true } },
          _count: { select: { incidents: true, allocations: true, teamsLed: true, tasks: true } },
        },
      }),
      prisma.user.count({ where }),
    ]);

    return NextResponse.json({ data, total, page, pageSize });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Unauthorized" }, { status: err.status || 401 });
  }
}
