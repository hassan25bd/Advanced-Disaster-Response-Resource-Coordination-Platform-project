import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import ts from "typescript";

const directory = path.dirname(fileURLToPath(import.meta.url));

function loadRoute(prisma, user) {
  const source = fs.readFileSync(
    path.join(directory, "..", "src", "app", "api", "organizations", "onboard", "route.ts"),
    "utf8",
  );
  const js = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText;
  const exports = {};
  const dependencies = {
    "next/server": { NextResponse: { json: (body, options) => Response.json(body, options) } },
    "@/lib/api-auth": { requireRole: async () => user },
    "@/lib/prisma": { default: prisma },
  };
  vm.runInNewContext(js, {
    exports,
    require: (name) => {
      if (!(name in dependencies)) throw new Error(`Unexpected dependency: ${name}`);
      return dependencies[name];
    },
  });
  return exports;
}

function loadRegistrationRoute(prisma) {
  const source = fs.readFileSync(
    path.join(directory, "..", "src", "app", "api", "auth", "register", "route.ts"),
    "utf8",
  );
  const js = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText;
  const exports = {};
  const dependencies = {
    "next/server": { NextResponse: { json: (body, options) => Response.json(body, options) } },
    "bcryptjs": { default: { hash: async () => "hashed-password" } },
    "@/lib/prisma": { default: prisma },
  };
  vm.runInNewContext(js, {
    exports,
    require: (name) => {
      if (!(name in dependencies)) throw new Error(`Unexpected dependency: ${name}`);
      return dependencies[name];
    },
  });
  return exports;
}

const user = { id: "org-user", email: "partner@example.org", role: "RELIEF_ORGANIZATION", organizationId: null };
const post = (body) => new Request("http://localhost/api/organizations/onboard", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

test("relief organization registration creates its organization and user together", async () => {
  let createdOrganization;
  let createdUser;
  const prisma = {
    user: { findUnique: async () => null },
    $transaction: async (callback) => callback({
      organization: {
        create: async ({ data }) => {
          createdOrganization = data;
          return { id: "org-new", ...data };
        },
      },
      user: {
        create: async ({ data, select }) => {
          createdUser = { data, select };
          return { id: "new-user", ...data };
        },
      },
    }),
  };
  const route = loadRegistrationRoute(prisma);
  const response = await route.POST(new Request("http://localhost/api/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: " New User ",
      email: "USER@EXAMPLE.ORG ",
      password: "passphrase",
      role: "RELIEF_ORGANIZATION",
      organizationName: " Community Relief ",
      registrationNo: " CR-001 ",
    }),
  }));
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(createdOrganization.name, "Community Relief");
  assert.equal(createdOrganization.registrationNo, "CR-001");
  assert.equal(createdOrganization.contactEmail, "user@example.org");
  assert.equal(createdUser.data.name, "New User");
  assert.equal(createdUser.data.email, "user@example.org");
  assert.equal(createdUser.data.organizationId, "org-new");
  assert.equal(body.user.organizationId, "org-new");
});

test("organization onboarding creates and links an organization atomically", async () => {
  let created;
  let linked;
  const prisma = {
    $transaction: async (callback) => callback({
      organization: {
        create: async ({ data }) => {
          created = data;
          return { id: "org-new", ...data };
        },
      },
      user: {
        updateMany: async ({ where, data }) => {
          linked = { where, data };
          return { count: 1 };
        },
      },
    }),
  };
  const route = loadRoute(prisma, user);
  const response = await route.POST(post({
    name: "Community Relief",
    registrationNo: "CR-001",
    contactEmail: "contact@example.org",
  }));
  const body = await response.json();

  assert.equal(response.status, 201);
  assert.equal(body.organization.id, "org-new");
  assert.equal(created.registrationNo, "CR-001");
  assert.equal(created.contactEmail, "contact@example.org");
  assert.equal(linked.where.id, user.id);
  assert.equal(linked.where.organizationId, null);
  assert.equal(linked.data.organizationId, "org-new");
});

test("organization onboarding reports duplicate registration numbers", async () => {
  const prisma = {
    $transaction: async () => {
      const error = new Error("duplicate");
      error.code = "P2002";
      throw error;
    },
  };
  const route = loadRoute(prisma, user);
  const response = await route.POST(post({ name: "Community Relief", registrationNo: "CR-001" }));

  assert.equal(response.status, 409);
  assert.match((await response.json()).error, /already in use/);
});

test("organization onboarding rejects accounts already linked to an organization", async () => {
  const route = loadRoute({}, { ...user, organizationId: "org-existing" });
  const response = await route.POST(post({ name: "Community Relief", registrationNo: "CR-001" }));

  assert.equal(response.status, 409);
});
