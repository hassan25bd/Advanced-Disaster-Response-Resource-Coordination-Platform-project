import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import ts from "typescript";

const sourcePath = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "src", "lib", "priority.ts");
const source = fs.readFileSync(sourcePath, "utf8");
const exports = {};
vm.runInNewContext(ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText, { exports, module: { exports } });

test("priority scoring includes population, risk, and elapsed time", () => {
  const now = new Date("2026-01-03T00:00:00Z");
  const recent = new Date("2026-01-01T00:00:00Z");
  const old = new Date("2025-12-01T00:00:00Z");
  const baseline = exports.calculateIncidentPriority({
    severity: "HIGH", affectedPopulation: 100, locationRiskScore: 0, createdAt: recent,
  }, now);
  const higherRisk = exports.calculateIncidentPriority({
    severity: "HIGH", affectedPopulation: 100, locationRiskScore: 3, createdAt: recent,
  }, now);
  const older = exports.calculateIncidentPriority({
    severity: "HIGH", affectedPopulation: 100, locationRiskScore: 0, createdAt: old,
  }, now);

  assert.equal(higherRisk - baseline, 30);
  assert.ok(older > baseline);
  assert.ok(exports.calculateRequestPriority({
    priority: "CRITICAL", affectedPeople: 100, locationRiskScore: 1, createdAt: recent,
  }, now) > baseline);
});
