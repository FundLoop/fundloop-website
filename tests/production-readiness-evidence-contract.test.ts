import { readFileSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"

type InventoryItem = { name: string; fileSha256?: string; sourceSha256?: string }
type Manifest = {
  contractVersion: string
  candidate: { gitSha: string }
  deployment: { headSha: string; conclusion: string; databaseStep: string; functionStep: string }
  expected: { migrationInventory: { items: InventoryItem[] }; functionInventory: { items: InventoryItem[] }; schemaFingerprint: { normalizedSchemaSha256: string } }
  observed: { migrationInventory: { items: InventoryItem[] }; functionInventory: { items: InventoryItem[] }; schemaFingerprint: { normalizedSchemaSha256: string } }
  runtimeControls: { productionValueFlowEnabled: boolean }
  gates: { parity: { status: string } }
}

const fixturePath = path.resolve("tests/fixtures/production-readiness/manifest-valid.json")
const schemaPath = path.resolve("docs/engineering/production-readiness-manifest.schema.json")
const fixture = JSON.parse(readFileSync(fixturePath, "utf8")) as Manifest
const schema = JSON.parse(readFileSync(schemaPath, "utf8")) as { properties: Record<string, unknown>; required: string[] }

function blockingParityDrift(manifest: Manifest) {
  const blockers: string[] = []
  const compare = (kind: "migration" | "function", expected: InventoryItem[], observed: InventoryItem[]) => {
    const observedByName = new Map(observed.map((entry) => [entry.name, entry]))
    for (const entry of expected) {
      const remote = observedByName.get(entry.name)
      if (!remote) blockers.push(`missing-${kind}:${entry.name}`)
      else if ((entry.fileSha256 ?? entry.sourceSha256) !== (remote.fileSha256 ?? remote.sourceSha256)) blockers.push(`digest-${kind}:${entry.name}`)
    }
    const expectedNames = new Set(expected.map((entry) => entry.name))
    for (const entry of observed) if (!expectedNames.has(entry.name)) blockers.push(`unexpected-${kind}:${entry.name}`)
  }
  compare("migration", manifest.expected.migrationInventory.items, manifest.observed.migrationInventory.items)
  compare("function", manifest.expected.functionInventory.items, manifest.observed.functionInventory.items)
  if (manifest.expected.schemaFingerprint.normalizedSchemaSha256 !== manifest.observed.schemaFingerprint.normalizedSchemaSha256) blockers.push("schema-fingerprint")
  if (manifest.candidate.gitSha !== manifest.deployment.headSha) blockers.push("deployment-sha")
  if (manifest.deployment.conclusion !== "success" || manifest.deployment.databaseStep !== "success" || manifest.deployment.functionStep !== "success") blockers.push("deployment-incomplete")
  if (manifest.runtimeControls.productionValueFlowEnabled) blockers.push("value-flow-enabled-before-go-live")
  return blockers
}

describe("production-readiness evidence contract v1", () => {
  it("publishes a machine-readable top-level schema and a parity-valid fixture", () => {
    expect(fixture.contractVersion).toBe("fundloop.production-readiness/v1")
    expect(schema.required).toEqual(expect.arrayContaining(["candidate", "expected", "observed", "deployment", "prerequisites", "runtimeControls", "approvals", "alerts", "gates"]))
    expect(Object.keys(schema.properties)).toEqual(expect.arrayContaining(schema.required))
    expect(fixture.gates.parity.status).toBe("pass")
    expect(blockingParityDrift(fixture)).toEqual([])
  })

  it("classifies one missing expected migration as blocking drift", () => {
    const drifted = structuredClone(fixture)
    drifted.observed.migrationInventory.items.splice(0, 1)
    expect(blockingParityDrift(drifted)).toEqual(["missing-migration:20260809020000_neutral_ledger_foundations.sql"])
  })

  it("classifies one missing expected function as blocking drift", () => {
    const drifted = structuredClone(fixture)
    drifted.observed.functionInventory.items.splice(0, 1)
    expect(blockingParityDrift(drifted)).toEqual(["missing-function:epoch-funded-allocation"])
  })

  it("keeps deploy success, parity, and value-flow authority independent", () => {
    const drifted = structuredClone(fixture)
    drifted.runtimeControls.productionValueFlowEnabled = true
    expect(blockingParityDrift(drifted)).toContain("value-flow-enabled-before-go-live")
  })
})
