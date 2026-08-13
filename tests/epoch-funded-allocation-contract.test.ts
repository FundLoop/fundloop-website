import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { validateEpochFundedAllocationInput } from "@/lib/edge-functions/epoch-funded-allocation-contract"

describe("epoch funded allocation Edge contract", () => {
  it("accepts only exact read, preview, lock, and calculate inputs", () => {
    expect(validateEpochFundedAllocationInput({ action: "read" })).toMatchObject({ ok: true })
    expect(validateEpochFundedAllocationInput({ action: "read", cycleKey: "2026-08" })).toMatchObject({ ok: true })
    expect(validateEpochFundedAllocationInput({ action: "preview", cycleKey: "2026-08", capMultiple: "3.00" })).toMatchObject({ ok: true })
    expect(validateEpochFundedAllocationInput({ action: "lock", cycleKey: "2026-08", capMultiple: "3.00", selectedPreviewHash: "a".repeat(64) })).toMatchObject({ ok: true })
    expect(validateEpochFundedAllocationInput({ action: "calculate", cycleKey: "2026-08" })).toMatchObject({ ok: true })
    expect(validateEpochFundedAllocationInput({ action: "calculate", cycleKey: "2026-8" })).toMatchObject({ ok: false })
    expect(validateEpochFundedAllocationInput({ action: "preview", cycleKey: "2026-08", capMultiple: "3" })).toMatchObject({ ok: false })
    expect(validateEpochFundedAllocationInput({ action: "preview", cycleKey: "2026-08", capMultiple: "10.01" })).toMatchObject({ ok: false })
  })

  it("rejects caller-owned actor, environment, artifact, and source inputs", () => {
    for (const field of ["actorUserId", "deploymentEnvironment", "artifact", "sources", "cohort"]) {
      expect(validateEpochFundedAllocationInput({ action: "calculate", cycleKey: "2026-08", [field]: "crafted" })).toMatchObject({
        ok: false,
      })
    }
  })

  it("binds the authenticated actor and runtime inside the Edge function", () => {
    const source = readFileSync("supabase/functions/epoch-funded-allocation/index.ts", "utf8")
    expect(source).toContain("actorUserId: auth.user.id")
    expect(source).toContain("deploymentEnvironment: environment")
    expect(source).toContain('new Set(["local", "development", "dev", "preview", "test"])')
    expect(source).toContain("calculateFundedRedistributionV2")
    expect(source).toContain('return json(edgeCommandFailure("epoch_allocation_v2_manifest_not_locked"')
    expect(source.indexOf('from("epoch_allocation_manifests")')).toBeLessThan(source.indexOf("calculateFundedRedistributionV2({ ...locked.manifest"))
    expect(source).not.toContain('allowedEnvironments.add("production")')
  })

  it("keeps browser acceptance behind a closed claim window with an E-3 origin", () => {
    const fixture = readFileSync("supabase/tests/fixtures/epoch_funded_allocation_browser.sql", "utf8")
    expect(fixture).toContain("VALUES ('2026-01', 2026, 1, '2026-01-01', '2026-01-31', 'completed')")
    expect(fixture).toContain("VALUES ('2026-04', 2026, 4, '2026-04-01', '2026-04-30', 'prep')")
    expect(fixture).toContain("'browser_allocation_2026_04', '2026-04-01T07:00:00Z', '2026-05-01T07:00:00Z'")
    expect(fixture).not.toContain("2026-08-31")
  })
})
