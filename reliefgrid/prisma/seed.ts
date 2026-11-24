import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import bcrypt from "bcryptjs";

const connectionString = process.env.DATABASE_URL!;
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

const DEFAULT_DEMO_PASSWORD = "ReliefGrid@2026";
const PASSWORD =
  process.env.NODE_ENV === "production"
    ? process.env.SEED_PASSWORD
    : process.env.SEED_PASSWORD ?? DEFAULT_DEMO_PASSWORD;

if (!PASSWORD) {
  throw new Error("SEED_PASSWORD must be set before seeding in production.");
}

const CITIES = [
  { name: "North Harbor", lat: 22.5726, lng: 88.3639 },
  { name: "Riverbend", lat: 22.6000, lng: 88.4000 },
  { name: "Westgate", lat: 22.5400, lng: 88.3000 },
  { name: "Hillside", lat: 22.6200, lng: 88.4300 },
  { name: "Old Town", lat: 22.5600, lng: 88.3800 },
  { name: "East Docks", lat: 22.5900, lng: 88.4100 },
  { name: "Green Valley", lat: 22.5300, lng: 88.2800 },
  { name: "Central District", lat: 22.5700, lng: 88.3500 },
];

const ORGANIZATIONS = [
  { name: "Global Relief Foundation", type: "International NGO", registrationNo: "GRF-2024-001", contactEmail: "contact@grf.org", address: "123 Aid Street, Central District" },
  { name: "Red Crescent Society", type: "National Society", registrationNo: "RCS-2024-002", contactEmail: "ops@redcrescent.org", address: "45 Humanity Avenue, Riverbend" },
  { name: "Humanitarian Aid Network", type: "Non-profit", registrationNo: "HAN-2024-003", contactEmail: "info@han.org", address: "78 Mercy Road, Westgate" },
  { name: "Rapid Response Teams", type: "Private Contractor", registrationNo: "RRT-2024-004", contactEmail: "dispatch@rrt.org", address: "91 Swift Lane, East Docks" },
  { name: "Community Resilience Group", type: "Community-based", registrationNo: "CRG-2024-005", contactEmail: "coord@crg.org", address: "55 Unity Plaza, Hillside" },
];

