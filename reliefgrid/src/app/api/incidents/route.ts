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
    const category = searchParams.get("category") || undefined;
    const severity = searchParams.get("severity") || undefined;
    const status = searchParams.get("status") || undefined;

    const where: any = {
      ...(search ? { title: { contains: search, mode: "insensitive" } } : {}),
      ...(category ? { category } : {}),
      ...(severity ? { severity } : {}),
      ...(status ? { status } : {}),
    };

    if (user.role === "RELIEF_ORGANIZATION") {
      where.reportedById = user.id;
    } else if (user.role === "EMERGENCY_COORDINATOR") {
      where.OR = [{ coordinatorId: user.id }, { status: "REPORTED" }];
    } else if (user.role === "VOLUNTEER") {
      where.status = { in: ["VERIFIED", "IN_PROGRESS", "RESOLVED"] };
    }

    const [data, total] = await Promise.all([
      prisma.incident.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: [{ priorityScore: "desc" }, { createdAt: "desc" }],
        include: {
          reportedBy: { select: { id: true, name: true, email: true } },
          coordinator: { select: { id: true, name: true, email: true } },
          _count: { select: { requests: true, history: true } },
        },
      }),
      prisma.incident.count({ where }),
    ]);

    return NextResponse.json({ data, total, page, pageSize });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Unauthorized" }, { status: err.status || 401 });
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireAuth();
    const body = await req.json();
    const { title, description, category, location, latitude, longitude, severity, affectedPopulation, imageUrl } = body || {};

    if (!title || !description || !category || !location) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const incident = await prisma.$transaction(async (tx) => {
      const inc = await tx.incident.create({
        data: {
          title,
          description,
          category,
          location,
          latitude: latitude || 0,
          longitude: longitude || 0,
          severity: severity || "MEDIUM",
          affectedPopulation: affectedPopulation || 0,
          imageUrl: imageUrl || null,
          reportedById: user.id,
        },
      });
      await tx.incidentHistory.create({
        data: { incidentId: inc.id, action: "incident_reported", previousValue: null, newValue: "REPORTED", changedById: user.id },
      });
      await tx.activityLog.create({
        data: { userId: user.id, action: "incident_reported", entityType: "Incident", entityId: inc.id, details: title },
      });
      return inc;
    });

    return NextResponse.json(incident, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed" }, { status: err.status || 400 });
  }
}
