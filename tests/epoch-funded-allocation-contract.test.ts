import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { validateEpochFundedAllocationInput } from "@/lib/edge-functions/epoch-funded-allocation-contract"

describe("epoch funded allocation Edge contract", () => {
  it("accepts only exact read, lock, and calculate inputs", () => {
    expect(validateEpochFundedAllocationInput({ action: "read" })).toMatchObject({ ok: true })
    expect(validateEpochFundedAllocationInput({ action: "read", cycleKey: "2026-08" })).toMatchObject({ ok: true })
    expect(validateEpochFundedAllocationInput({ action: "lock", cycleKey: "2026-08" })).toMatchObject({ ok: true })
    expect(validateEpochFundedAllocationInput({ action: "calculate", cycleKey: "2026-08" })).toMatchObject({ ok: true })
    expect(validateEpochFundedAllocationInput({ action: "calculate", cycleKey: "2026-8" })).toMatchObject({ ok: false })
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
    expect(source).toContain("calculateFundedRedistribution")
    expect(source).not.toContain('allowedEnvironments.add("production")')
  })
})
