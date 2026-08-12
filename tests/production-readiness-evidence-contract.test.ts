import { readFileSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"
import {
  approvalScopeSha256,
  evaluateProductionReadinessManifest,
  functionInventorySha256,
  migrationInventorySha256,
  type ProductionReadinessManifest,
} from "@/lib/release-readiness/evidence-manifest"

const fixturePath = path.resolve("tests/fixtures/production-readiness/manifest-valid.json")
const schemaPath = path.resolve("docs/engineering/production-readiness-manifest.schema.json")
const fixture = JSON.parse(readFileSync(fixturePath, "utf8")) as ProductionReadinessManifest
const schema = JSON.parse(readFileSync(schemaPath, "utf8")) as { properties: Record<string, unknown>; required: string[] }
const evaluate = (mutate?: (manifest: ProductionReadinessManifest) => void) => {
  const manifest = structuredClone(fixture)
  mutate?.(manifest)
  return evaluateProductionReadinessManifest(manifest).blocking
}

describe("production-readiness evidence contract v1", () => {
  it("publishes a machine-readable schema and a fixture accepted by the canonical evaluator", () => {
    expect(schema.required).toEqual(expect.arrayContaining(["candidate", "expected", "observed", "deployment", "prerequisites", "runtimeControls", "approvals", "alerts", "gates"]))
    expect(Object.keys(schema.properties)).toEqual(expect.arrayContaining(schema.required))
    expect(migrationInventorySha256(fixture.expected.migrationInventory.items)).toBe(fixture.expected.migrationInventory.inventorySha256)
    expect(functionInventorySha256(fixture.expected.functionInventory.items)).toBe(fixture.expected.functionInventory.inventorySha256)
    expect(approvalScopeSha256(fixture)).toBe(fixture.approvals[0]?.scopeManifestSha256)
    expect(evaluate()).toEqual([])
  })

  it.each([
    ["missing migration", "missing-migration:20260809020000_neutral_ledger_foundations.sql", (manifest: ProductionReadinessManifest) => { manifest.observed.migrationInventory.items.splice(0, 1) }],
    ["unexpected migration", "unexpected-migration:20260812120000_unexpected.sql", (manifest: ProductionReadinessManifest) => { manifest.observed.migrationInventory.items.push({ version: "20260812120000", name: "20260812120000_unexpected.sql", fileSha256: "9".repeat(64) }) }],
    ["reordered migration", "migration-order:observed", (manifest: ProductionReadinessManifest) => { manifest.observed.migrationInventory.items.reverse() }],
    ["duplicate migration", "duplicate-migration:observed", (manifest: ProductionReadinessManifest) => { manifest.observed.migrationInventory.items.push({ ...manifest.observed.migrationInventory.items[0]!, fileSha256: "6".repeat(64) }) }],
    ["changed migration digest", "migration-digest:20260809020000_neutral_ledger_foundations.sql", (manifest: ProductionReadinessManifest) => { manifest.observed.migrationInventory.items[0]!.fileSha256 = "8".repeat(64) }],
    ["migration inventory digest", "migration-inventory-digest:observed", (manifest: ProductionReadinessManifest) => { manifest.observed.migrationInventory.inventorySha256 = "7".repeat(64) }],
    ["missing function", "missing-function:epoch-funded-allocation", (manifest: ProductionReadinessManifest) => { manifest.observed.functionInventory.items.splice(0, 1) }],
    ["unexpected function", "unexpected-function:unexpected-function", (manifest: ProductionReadinessManifest) => { manifest.observed.functionInventory.items.push({ name: "unexpected-function", sourceSha256: "9".repeat(64), remoteVersion: 1, remoteStatus: "ACTIVE" }) }],
    ["reordered function", "function-order:observed", (manifest: ProductionReadinessManifest) => { manifest.observed.functionInventory.items.reverse() }],
    ["duplicate function", "duplicate-function:observed", (manifest: ProductionReadinessManifest) => { manifest.observed.functionInventory.items.push({ ...manifest.observed.functionInventory.items[0]!, sourceSha256: "6".repeat(64) }) }],
    ["changed function digest", "function-digest:epoch-funded-allocation", (manifest: ProductionReadinessManifest) => { manifest.observed.functionInventory.items[0]!.sourceSha256 = "8".repeat(64) }],
    ["function inventory digest", "function-inventory-digest:observed", (manifest: ProductionReadinessManifest) => { manifest.observed.functionInventory.inventorySha256 = "7".repeat(64) }],
  ])("blocks %s drift", (_name, code, mutate) => {
    expect(evaluate(mutate)).toContain(code)
  })

  it.each([
    ["workflow SHA", "deployment-sha", (manifest: ProductionReadinessManifest) => { manifest.deployment.headSha = "0".repeat(40) }],
    ["observed application SHA", "application-sha-binding", (manifest: ProductionReadinessManifest) => { manifest.observed.applicationGitSha = "0".repeat(40) }],
    ["application deployment", "application-deployment-binding", (manifest: ProductionReadinessManifest) => { manifest.observed.applicationDeploymentId = "wrong-deployment" }],
    ["environment", "environment-binding", (manifest: ProductionReadinessManifest) => { manifest.observed.environment = "production" }],
    ["Supabase project", "project-binding", (manifest: ProductionReadinessManifest) => { manifest.observed.projectRef = "tpouimiyfmvucrerfhfc" }],
    ["workflow run", "workflow-run-binding", (manifest: ProductionReadinessManifest) => { manifest.observed.githubRunId += 1 }],
    ["workflow attempt", "workflow-run-binding", (manifest: ProductionReadinessManifest) => { manifest.observed.githubRunAttempt += 1 }],
    ["stale backend observation", "observation-time:backend", (manifest: ProductionReadinessManifest) => { manifest.observed.observedAt = "2026-08-11T20:00:00-04:00" }],
    ["stale GitHub observation", "observation-time:github-controls", (manifest: ProductionReadinessManifest) => { manifest.githubControls.observedAt = "2026-08-11T20:00:00-04:00" }],
    ["stale runtime observation", "observation-time:runtime-controls", (manifest: ProductionReadinessManifest) => { manifest.runtimeControls.observedAt = "2026-08-11T20:00:00-04:00" }],
    ["capability environment", "capability-environment:allocation-v2", (manifest: ProductionReadinessManifest) => { manifest.capabilities[0]!.environment = "production" }],
    ["capability observation", "capability-time:allocation-v2", (manifest: ProductionReadinessManifest) => { manifest.capabilities[0]!.observedAt = "2026-08-11T20:00:00-04:00" }],
  ])("blocks a wrong %s binding", (_name, code, mutate) => {
    expect(evaluate(mutate)).toContain(code)
  })

  it.each([
    ["missing prerequisite", "prerequisite-missing:fresh-replay", (manifest: ProductionReadinessManifest) => { manifest.prerequisites = manifest.prerequisites.filter((entry) => entry.prerequisiteId !== "fresh-replay") }],
    ["failed prerequisite", "prerequisite-not-passed:fresh-replay", (manifest: ProductionReadinessManifest) => { manifest.prerequisites[0]!.status = "fail" }],
    ["missing PR protection", "protection-missing:pull-request", (manifest: ProductionReadinessManifest) => { manifest.githubControls.pullRequestRequired = false }],
    ["missing required check", "protection-missing:check:CI / validate", (manifest: ProductionReadinessManifest) => { manifest.githubControls.requiredChecks = ["Supabase dry-run"] }],
    ["missing Production reviewer", "protection-missing:production-reviewer", (manifest: ProductionReadinessManifest) => { manifest.githubControls.requiredReviewerCount = 0 }],
    ["admin bypass", "protection-missing:admin-bypass", (manifest: ProductionReadinessManifest) => { manifest.githubControls.adminBypassAllowed = true }],
    ["failed blocking alert", "alert-delivery-failed:parity-drift", (manifest: ProductionReadinessManifest) => { manifest.alerts.push({ code: "parity-drift", severity: "blocking", subject: "fixture", firstObservedAt: manifest.generatedAt, owner: "release-owner", deliveryStatus: "failed", evidenceSha256: "9".repeat(64) }) }],
    ["cutover prepare enabled", "cutover-control-enabled-before-approval", (manifest: ProductionReadinessManifest) => { manifest.runtimeControls.cutoverPrepareEnabled = true }],
    ["cutover activation enabled", "cutover-control-enabled-before-approval", (manifest: ProductionReadinessManifest) => { manifest.runtimeControls.cutoverActivationEnabled = true }],
    ["value flow enabled", "value-flow-enabled-before-go-live", (manifest: ProductionReadinessManifest) => { manifest.runtimeControls.productionValueFlowEnabled = true }],
  ])("fails closed for %s", (_name, code, mutate) => {
    expect(evaluate(mutate)).toContain(code)
  })

  it("blocks a missing approval required by a claimed Production pass", () => {
    expect(evaluate((manifest) => {
      manifest.approvals = []
      manifest.gates.productionDeploy = { ...manifest.gates.productionDeploy, status: "pass", blockers: [] }
    })).toEqual(expect.arrayContaining(["approval-missing:production-deploy", "approval-missing:rollback", "gate-dependency:productionDeploy", "gate-contradiction:productionDeploy"]))
  })

  it("blocks an expired or scope-mismatched approval", () => {
    expect(evaluate((manifest) => { manifest.approvals[0]!.expiresAt = "2026-08-11T20:29:00-04:00" })).toContain("approval-stale:code-review")
    expect(evaluate((manifest) => { manifest.approvals[0]!.scopeManifestSha256 = "0".repeat(64) })).toContain("approval-stale:code-review")
  })

  it.each([
    ["parity", "gate-dependency:parity", (manifest: ProductionReadinessManifest) => { manifest.gates.deploy = { ...manifest.gates.deploy, status: "pending", blockers: ["forced-pending"] } }],
    ["Production", "gate-dependency:productionDeploy", (manifest: ProductionReadinessManifest) => { manifest.gates.productionDeploy = { ...manifest.gates.productionDeploy, status: "pass", blockers: [] } }],
    ["cutover", "gate-dependency:cutover", (manifest: ProductionReadinessManifest) => { manifest.gates.cutover = { ...manifest.gates.cutover, status: "pass", blockers: [] } }],
    ["go-live", "gate-dependency:goLive", (manifest: ProductionReadinessManifest) => { manifest.gates.goLive = { ...manifest.gates.goLive, status: "pass", blockers: [] } }],
  ])("rejects a contradictory %s pass gate", (_name, code, mutate) => {
    expect(evaluate(mutate)).toContain(code)
  })

  it("rejects a pass gate that records blockers", () => {
    expect(evaluate((manifest) => { manifest.gates.parity.blockers = ["contradiction"] })).toContain("gate-contradiction:parity")
  })
})
