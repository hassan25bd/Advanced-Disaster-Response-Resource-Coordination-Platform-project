import "dotenv/config";
import { randomBytes, randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const organizationId = process.argv[2];
const mode = process.argv[3];
const connectionString = process.env.DATABASE_URL;

if (!organizationId || !["--dry-run", "--apply"].includes(mode || "")) {
  throw new Error("Usage: seed-organization-demo.mts <organization-id> --dry-run|--apply");
}
if (!connectionString) {
  throw new Error("DATABASE_URL must be supplied by the selected Vercel environment.");
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
const marker = `RGDEMO-${organizationId}`;
const emailPrefix = `rgdemo-${organizationId}`;
const makeId = () => randomUUID().replace(/-/g, "");
const randomInt = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;

const cities = [
  { name: "North Harbor", latitude: 22.5726, longitude: 88.3639 },
  { name: "Riverbend", latitude: 22.6, longitude: 88.4 },
  { name: "Westgate", latitude: 22.54, longitude: 88.3 },
  { name: "Hillside", latitude: 22.62, longitude: 88.43 },
  { name: "Old Town", latitude: 22.56, longitude: 88.38 },
  { name: "East Docks", latitude: 22.59, longitude: 88.41 },
  { name: "Green Valley", latitude: 22.53, longitude: 88.28 },
  { name: "Central District", latitude: 22.57, longitude: 88.35 },
];
const categories = [
  "FOOD_PACKAGES", "DRINKING_WATER", "MEDICAL_SUPPLIES", "EMERGENCY_KITS",
  "BLANKETS", "RESCUE_EQUIPMENT", "TRANSPORTATION",
] as const;
const resourceNames: Record<(typeof categories)[number], string[]> = {
  FOOD_PACKAGES: ["Rice Packages", "Lentil Packages", "Canned Food", "Dry Rations", "Instant Meals"],
  DRINKING_WATER: ["Bottled Water", "Purified Water Pouches", "Water Cans"],
  MEDICAL_SUPPLIES: ["First Aid Kits", "Bandages", "Medical Supply Kits", "Pain Relief Kits"],
  EMERGENCY_KITS: ["Emergency Kits", "Hygiene Kits", "Baby Care Kits"],
  BLANKETS: ["Wool Blankets", "Thermal Blankets", "Cotton Blankets"],
  RESCUE_EQUIPMENT: ["Rescue Rope Sets", "Life Jackets", "Stretchers", "Safety Helmets"],
  TRANSPORTATION: ["Relief Trucks", "Rescue Boats", "Emergency Vehicles"],
};
const units: Record<(typeof categories)[number], string> = {
  FOOD_PACKAGES: "packages", DRINKING_WATER: "liters", MEDICAL_SUPPLIES: "kits",
  EMERGENCY_KITS: "kits", BLANKETS: "pieces", RESCUE_EQUIPMENT: "sets", TRANSPORTATION: "vehicles",
};
const incidentCategories = ["FLOOD", "CYCLONE", "EARTHQUAKE", "FIRE", "LANDSLIDE", "INFRASTRUCTURE_FAILURE"] as const;
const incidentTitles: Record<(typeof incidentCategories)[number], string[]> = {
  FLOOD: ["River embankment breach", "Flash flooding in residential area", "Monsoon flood evacuation"],
  CYCLONE: ["Coastal cyclone preparedness", "Storm surge response", "High winds affecting settlements"],
  EARTHQUAKE: ["Structural damage assessment", "Earthquake response operation", "Aftershock safety check"],
  FIRE: ["Industrial fire response", "Residential fire evacuation", "Wildfire containment"],
  LANDSLIDE: ["Landslide blocking access road", "Slope failure near homes", "Mudslide evacuation support"],
  INFRASTRUCTURE_FAILURE: ["Bridge damage assessment", "Power grid disruption", "Water system failure"],
};
const requestTypes = ["FOOD", "WATER", "MEDICAL", "SHELTER", "RESCUE", "TRANSPORTATION"] as const;
const requestResources: Record<(typeof requestTypes)[number], (typeof categories)[number]> = {
  FOOD: "FOOD_PACKAGES", WATER: "DRINKING_WATER", MEDICAL: "MEDICAL_SUPPLIES",
  SHELTER: "EMERGENCY_KITS", RESCUE: "RESCUE_EQUIPMENT", TRANSPORTATION: "TRANSPORTATION",
};
const urgency = { LOW: 10, MEDIUM: 25, HIGH: 45, CRITICAL: 70 };
const priorities = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;
const statuses = ["REPORTED", "VERIFIED", "IN_PROGRESS", "RESOLVED"] as const;
const facilities = ["Kitchen", "Medical Clinic", "Water Supply", "Sanitation", "Electricity", "Storage", "Sleeping Area", "Security"];
type DemoUserSpec = {
  role: "EMERGENCY_COORDINATOR" | "SHELTER_MANAGER" | "VOLUNTEER";
  name: string;
  suffix: string;
  availabilityStatus?: "AVAILABLE" | "BUSY" | "OFF_DUTY";
  phone?: string;
};
type DemoRequestStatus = "PENDING" | "VERIFIED" | "ALLOCATED" | "IN_TRANSIT" | "COMPLETED" | "REJECTED";
type DemoAllocationStatus = "ASSIGNED" | "IN_TRANSIT" | "DELIVERED";
type DemoShelterStatus = "OPEN" | "FULL" | "CLOSED" | "MAINTENANCE";

function coordinates(index: number) {
  const city = cities[index % cities.length];
  return {
    city,
    latitude: city.latitude + (Math.random() - 0.5) * 0.05,
    longitude: city.longitude + (Math.random() - 0.5) * 0.05,
  };
}

function priorityScore(urgencyName: string, affected: number, risk: number, createdAt: Date) {
  const peopleWeight = Math.min(30, Math.round(Math.log10(Math.max(affected, 1)) * 8));
  const ageWeight = Math.min(30, Math.max(0, Math.floor((Date.now() - createdAt.getTime()) / 21600000)));
  return (urgency[urgencyName as keyof typeof urgency] || urgency.MEDIUM) + peopleWeight + risk * 10 + ageWeight;
}

function recentDate(maxDays = 30) {
  return new Date(Date.now() - randomInt(0, maxDays) * 86400000 - randomInt(0, 23) * 3600000);
}

async function main() {
  const organization = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { id: true, name: true },
  });
  if (!organization) throw new Error("Target organization was not found.");

  const actor = await prisma.user.findFirst({
    where: { organizationId, role: "RELIEF_ORGANIZATION", isActive: true },
    select: { id: true },
  });
  if (!actor) throw new Error("Target organization has no active relief-organization account.");

  const counts = await prisma.$transaction(async (tx) => {
    const [users, incidents, requests, resources, shelters, teams, tasks, allocations] = await Promise.all([
      tx.user.count({ where: { organizationId, email: { startsWith: emailPrefix } } }),
      tx.incident.count({ where: { reportedBy: { organizationId }, description: { contains: marker } } }),
      tx.emergencyRequest.count({ where: { incident: { reportedBy: { organizationId }, description: { contains: marker } } } }),
      tx.resource.count({ where: { organizationId, storageLocation: { startsWith: marker } } }),
      tx.shelter.count({ where: { name: { startsWith: marker }, manager: { organizationId } } }),
      tx.team.count({ where: { organizationId, name: { startsWith: marker } } }),
      tx.volunteerTask.count({ where: { title: { startsWith: marker } } }),
      tx.resourceAllocation.count({ where: { organizationId, request: { incident: { description: { contains: marker } } } } }),
    ]);
    return { users, incidents, requests, resources, shelters, teams, tasks, allocations };
  });
  const completed = await prisma.activityLog.findFirst({
    where: { action: "org_demo_dataset_created", entityType: "Organization", entityId: organizationId },
    select: { id: true },
  });

  if (mode === "--dry-run") {
    console.log(JSON.stringify({
      organization: organization.name,
      alreadySeeded: Boolean(completed),
      existingMarkedRecords: counts,
      planned: { incidents: 50, requests: 100, shelters: 20, volunteers: 100, resources: 500, teams: 12, tasks: 60, allocations: 40 },
    }, null, 2));
    return;
  }
  if (completed) throw new Error("This organization already has a completed demo dataset.");
  if (Object.values(counts).some((count) => count > 0)) {
    throw new Error("A partial marked dataset already exists; refusing to create duplicates.");
  }

  const now = new Date();
  const userSpecs: DemoUserSpec[] = [
    { role: "EMERGENCY_COORDINATOR" as const, name: "Demo Emergency Coordinator", suffix: "coordinator-001" },
    ...Array.from({ length: 5 }, (_, index) => ({
      role: "SHELTER_MANAGER" as const,
      name: `Demo Shelter Manager ${String(index + 1).padStart(2, "0")}`,
      suffix: `shelter-manager-${String(index + 1).padStart(3, "0")}`,
    })),
    ...Array.from({ length: 100 }, (_, index) => ({
      role: "VOLUNTEER" as const,
      name: `Demo Field Volunteer ${String(index + 1).padStart(3, "0")}`,
      suffix: `volunteer-${String(index + 1).padStart(3, "0")}`,
      availabilityStatus: (["AVAILABLE", "BUSY", "OFF_DUTY"] as const)[index % 3],
      phone: `+1-555-${String(100 + (index % 900)).padStart(3, "0")}-${String(1000 + (index % 9000)).padStart(4, "0")}`,
    })),
  ];
  const generatedUsers = await Promise.all(userSpecs.map(async (spec) => ({
    id: makeId(),
    name: spec.name,
    email: `${emailPrefix}-${spec.suffix}@example.invalid`,
    passwordHash: await bcrypt.hash(randomBytes(24).toString("base64url"), 10),
    role: spec.role,
    organizationId,
    availabilityStatus: spec.availabilityStatus || "OFF_DUTY",
    phone: spec.phone || null,
    isActive: true,
    createdAt: now,
  })));
  const coordinator = generatedUsers[0];
  const managers = generatedUsers.slice(1, 6);
  const volunteers = generatedUsers.slice(6);

  const incidentPlans = Array.from({ length: 50 }, (_, index) => {
    const category = incidentCategories[index % incidentCategories.length];
    const severity = priorities[(index * 3) % priorities.length];
    const location = coordinates(index);
    const affectedPopulation = randomInt(25, 4500);
    const locationRisk = 1 + (index % 5);
    const createdAt = recentDate();
    const status = statuses[(index * 5) % statuses.length];
    return {
      id: makeId(), category, severity, location, affectedPopulation, locationRisk, createdAt, status,
      title: `${incidentTitles[category][index % incidentTitles[category].length]} ${String(index + 1).padStart(2, "0")}`,
      description: `[${marker}] ${incidentTitles[category][index % incidentTitles[category].length]} affecting nearby residents; response teams are coordinating assessment and support.`,
      priorityScore: priorityScore(severity, affectedPopulation, locationRisk, createdAt),
    };
  });
  const requestPlans = Array.from({ length: 100 }, (_, index) => {
    const type = requestTypes[index % requestTypes.length];
    const priority = priorities[(index * 7) % priorities.length];
    const location = coordinates(index + 50);
    const affectedPeople = randomInt(8, 320);
    const createdAt = recentDate();
    const allocationStatus: DemoAllocationStatus | null = index < 40
      ? index < 10 ? "ASSIGNED" : index < 20 ? "IN_TRANSIT" : "DELIVERED"
      : null;
    const status: DemoRequestStatus = allocationStatus === "ASSIGNED" ? "ALLOCATED"
      : allocationStatus === "IN_TRANSIT" ? "IN_TRANSIT"
      : allocationStatus === "DELIVERED" ? "COMPLETED"
      : (["PENDING", "VERIFIED", "REJECTED"] as const)[index % 3];
    return {
      id: makeId(), type, priority, location, affectedPeople, createdAt, allocationStatus, status,
      quantity: randomInt(80, 320),
      description: `[${marker}] ${type.toLowerCase()} support requested for ${affectedPeople} affected people.`,
      priorityScore: priorityScore(priority, affectedPeople, 1 + (index % 5), createdAt),
      incidentId: incidentPlans[index % incidentPlans.length].id,
    };
  });
  const resourcePlans = Array.from({ length: 500 }, (_, index) => {
    const category = categories[index % categories.length];
    const location = coordinates(index + 100);
    const totalQuantity = randomInt(400, 1800);
    return {
      id: makeId(), category, location, totalQuantity,
      name: `${resourceNames[category][index % resourceNames[category].length]} ${String(index + 1).padStart(3, "0")}`,
      storageLocation: `${marker}: ${location.city.name} Warehouse ${1 + (index % 5)}`,
      unit: units[category],
    };
  });
  const resourceIdsByCategory = new Map<(typeof categories)[number], string[]>();
  for (const resource of resourcePlans) {
    const ids = resourceIdsByCategory.get(resource.category) || [];
    ids.push(resource.id);
    resourceIdsByCategory.set(resource.category, ids);
  }
  const categoryOffsets = new Map<(typeof categories)[number], number>();
  const allocationPlans = requestPlans.slice(0, 40).map((request, index) => {
    const category = requestResources[request.type];
    const offset = categoryOffsets.get(category) || 0;
    categoryOffsets.set(category, offset + 1);
    return {
      id: makeId(),
      requestId: request.id,
      resourceId: resourceIdsByCategory.get(category)![offset],
      allocatedQuantity: 10,
      status: request.allocationStatus!,
      qrVerificationCode: `RG-${randomUUID()}`,
      deliveredAt: request.allocationStatus === "DELIVERED" ? new Date() : null,
      notes: `${marker}: allocation ${index + 1}`,
    };
  });

  const shelterPlans = Array.from({ length: 20 }, (_, index) => {
    const location = coordinates(index + 150);
    const totalCapacity = randomInt(250, 1200);
    const status: DemoShelterStatus = index % 10 === 0 ? "CLOSED" : index % 7 === 0 ? "FULL" : index % 9 === 0 ? "MAINTENANCE" : "OPEN";
    const currentOccupancy = status === "CLOSED" ? 0
      : status === "FULL" ? totalCapacity
      : randomInt(50, Math.max(51, totalCapacity - 1));
    return {
      id: makeId(), location, totalCapacity, status, currentOccupancy,
      name: `${marker} ${location.city.name} Emergency Shelter ${String(index + 1).padStart(2, "0")}`,
      facilities: facilities.filter((_, facilityIndex) => (facilityIndex + index) % 3 !== 0),
      managerId: managers[index % managers.length].id,
    };
  });
  const teamPlans = Array.from({ length: 12 }, (_, index) => ({
    id: makeId(),
    name: `${marker} Response Team ${String(index + 1).padStart(2, "0")}`,
    organizationId,
    leaderId: volunteers[index].id,
    status: (["ACTIVE", "DEPLOYED", "STANDBY"] as const)[index % 3],
  }));
  const taskPlans = Array.from({ length: 60 }, (_, index) => {
    const location = coordinates(index + 200);
    const status = (["ASSIGNED", "ACCEPTED", "IN_PROGRESS", "COMPLETED"] as const)[index % 4];
    return {
      id: makeId(),
      title: `${marker} ${["Damage Assessment", "Supply Distribution", "Shelter Setup", "Medical Support", "Evacuation Support"][index % 5]} ${String(index + 1).padStart(2, "0")}`,
      description: "Support field response and report verified conditions to the assigned coordinator.",
      incidentId: incidentPlans[index % incidentPlans.length].id,
      teamId: teamPlans[index % teamPlans.length].id,
      volunteerId: volunteers[index % volunteers.length].id,
      location: location.city.name,
      latitude: location.latitude,
      longitude: location.longitude,
      status,
      fieldReport: status === "COMPLETED" ? "Field assignment completed; status and findings were recorded." : null,
      fieldPhotos: [],
      completedAt: status === "COMPLETED" ? now : null,
    };
  });

  await prisma.$transaction(async (tx) => {
    await tx.user.createMany({ data: generatedUsers });
    await tx.incident.createMany({
      data: incidentPlans.map((incident) => ({
        id: incident.id,
        title: incident.title,
        description: incident.description,
        category: incident.category,
        location: incident.location.city.name,
        latitude: incident.location.latitude,
        longitude: incident.location.longitude,
        severity: incident.severity,
        priorityScore: incident.priorityScore,
        affectedPopulation: incident.affectedPopulation,
        status: incident.status,
        reportedById: actor.id,
        coordinatorId: coordinator.id,
        createdAt: incident.createdAt,
        updatedAt: incident.createdAt,
      })),
    });
    await tx.incidentHistory.createMany({
      data: incidentPlans.flatMap((incident) => [
        { id: makeId(), incidentId: incident.id, action: "incident_reported", newValue: incident.status, changedById: actor.id, timestamp: incident.createdAt },
        { id: makeId(), incidentId: incident.id, action: "location_risk_assessed", newValue: String(incident.locationRisk), changedById: actor.id, timestamp: incident.createdAt },
        ...(incident.status !== "REPORTED"
          ? [{ id: makeId(), incidentId: incident.id, action: "status_changed", previousValue: "REPORTED", newValue: incident.status, changedById: coordinator.id, timestamp: new Date(incident.createdAt.getTime() + 3600000) }]
          : []),
      ]),
    });
    await tx.emergencyRequest.createMany({
      data: requestPlans.map((request) => ({
        id: request.id,
        incidentId: request.incidentId,
        type: request.type,
        quantity: request.quantity,
        location: request.location.city.name,
        latitude: request.location.latitude,
        longitude: request.location.longitude,
        priority: request.priority,
        priorityScore: request.priorityScore,
        affectedPeople: request.affectedPeople,
        description: request.description,
        status: request.status,
        createdAt: request.createdAt,
      })),
    });
    await tx.resource.createMany({
      data: resourcePlans.map((resource) => ({
        id: resource.id,
        organizationId,
        name: resource.name,
        category: resource.category,
        totalQuantity: resource.totalQuantity,
        availableQuantity: resource.totalQuantity,
        unit: resource.unit,
        storageLocation: resource.storageLocation,
        latitude: resource.location.latitude,
        longitude: resource.location.longitude,
      })),
    });
    await tx.resourceStockHistory.createMany({
      data: resourcePlans.map((resource) => ({
        id: makeId(), resourceId: resource.id, changeAmount: resource.totalQuantity,
        type: "RESTOCK", notes: `${marker}: initial stock registration`, timestamp: now,
      })),
    });
    await tx.shelter.createMany({
      data: shelterPlans.map((shelter) => ({
        id: shelter.id,
        name: shelter.name,
        location: shelter.location.city.name,
        latitude: shelter.location.latitude,
        longitude: shelter.location.longitude,
        totalCapacity: shelter.totalCapacity,
        currentOccupancy: shelter.currentOccupancy,
        facilities: shelter.facilities,
        status: shelter.status,
        managerId: shelter.managerId,
      })),
    });
    await tx.shelterOccupancyLog.createMany({
      data: shelterPlans.map((shelter) => ({
        id: makeId(),
        shelterId: shelter.id,
        previousOccupancy: 0,
        newOccupancy: shelter.currentOccupancy,
        notes: `${marker}: initial occupancy record`,
        updatedById: shelter.managerId,
        timestamp: now,
      })),
    });
    await tx.team.createMany({ data: teamPlans });
    await tx.volunteerTask.createMany({ data: taskPlans });
    await tx.resourceAllocation.createMany({
      data: allocationPlans.map((allocation) => ({
        id: allocation.id,
        requestId: allocation.requestId,
        resourceId: allocation.resourceId,
        organizationId,
        coordinatorId: coordinator.id,
        allocatedQuantity: allocation.allocatedQuantity,
        status: allocation.status,
        qrVerificationCode: allocation.qrVerificationCode,
        deliveredAt: allocation.deliveredAt,
      })),
    });
    await tx.resource.updateMany({
      where: { id: { in: allocationPlans.map((allocation) => allocation.resourceId) } },
      data: { availableQuantity: { decrement: 10 } },
    });
    await tx.resourceStockHistory.createMany({
      data: allocationPlans.map((allocation) => ({
        id: makeId(),
        resourceId: allocation.resourceId,
        changeAmount: -allocation.allocatedQuantity,
        type: "ALLOCATED",
        notes: allocation.notes,
        timestamp: now,
      })),
    });
    await tx.activityLog.createMany({
      data: [
        ...allocationPlans.map((allocation) => ({
          id: makeId(),
          userId: coordinator.id,
          action: "resource_allocated",
          entityType: "ResourceAllocation",
          entityId: allocation.id,
          details: `${marker}: allocated ${allocation.allocatedQuantity} units`,
          timestamp: now,
        })),
        {
          id: makeId(),
          userId: actor.id,
          action: "org_demo_dataset_created",
          entityType: "Organization",
          entityId: organizationId,
          details: "Created 50 incidents, 100 requests, 20 shelters, 100 volunteers, 500 resources, 12 teams, 60 tasks, and 40 allocations.",
          timestamp: now,
        },
      ],
    });
    await tx.notification.create({
      data: {
        id: makeId(),
        userId: actor.id,
        title: "Organization sample data is ready",
        message: "Demo incidents, requests, inventory, shelters, teams, tasks, and allocations were added to your organization.",
        type: "SYSTEM",
        link: "/dashboard",
      },
    });
  }, { maxWait: 15000, timeout: 120000 });

  console.log(JSON.stringify({
    organization: organization.name,
    created: { incidents: 50, requests: 100, shelters: 20, volunteers: 100, resources: 500, teams: 12, tasks: 60, allocations: 40 },
  }, null, 2));
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : "Organization demo seeding failed.");
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
