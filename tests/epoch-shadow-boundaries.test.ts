import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const migration = readFileSync("supabase/migrations/20260809030000_epoch_shadow_state_machine.sql", "utf8")
const edge = readFileSync("supabase/functions/epoch-shadow-scheduler/index.ts", "utf8")

describe("epoch shadow execution boundaries", () => {
  it("uses advisory guards, optimistic versions, and skip-locked claims", () => {
    expect(migration).toContain("pg_advisory_xact_lock")
    expect(migration).toContain("FOR UPDATE OF queued SKIP LOCKED")
    expect(migration).toContain("epoch_shadow_optimistic_guard_failed")
    expect(migration).toContain("no_external_call_under_lock = true")
  })

  it("does not mutate legacy cycles and keeps production false", () => {
    expect(migration).not.toMatch(/UPDATE public\.monthly_cycles/i)
    expect(migration).toContain("production_value_flow_enabled = false")
    expect(edge).toContain('environment === "production"')
    expect(edge).toContain("authenticateRequestOrInternalSecret")
  })
})