const FIRST_NAMES = ["James","Mary","Robert","Patricia","John","Jennifer","Michael","Linda","David","Elizabeth","William","Barbara","Richard","Susan","Joseph","Jessica","Thomas","Sarah","Charles","Karen","Christopher","Nancy","Daniel","Lisa","Matthew","Betty","Anthony","Sandra","Mark","Ashley","Donald","Dorothy","Steven","Kimberly","Paul","Emily","Andrew","Donna","Joshua","Michelle","Kevin","Carol","Brian","Amanda","George","Melissa","Timothy","Deborah","Jason","Rebecca","Jeffrey","Sharon","Ryan","Cynthia","Jacob","Kathleen","Gary","Amy","Nicholas","Shirley","Eric","Angela","Jonathan","Brenda","Stephen","Pamela","Larry","Nicole","Justin","Emma","Scott","Samantha","Brandon","Catherine","Benjamin","Janet","Samuel","Rachel","Gregory","Carolyn","Frank","Heather","Raymond","Diane","Alexander","Julie","Patrick","Joyce","Dennis","Victoria","Tyler","Kelly","Aaron","Christina","Jose","Joan","Adam","Olivia","Henry","Lauren","Douglas","Martha","Zachary","Alice","Peter","Gloria","Kyle","Victoria","Walter","Joan","Harold","Evelyn","Carl","Judith","Jeremy","Megan","Keith","Cheryl","Larry","Andrea","Raymond","Hannah","Willie","Donna","Dennis","Sara","Gerald","Kathryn"];
const LAST_NAMES = ["Smith","Johnson","Williams","Brown","Jones","Garcia","Miller","Davis","Rodriguez","Martinez","Hernandez","Lopez","Gonzalez","Wilson","Anderson","Thomas","Taylor","Moore","Jackson","Martin","Lee","Perez","Thompson","White","Sanchez","Clark","Ramirez","Lewis","Robinson","Walker","Young","Allen","King","Wright","Scott","Torres","Nguyen","Flores","Edwards","Collins","Stewart","Sanchez","Morris","Rogers","Reed","Cook","Morgan","Bell","Murphy","Bailey","Rivera","Cooper","Richardson","Cox","Howard","Ward","Patterson","Hughes","Flores","Washington","Butler","Simmons","Foster","Gonzalez","Bryant","Alexander","Russell","Griffin","Diaz","Hayes","Myers","Ford","Hamilton","Graham","Sullivan","Wallace","Woods","Cole","West","Jordan","Owens","Reynolds","Fisher","Ellis","Harrison","Gibson","McDonald","Cruz","Marshall","Ortiz","Gomez","Murray","Freeman","Wells","Webb","Simpson","Stevens","Tucker","Porter","Hunter","Hicks","Crawford","Henry","Boyd","Mason","Morales","Kennedy","Warren","Dixon","Ramos","Reyes","Burns","Gordon","Shaw","Holmes","Rice","Robertson","Hunt","Black","Daniels","Palmer","Mills","Nichols","Grant","Knight","Ferguson","Rose","Stone","Hawkins","Dunn","Perkins","Hudson","Spencer","Gardner","Stephens","Payne","Pierce","Berry","Matthews","Arnold","Wagner","Willis","Ray","Watkins","Olson","Carroll","Duncan","Snyder","Hart","Cunningham","Bradley","Lane","Andrews","Ruiz","Harper","Fox","Riley","Armstrong","Carpenter","Weaver","Greene","Lawrence","Elliott","Chavez","Sims","Austin","Peters","Kelley","Franklin","Lawson","Fields","Gutierrez","Ryan","Schmidt","Carr","Vasquez","Castillo","Wheeler","Chapman","Oliver","Montgomery","Richards","Williamson","Johnston","Banks","Meyer","Bishop","McCoy","Howell","Alvarez","Morrison","Hansen","Fernandez","Garcia","Harvey","Little","Burton","Stanley","Nguyen","George","Jacobs","Reid","Kim","Fuller","Lynch","Dean","Gilbert","Garrett","Romero","Welch","Larson","Frazier","Burke","Hanson","Day","Mendoza","Moreno","Bowman","Medina","Fowler","Brewer","Hoffman","Carlson","Silva","Pearson","Holland","Douglas","Fleming","Jensen","Vargas","Byrd","Davidson","Hopkins","May","Terry","Herrera","Wade","Soto","Walters","Curtis","Neal","Caldwell","Lowe","Jennings","Barnett","Perez","Snyder"];

function rand(arr: string[]) { return arr[Math.floor(Math.random() * arr.length)]; }
function randInt(min: number, max: number) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function randFloat(min: number, max: number) { return Math.random() * (max - min) + min; }
function pickCity() { const c = rand(CITIES); return { ...c, lat: c.lat + randFloat(-0.03, 0.03), lng: c.lng + randFloat(-0.03, 0.03) }; }

