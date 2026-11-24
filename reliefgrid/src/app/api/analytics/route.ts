import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import prisma from "@/lib/prisma";

export async function GET(req: Request) {
  try {
    await requireAuth();
    const { searchParams } = new URL(req.url);
    const range = searchParams.get("range") || "30d";
    const days = range === "7d" ? 7 : range === "90d" ? 90 : 30;
    const from = new Date(Date.now() - days * 86400000);

    const [
      activeIncidents,
      totalAffected,
      pendingRequests,
      availableResources,
      activeShelters,
      volunteerAvailability,
      categoryDist,
      requestTrends,
      resourceDist,
    ] = await Promise.all([
      prisma.incident.count({ where: { status: { in: ["REPORTED", "VERIFIED", "IN_PROGRESS"] } } }),
      prisma.incident.aggregate({ where: {}, _sum: { affectedPopulation: true } }),
      prisma.emergencyRequest.count({ where: { status: "PENDING" } }),
      prisma.resource.aggregate({ where: {}, _sum: { availableQuantity: true } }),
      prisma.shelter.count({ where: { status: "OPEN" } }),
      prisma.user.count({ where: { role: "VOLUNTEER", availabilityStatus: "AVAILABLE" } }),
      prisma.incident.groupBy({ by: ["category"], _count: true }),
      prisma.emergencyRequest.groupBy({ by: ["createdAt"], _count: true, where: { createdAt: { gte: from } } }),
      prisma.resource.groupBy({ by: ["category"], _sum: { availableQuantity: true } }),
    ]);

    return NextResponse.json({
      activeIncidents,
      totalAffected: totalAffected._sum.affectedPopulation || 0,
      pendingRequests,
      availableResources: availableResources._sum.availableQuantity || 0,
      activeShelters,
      volunteerAvailability,
      avgResponseTime: null,
      categoryDist,
      requestTrends,
      resourceDist,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Unauthorized" }, { status: err.status || 401 });
  }
}
