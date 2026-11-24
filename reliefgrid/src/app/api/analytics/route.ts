import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import prisma from "@/lib/prisma";
import { demoDataWhere } from "@/lib/demo-data";

export async function GET(req: Request) {
  try {
    const user = await requireAuth();
    const { searchParams } = new URL(req.url);
    const range = searchParams.get("range") || "30d";
    const days = range === "7d" ? 7 : range === "90d" ? 90 : 30;
    const from = new Date(Date.now() - days * 86400000);

    const organizationScope = user.role === "RELIEF_ORGANIZATION" ? user.organizationId : undefined;
    const incidentWhere = user.role === "RELIEF_ORGANIZATION" ? {
      OR: [
        ...(organizationScope ? [
          { reportedBy: { organizationId: organizationScope } },
          { requests: { some: { allocations: { some: { organizationId: organizationScope } } } } },
        ] : []),
        demoDataWhere.incident,
      ],
    } : {};
    const requestWhere = user.role === "RELIEF_ORGANIZATION" ? {
      OR: [
        ...(organizationScope ? [
          { incident: { reportedBy: { organizationId: organizationScope } } },
          { allocations: { some: { organizationId: organizationScope } } },
        ] : []),
        demoDataWhere.request,
      ],
    } : {};
    const resourceWhere = user.role === "RELIEF_ORGANIZATION" ? {
      OR: [
        ...(organizationScope ? [{ organizationId: organizationScope }] : []),
        demoDataWhere.resource,
      ],
    } : {};
    const shelterWhere = user.role === "RELIEF_ORGANIZATION" ? {
      OR: [
        ...(organizationScope ? [{ manager: { organizationId: organizationScope } }] : []),
        demoDataWhere.shelter,
      ],
    } : {};
    const volunteerWhere = {
      role: "VOLUNTEER" as const,
      availabilityStatus: "AVAILABLE" as const,
      ...(user.role === "RELIEF_ORGANIZATION" ? {
        AND: [{
          OR: [
            ...(organizationScope ? [{ organizationId: organizationScope }] : []),
            demoDataWhere.volunteer,
          ],
        }],
      } : {}),
    };

    const [
      activeIncidents,
      totalAffected,
      pendingRequests,
      availableResources,
      activeShelters,
      volunteerAvailability,
      categoryDist,
      requestTrendRows,
      resourceDist,
      responseHistory,
      demoRequests,
      demoResources,
      demoShelters,
      demoVolunteers,
      demoTeams,
      demoTasks,
      demoAllocations,
    ] = await Promise.all([
      prisma.incident.count({ where: { ...incidentWhere, status: { in: ["REPORTED", "VERIFIED", "IN_PROGRESS"] } } }),
      prisma.incident.aggregate({ where: incidentWhere, _sum: { affectedPopulation: true } }),
      prisma.emergencyRequest.count({ where: { ...requestWhere, status: "PENDING" } }),
      prisma.resource.aggregate({ where: resourceWhere, _sum: { availableQuantity: true } }),
      prisma.shelter.count({ where: { ...shelterWhere, status: "OPEN" } }),
      prisma.user.count({ where: volunteerWhere }),
      prisma.incident.groupBy({ by: ["category"], _count: true, where: incidentWhere }),
      prisma.emergencyRequest.findMany({
        where: { ...requestWhere, createdAt: { gte: from } },
        select: { createdAt: true },
      }),
      prisma.resource.groupBy({ by: ["category"], _sum: { availableQuantity: true }, where: resourceWhere }),
      prisma.incidentHistory.findMany({
        where: {
          action: "status_changed",
          newValue: { in: ["VERIFIED", "IN_PROGRESS", "RESOLVED"] },
          timestamp: { gte: from },
          incident: incidentWhere,
        },
        select: { incidentId: true, timestamp: true },
        orderBy: { timestamp: "asc" },
      }),
      prisma.emergencyRequest.count({ where: demoDataWhere.request }),
      prisma.resource.count({ where: demoDataWhere.resource }),
      prisma.shelter.count({ where: demoDataWhere.shelter }),
      prisma.user.count({ where: demoDataWhere.volunteer }),
      prisma.team.count({ where: demoDataWhere.team }),
      prisma.volunteerTask.count({ where: demoDataWhere.task }),
      prisma.resourceAllocation.count({ where: demoDataWhere.allocation }),
    ]);

    const dailyRequestCounts = new Map<string, number>();
    for (const request of requestTrendRows) {
      const day = request.createdAt.toISOString().slice(0, 10);
      dailyRequestCounts.set(day, (dailyRequestCounts.get(day) || 0) + 1);
    }
    const requestTrends = Array.from({ length: days }, (_, index) => {
      const date = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate() + index));
      const day = date.toISOString().slice(0, 10);
      return { createdAt: day, _count: dailyRequestCounts.get(day) || 0 };
    });

    const firstResponseByIncident = new Map<string, Date>();
    for (const entry of responseHistory) {
      if (!firstResponseByIncident.has(entry.incidentId)) firstResponseByIncident.set(entry.incidentId, entry.timestamp);
    }
    const respondedIncidents = firstResponseByIncident.size
      ? await prisma.incident.findMany({
        where: { id: { in: Array.from(firstResponseByIncident.keys()) } },
        select: { id: true, createdAt: true },
      })
      : [];
    const incidentCreatedAt = new Map(respondedIncidents.map((incident) => [incident.id, incident.createdAt]));
    const responseTimes = Array.from(firstResponseByIncident, ([incidentId, firstResponse]) => {
      const createdAt = incidentCreatedAt.get(incidentId);
      return createdAt ? Math.max(0, firstResponse.getTime() - createdAt.getTime()) / 60000 : null;
    }).filter((minutes): minutes is number => minutes !== null);
    const avgResponseTime = responseTimes.length
      ? Math.round(responseTimes.reduce((total, minutes) => total + minutes, 0) / responseTimes.length)
      : null;

    return NextResponse.json({
      activeIncidents,
      totalAffected: totalAffected._sum.affectedPopulation || 0,
      pendingRequests,
      availableResources: availableResources._sum.availableQuantity || 0,
      activeShelters,
      volunteerAvailability,
      avgResponseTime,
      categoryDist,
      requestTrends,
      resourceDist,
      demoCounts: {
        requests: demoRequests,
        resources: demoResources,
        shelters: demoShelters,
        volunteers: demoVolunteers,
        teams: demoTeams,
        tasks: demoTasks,
        allocations: demoAllocations,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Unauthorized" }, { status: err.status || 401 });
  }
}