const INCIDENT_TITLES = {
  FLOOD: ["Flash Flooding in North Harbor", "River Embankment Breach", "Monsoon Flood Alert", "Urban Flooding - Riverbend", "Dam Overflow Risk"],
  CYCLONE: ["Cyclone Approaching Coast", "Severe Cyclone Warning", "Cyclone Landfall Response", "Storm Surge Alert", "High Winds - East Docks"],
  EARTHQUAKE: ["Earthquake Tremors Reported", "Seismic Activity - Hillside", "Building Stability Concern", "Aftershock Monitoring", "Earthquake Impact Assessment"],
  FIRE: ["Wildfire Near Green Valley", "Industrial Fire - Westgate", "Residential Building Fire", "Forest Fire Spread", "Fire in Old Town Market"],
  LANDSLIDE: ["Landslide Blocking Highway", "Hillside Slope Failure", "Mudslide in Hillside", "Rockfall Risk", "Landslide Shelter Evacuation"],
  INFRASTRUCTURE_FAILURE: ["Bridge Structural Failure", "Power Grid Outage", "Water Main Burst", "Communication Tower Down", "Road Collapse - Central District"],
};
const INCIDENT_DESCRIPTIONS = {
  FLOOD: ["Heavy rainfall has caused flash flooding affecting multiple neighborhoods.", "River water levels rising rapidly; embankment at risk of breach.", "Residential areas inundated; evacuation underway."],
  CYCLONE: ["Cyclone system approaching coastal regions with high wind speeds.", "Storm surge expected; coastal shelters being prepared.", "High winds damaging infrastructure; response teams on standby."],
  EARTHQUAKE: ["Moderate earthquake tremors felt across the district.", "Structural damage reported in several buildings.", "Search and rescue teams deployed to affected zones."],
  FIRE: ["Fire spreading rapidly through dry vegetation; evacuation advised.", "Industrial facility fire; hazardous materials team responding.", "Multi-story building fire; occupants evacuated."],
  LANDSLIDE: ["Heavy rain triggered landslide blocking main access road.", "Unstable slope posing risk to nearby homes.", "Mudslide debris clearing operations in progress."],
  INFRASTRUCTURE_FAILURE: ["Critical infrastructure failure disrupting essential services.", "Bridge damage restricting emergency vehicle access.", "Power outage affecting hospitals and shelters."],
};

