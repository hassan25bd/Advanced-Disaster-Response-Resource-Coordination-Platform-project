import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import ts from "typescript";

const directory = path.dirname(fileURLToPath(import.meta.url));

function loadRoute(relativePath, prisma, user) {
  const source = fs.readFileSync(path.join(directory, "..", "src", "app", "api", ...relativePath), "utf8");
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const exports = {};
  const dependencies = {
    "next/server": { NextResponse: { json: (body, options) => Response.json(body, options) } },
    "@/lib/api-auth": { requireAuth: async () => user, requireRole: async () => user },
    "@/lib/prisma": { default: prisma },
  };
  vm.runInNewContext(js, {
    exports,
    URL,
    require: (name) => {
      if (!(name in dependencies)) throw new Error(`Unexpected dependency: ${name}`);
      return dependencies[name];
    },
  });
  return exports;
}

const user = { id: "org-user", role: "RELIEF_ORGANIZATION", organizationId: "org-1" };
const payload = {
  incidentId: "incident-1", type: "FOOD", quantity: 5, location: "Town",
  priority: "HIGH", affectedPeople: 12, description: "Food needed",
};
const post = (body) => new Request("http://localhost/api/requests", { method: "POST", body: JSON.stringify(body) });

test("request creation validates and confines organizations, and uses incident coordinates", async () => {
  let incident = { reportedById: user.id, latitude: 23, longitude: 90 };
  let created;
  const prisma = {
    incident: { findUnique: async () => incident },
    emergencyRequest: { findFirst: async () => null },
    $transaction: async (fn) => fn({
      emergencyRequest: { create: async ({ data }) => { created = data; return data; } },
      activityLog: { create: async () => {} },
    }),
  };
  const route = loadRoute(["requests", "route.ts"], prisma, user);
  assert.equal((await route.POST(post({ ...payload, quantity: -1 }))).status, 400);
  incident = { ...incident, reportedById: "other-user" };
  assert.equal((await route.POST(post(payload))).status, 403);
  incident = { ...incident, reportedById: user.id };
  assert.equal((await route.POST(post(payload))).status, 201);
  assert.equal(created.latitude, 23);
  assert.equal(created.longitude, 90);
  assert.equal(created.status, "PENDING");
});

test("organization request listing restricts requests and allocation details", async () => {
  let query;
  const prisma = { emergencyRequest: {
    findMany: async (args) => { query = args; return []; },
    count: async () => 0,
  } };
  const route = loadRoute(["requests", "route.ts"], prisma, user);
  assert.equal((await route.GET(new Request("http://localhost/api/requests"))).status, 200);
  assert.equal(query.where.OR[0].incident.reportedBy.organizationId, "org-1");
  assert.equal(query.where.OR[1].allocations.some.organizationId, "org-1");
  assert.equal(query.include.allocations.where.organizationId, "org-1");
});

test("request verification does not create history entries for omitted fields", async () => {
  const history = [];
  const prisma = {
    emergencyRequest: { findUnique: async () => ({ incidentId: "incident-1", status: "PENDING", priority: "HIGH", priorityScore: 60 }) },
    $transaction: async (fn) => fn({
      emergencyRequest: { update: async ({ data }) => data },
      incidentHistory: { create: async ({ data }) => history.push(data) },
      activityLog: { create: async () => {} },
    }),
  };
  const route = loadRoute(["requests", "[id]", "route.ts"], prisma, { id: "admin", role: "SYSTEM_ADMIN" });
  const response = await route.PATCH(new Request("http://localhost/api/requests/1", {
    method: "PATCH", body: JSON.stringify({ status: "VERIFIED" }),
  }), { params: Promise.resolve({ id: "1" }) });
  assert.equal(response.status, 200);
  assert.equal(history.length, 1);
  assert.equal(history[0].action, "status_changed");
  assert.equal(history[0].newValue, "VERIFIED");
});

test("resource adjustments validate inventory and record actual stock changes", async () => {
  const stockHistory = [];
  let updateCount = 0;
  const resource = { id: "resource-1", organizationId: "org-1", totalQuantity: 10, availableQuantity: 8, name: "Water" };
  const prisma = {
    resource: { findUnique: async () => resource },
    $transaction: async (fn) => fn({
      resource: {
        updateMany: async () => { updateCount++; return { count: 1 }; },
        findUniqueOrThrow: async () => resource,
      },
      resourceStockHistory: { create: async ({ data }) => stockHistory.push(data) },
      activityLog: { create: async () => {} },
    }),
  };
  const route = loadRoute(["resources", "[id]", "route.ts"], prisma, user);
  const update = (availableQuantity) => route.PATCH(new Request("http://localhost/api/resources/1", {
    method: "PATCH", body: JSON.stringify({ availableQuantity }),
  }), { params: Promise.resolve({ id: "resource-1" }) });
  assert.equal((await update(11)).status, 400);
  assert.equal(updateCount, 0);
  assert.equal((await update(5)).status, 200);
  assert.equal(stockHistory.length, 1);
  assert.equal(stockHistory[0].changeAmount, -3);
});
