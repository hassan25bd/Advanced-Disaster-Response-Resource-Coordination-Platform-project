const INCIDENT_DEMO_PREFIX = "[RGDEMO-";
const DEMO_PREFIX = "RGDEMO-";
const DEMO_USER_PREFIX = "rgdemo-";
const DEMO_USER_DOMAIN = "@example.invalid";

export const demoDataWhere = {
  incident: { description: { startsWith: INCIDENT_DEMO_PREFIX } },
  request: { incident: { description: { startsWith: INCIDENT_DEMO_PREFIX } } },
  resource: { storageLocation: { startsWith: DEMO_PREFIX } },
  allocation: {
    OR: [
      { resource: { storageLocation: { startsWith: DEMO_PREFIX } } },
      { request: { incident: { description: { startsWith: INCIDENT_DEMO_PREFIX } } } },
    ],
  },
  shelter: { name: { startsWith: DEMO_PREFIX } },
  team: { name: { startsWith: DEMO_PREFIX } },
  task: { title: { startsWith: DEMO_PREFIX } },
  volunteer: {
    role: "VOLUNTEER" as const,
    email: { startsWith: DEMO_USER_PREFIX, endsWith: DEMO_USER_DOMAIN },
  },
};

type WhereWithAnd = { AND?: unknown; [key: string]: unknown };

export function includeDemoRecords<T extends WhereWithAnd>(
  where: T,
  organizationScope: Record<string, unknown> | undefined,
  demoScope: Record<string, unknown>,
) {
  const conditions = Array.isArray(where.AND) ? where.AND : [];
  Object.assign(where, {
    AND: [...conditions, { OR: organizationScope ? [organizationScope, demoScope] : [demoScope] }],
  });
  return where;
}

export function isDemoIncident(description?: string | null) {
  return description?.startsWith(INCIDENT_DEMO_PREFIX) ?? false;
}

export function isDemoResource(storageLocation?: string | null) {
  return storageLocation?.startsWith(DEMO_PREFIX) ?? false;
}

export function isDemoShelter(name?: string | null) {
  return name?.startsWith(DEMO_PREFIX) ?? false;
}

export function isDemoTeam(name?: string | null) {
  return name?.startsWith(DEMO_PREFIX) ?? false;
}

export function isDemoTask(title?: string | null) {
  return title?.startsWith(DEMO_PREFIX) ?? false;
}

export function isDemoAccount(email?: string | null) {
  return Boolean(email && email.startsWith(DEMO_USER_PREFIX) && email.endsWith(DEMO_USER_DOMAIN));
}
