import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { validateEpochAllocationCloseInput } from "@/lib/edge-functions/epoch-allocation-close-contract"

describe("epoch allocation close Edge contract", () => {
  it("accepts only exact prepare, root confirmation, and scoped read inputs", () => {
    expect(validateEpochAllocationCloseInput({ action: "approve", cycleKey: "2026-08" })).toMatchObject({ ok: true })
    expect(validateEpochAllocationCloseInput({ action: "confirm_root", cycleKey: "2026-08", closePackageId: 7, rootHash: "a".repeat(64) })).toMatchObject({ ok: true })
    expect(validateEpochAllocationCloseInput({ action: "confirm_root", cycleKey: "2026-08", closePackageId: 7, rootHash: "bad" })).toMatchObject({ ok: false })
    expect(validateEpochAllocationCloseInput({ action: "read", cycleKey: "2026-08", scope: "operator" })).toMatchObject({ ok: true })
    expect(validateEpochAllocationCloseInput({ action: "read", cycleKey: "2026-08", scope: "user" })).toMatchObject({ ok: true })
    expect(validateEpochAllocationCloseInput({ action: "read", cycleKey: "2026-08", scope: "project", projectSlug: "civic-mesh" })).toMatchObject({ ok: true })
    expect(validateEpochAllocationCloseInput({ action: "approve", cycleKey: "2026-8" })).toMatchObject({ ok: false })
  })

  it("rejects caller-owned hashes, actor, environment, artifacts, and award values", () => {
    for (const field of ["manifestHash", "resultHash", "rerunResultHash", "actorUserId", "deploymentEnvironment", "artifact", "awards"]) {
      expect(validateEpochAllocationCloseInput({ action: "approve", cycleKey: "2026-08", [field]: "crafted" })).toMatchObject({ ok: false })
    }
  })

  it("reruns the trusted manifest and binds actor and runtime inside Edge", () => {
    const source = readFileSync("supabase/functions/epoch-allocation-close/index.ts", "utf8")
    expect(source).toContain("calculateFundedRedistribution")
    expect(source).toContain("rerun.resultHash !== run.data.result_hash")
    expect(source).toContain("actorUserId: auth.user.id")
    expect(source).toContain("confirm_epoch_allocation_close_root")
    expect(source).toContain("deploymentEnvironment")
    expect(source).toContain('["local", "development", "dev", "preview", "test"]')
    expect(source).not.toContain('allowedEnvironments.add("production")')
  })
})
