import { NextResponse } from "next/server";
import { requireRole, requireAuth } from "@/lib/api-auth";
import prisma from "@/lib/prisma";

function orgFilter(user: any) {
  if (user.role === "SYSTEM_ADMIN") return {};
  return { id: user.organizationId };
}

export async function GET(req: Request) {
  try {
    const user = await requireAuth();
    const { searchParams } = new URL(req.url);
    const page = Math.max(parseInt(searchParams.get("page") || "1", 10), 1);
    const pageSize = Math.min(Math.max(parseInt(searchParams.get("pageSize") || "10", 10), 1), 100);
    const search = searchParams.get("search") || "";

    const where = {
      ...orgFilter(user),
      ...(search ? { name: { contains: search, mode: "insensitive" as const } } : {}),
    };

    const [data, total] = await Promise.all([
      prisma.organization.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: "desc" },
        include: { _count: { select: { users: true, resources: true, allocations: true, teams: true } } },
      }),
      prisma.organization.count({ where }),
    ]);

    return NextResponse.json({ data, total, page, pageSize });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Unauthorized" }, { status: err.status || 401 });
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireRole("SYSTEM_ADMIN");
    const body = await req.json();
    const { name, type, registrationNo, contactEmail, address } = body || {};

    if (!name || !registrationNo) {
      return NextResponse.json({ error: "Name and registration number are required" }, { status: 400 });
    }

    const org = await prisma.organization.create({
      data: { name, type: type || "", registrationNo, contactEmail: contactEmail || "", address: address || "" },
    });
    return NextResponse.json(org, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Forbidden" }, { status: err.status || 403 });
  }
}