async function main() {
  const hash = await bcrypt.hash(PASSWORD, 10);

  // Organizations
  const orgs = await Promise.all(ORGANIZATIONS.map(o =>
    prisma.organization.create({ data: o })
  ));
  console.log(`Created ${orgs.length} organizations`);

  // Demo users
  const demoUsers = [
    { name: "System Administrator", email: "admin@reliefgrid.org", role: "SYSTEM_ADMIN" as const, org: null },
    { name: "Emergency Coordinator", email: "coordinator@reliefgrid.org", role: "EMERGENCY_COORDINATOR" as const, org: orgs[0] },
    { name: "Relief Organization User", email: "organization@reliefgrid.org", role: "RELIEF_ORGANIZATION" as const, org: orgs[1] },
    { name: "Volunteer Responder", email: "volunteer@reliefgrid.org", role: "VOLUNTEER" as const, org: orgs[2] },
    { name: "Shelter Manager", email: "shelter@reliefgrid.org", role: "SHELTER_MANAGER" as const, org: orgs[3] },
  ];

  const users: any[] = [];
  for (const d of demoUsers) {
    const u = await prisma.user.create({
      data: { name: d.name, email: d.email, passwordHash: hash, role: d.role, organizationId: d.org?.id, isActive: true },
    });
    users.push(u);
    await prisma.notification.create({
      data: { userId: u.id, title: "Welcome to ReliefGrid", message: `Welcome ${d.name}, your account is ready.`, type: "system", isRead: false },
    });
  }

  // Additional staff users
  const staffRoles: ("EMERGENCY_COORDINATOR" | "RELIEF_ORGANIZATION" | "SHELTER_MANAGER")[] = [
    "EMERGENCY_COORDINATOR","EMERGENCY_COORDINATOR","RELIEF_ORGANIZATION","RELIEF_ORGANIZATION","SHELTER_MANAGER","SHELTER_MANAGER","SHELTER_MANAGER",
  ];
  let orgIdx = 0;
  for (const role of staffRoles) {
    const org = orgs[orgIdx % orgs.length];
    orgIdx++;
    const u = await prisma.user.create({
      data: {
        name: `${rand(FIRST_NAMES)} ${rand(LAST_NAMES)}`,
        email: `staff${users.length}@reliefgrid.org`,
        passwordHash: hash,
        role,
        organizationId: org.id,
        isActive: true,
      },
    });
    users.push(u);
  }

  // 100 Volunteers
  const volunteers: any[] = [];
  for (let i = 0; i < 100; i++) {
    const org = orgs[randInt(0, orgs.length - 1)];
    const u = await prisma.user.create({
      data: {
        name: `${rand(FIRST_NAMES)} ${rand(LAST_NAMES)}`,
        email: `volunteer${i + 1}@reliefgrid.org`,
        passwordHash: hash,
        role: "VOLUNTEER",
        organizationId: org.id,
        availabilityStatus: ["AVAILABLE","BUSY","OFF_DUTY"][randInt(0, 2)],
        phone: `+1-555-${randInt(100,999)}-${randInt(1000,9999)}`,
        isActive: true,
      },
    });
    volunteers.push(u);
  }
  console.log(`Created ${volunteers.length} volunteers`);

  // 50 Incidents
  const incidents: any[] = [];
  const now = new Date();
  const categories = Object.values({ FLOOD: "FLOOD", CYCLONE: "CYCLONE", EARTHQUAKE: "EARTHQUAKE", FIRE: "FIRE", LANDSLIDE: "LANDSLIDE", INFRASTRUCTURE_FAILURE: "INFRASTRUCTURE_FAILURE" });
  const severities = ["LOW","MEDIUM","HIGH","CRITICAL"];
  const statuses = ["REPORTED","VERIFIED","IN_PROGRESS","RESOLVED"];
  for (let i = 0; i < 50; i++) {
    const category = rand(categories) as any;
    const severity = rand(severities) as any;
    const title = rand(INCIDENT_TITLES[category as keyof typeof INCIDENT_TITLES]);
    const description = rand(INCIDENT_DESCRIPTIONS[category as keyof typeof INCIDENT_DESCRIPTIONS]);
    const city = pickCity();
    const affected = randInt(10, 5000);
    const sevWeight = { LOW: 1, MEDIUM: 3, HIGH: 6, CRITICAL: 10 }[severity];
    const priorityScore = Math.round(sevWeight * 10 + Math.log10(Math.max(affected, 1)) * 15 + randInt(0, 20));
    const status = rand(statuses) as any;
    const reportedBy = users[randInt(0, users.length - 1)];
    const coordinator = status !== "REPORTED" ? users[randInt(0, users.length - 1)] : null;
    const daysAgo = randInt(0, 30);
    const createdAt = new Date(now.getTime() - daysAgo * 86400000 - randInt(0, 23) * 3600000);
    const incident = await prisma.incident.create({
      data: {
        title,
        description,
        category,
        location: city.name,
        latitude: city.lat,
        longitude: city.lng,
        severity,
        priorityScore,
        affectedPopulation: affected,
        status,
        imageUrl: null,
        reportedById: reportedBy.id,
        coordinatorId: coordinator?.id,
        createdAt,
        updatedAt: createdAt,
      },
    });
    await prisma.incidentHistory.create({
      data: { incidentId: incident.id, action: "incident_reported", previousValue: null, newValue: status, changedById: reportedBy.id, timestamp: createdAt },
    });
    if (coordinator) {
      await prisma.incidentHistory.create({
        data: { incidentId: incident.id, action: "coordinator_assigned", previousValue: null, newValue: coordinator.name, changedById: users.find(u => u.role === "SYSTEM_ADMIN")!.id, timestamp: createdAt },
      });
    }
    if (status === "VERIFIED" || status === "IN_PROGRESS" || status === "RESOLVED") {
      await prisma.incidentHistory.create({
        data: { incidentId: incident.id, action: "status_changed", previousValue: "REPORTED", newValue: status, changedById: coordinator!.id, timestamp: new Date(createdAt.getTime() + 3600000) },
      });
    }
    incidents.push(incident);
  }
  console.log(`Created ${incidents.length} incidents`);

  // 20 Shelters
  const shelters: any[] = [];
  const shelterManagers = users.filter(u => u.role === "SHELTER_MANAGER");
  const facilityOpts = ["Kitchen","Medical Clinic","Water Supply","Sanitation","Electricity","Internet","Storage","Sleeping Area","Child Care","Security"];
  for (let i = 0; i < 20; i++) {
    const city = pickCity();
    const total = randInt(100, 1000);
    const occupied = randInt(0, total);
    const status = occupied >= total ? "FULL" : occupied === 0 ? "CLOSED" : rand(["OPEN","MAINTENANCE"]) as any;
    const mgr = shelterManagers[i % shelterManagers.length];
    const shelter = await prisma.shelter.create({
      data: {
        name: `${city.name} Emergency Shelter ${i + 1}`,
        location: city.name,
        latitude: city.lat,
        longitude: city.lng,
        totalCapacity: total,
        currentOccupancy: occupied,
        facilities: [rand(facilityOpts), rand(facilityOpts), rand(facilityOpts)].filter((v, i, a) => a.indexOf(v) === i),
        status,
        managerId: mgr.id,
      },
    });
    await prisma.shelterOccupancyLog.create({
      data: { shelterId: shelter.id, previousOccupancy: 0, newOccupancy: occupied, notes: "Initial occupancy recorded", updatedById: mgr.id, timestamp: new Date(now.getTime() - randInt(1, 14) * 86400000) },
    });
    shelters.push(shelter);
  }
  console.log(`Created ${shelters.length} shelters`);

  // Emergency Requests (100)
  const requestTypes = ["FOOD","WATER","MEDICAL","SHELTER","RESCUE","TRANSPORTATION"];
  const reqPriorities = ["LOW","MEDIUM","HIGH","CRITICAL"];
  const reqStatuses = ["PENDING","VERIFIED","ALLOCATED","IN_TRANSIT","COMPLETED","REJECTED"];
  const requests: any[] = [];
  for (let i = 0; i < 100; i++) {
    const incident = incidents[randInt(0, incidents.length - 1)];
    const type = rand(requestTypes) as any;
    const priority = rand(reqPriorities) as any;
    const affected = randInt(1, 500);
    const pWeight = { LOW: 1, MEDIUM: 3, HIGH: 6, CRITICAL: 10 }[priority];
    const priorityScore = Math.round(pWeight * 10 + Math.log10(Math.max(affected, 1)) * 10 + randInt(0, 20));
    const status = rand(reqStatuses) as any;
    const city = pickCity();
    const createdAt = new Date(now.getTime() - randInt(0, 30) * 86400000);
    const request = await prisma.emergencyRequest.create({
      data: {
        incidentId: incident.id,
        type,
        quantity: randInt(10, 500),
        location: city.name,
        latitude: city.lat,
        longitude: city.lng,
        priority,
        priorityScore,
        affectedPeople: affected,
        description: `Urgent ${type.toLowerCase()} assistance needed for ${affected} affected people.`,
        status,
        duplicateFlag: Math.random() < 0.05,
        createdAt,
      },
    });
    requests.push(request);
  }
  console.log(`Created ${requests.length} emergency requests`);

  // 500 Resources
  const resourceNames = {
    FOOD_PACKAGES: ["Rice Pack","Lentil Pack","Canned Goods","Dry Rations","Instant Noodles"],
    DRINKING_WATER: ["Bottled Water 1L","Water Can 5L","Water Can 20L","Purified Water Pouches"],
    MEDICAL_SUPPLIES: ["First Aid Kit","Antibiotics","Pain Relievers","Bandages","Syringes"],
    EMERGENCY_KITS: ["Survival Kit","Hygiene Kit","Baby Care Kit","Emergency Light Kit"],
    BLANKETS: ["Wool Blanket","Emergency Foil Blanket","Cotton Blanket"],
    RESCUE_EQUIPMENT: ["Rope Set","Life Jacket","Stretcher","Helmet","Flashlight"],
    TRANSPORTATION: ["Ambulance","Truck","Boat","Helicopter","4x4 Vehicle"],
  };
  const units = { FOOD_PACKAGES: "packets", DRINKING_WATER: "bottles", MEDICAL_SUPPLIES: "kits", EMERGENCY_KITS: "kits", BLANKETS: "pieces", RESCUE_EQUIPMENT: "sets", TRANSPORTATION: "vehicles" };
  let resourceCount = 0;
  for (const org of orgs) {
    for (let i = 0; i < 100; i++) {
      const category = rand(Object.keys(resourceNames)) as any;
      const name = rand(resourceNames[category]);
      const total = randInt(50, 2000);
      const available = randInt(0, total);
      const city = pickCity();
      const resource = await prisma.resource.create({
        data: {
          organizationId: org.id,
          name,
          category,
          totalQuantity: total,
          availableQuantity: available,
          unit: units[category],
          storageLocation: `${city.name} Warehouse ${randInt(1, 5)}`,
          latitude: city.lat,
          longitude: city.lng,
        },
      });
      await prisma.resourceStockHistory.create({
        data: { resourceId: resource.id, changeAmount: total, type: "RESTOCK", notes: "Initial stock registration", timestamp: new Date(now.getTime() - randInt(1, 60) * 86400000) },
      });
      resourceCount++;
    }
  }
  console.log(`Created ${resourceCount} resources`);

  // Teams
  const teams: any[] = [];
  for (let i = 0; i < 12; i++) {
    const org = orgs[i % orgs.length];
    const leader = volunteers[randInt(0, volunteers.length - 1)];
    const t = await prisma.team.create({
      data: { name: `Response Team ${i + 1}`, organizationId: org.id, leaderId: leader.id, status: ["ACTIVE","DEPLOYED","STANDBY"][randInt(0, 2)] as any },
    });
    teams.push(t);
  }

  // Volunteer Tasks (linked to incidents)
  const taskTitles = ["Damage Assessment","Supply Distribution","Shelter Setup","Search & Rescue","Medical Support","Evacuation Support","Communication Relay"];
  for (let i = 0; i < 60; i++) {
    const incident = incidents[randInt(0, incidents.length - 1)];
    const vol = volunteers[randInt(0, volunteers.length - 1)];
    const team = teams[randInt(0, teams.length - 1)];
    const status = ["ASSIGNED","ACCEPTED","IN_PROGRESS","COMPLETED"][randInt(0, 3)] as any;
    const city = pickCity();
    await prisma.volunteerTask.create({
      data: {
        title: rand(taskTitles),
        description: `Field task supporting incident ${incident.title}.`,
        incidentId: incident.id,
        teamId: team.id,
        volunteerId: vol.id,
        location: city.name,
        latitude: city.lat,
        longitude: city.lng,
        status,
        fieldReport: status === "COMPLETED" ? "Task completed successfully. No casualties reported." : null,
        fieldPhotos: status === "COMPLETED" ? [] : [],
        completedAt: status === "COMPLETED" ? new Date(Date.now()) : null,
      },
    });
  }

  // Resource Allocations (sample)
  const allocStatuses = ["ASSIGNED","IN_TRANSIT","DELIVERED","CANCELLED"];
  for (let i = 0; i < 40; i++) {
    const request = requests[randInt(0, requests.length - 1)];
    const res = await prisma.resource.findMany({ take: 1, skip: randInt(0, 490) });
    if (!res[0]) continue;
    const qty = Math.min(randInt(10, 100), res[0].availableQuantity);
    if (qty < 1) continue;
    const coordinator = users.find(u => u.role === "EMERGENCY_COORDINATOR")!;
    const alloc = await prisma.resourceAllocation.create({
      data: {
        requestId: request.id,
        resourceId: res[0].id,
        organizationId: res[0].organizationId,
        coordinatorId: coordinator.id,
        allocatedQuantity: qty,
        status: rand(allocStatuses) as any,
        qrVerificationCode: `RG-${Date.now()}-${i}`,
        deliveredAt: Math.random() < 0.5 ? new Date() : null,
      },
    });
    if (alloc.status === "DELIVERED") {
      await prisma.emergencyRequest.update({ where: { id: request.id }, data: { status: "COMPLETED" } });
    }
    await prisma.resource.update({ where: { id: res[0].id }, data: { availableQuantity: { decrement: qty } } });
    await prisma.resourceStockHistory.create({
      data: { resourceId: res[0].id, changeAmount: -qty, type: "ALLOCATED", notes: `Allocated to request ${request.id}`, timestamp: new Date() },
    });
    await prisma.activityLog.create({
      data: { userId: coordinator.id, action: "resource_allocated", entityType: "ResourceAllocation", entityId: alloc.id, details: `Allocated ${qty} ${res[0].unit} of ${res[0].name}` },
    });
  }

  await prisma.activityLog.create({
    data: { userId: users.find(u => u.role === "SYSTEM_ADMIN")!.id, action: "seed_completed", entityType: "System", entityId: "seed", details: "ReliefGrid seed data loaded" },
  });

  console.log("Seed completed successfully");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
