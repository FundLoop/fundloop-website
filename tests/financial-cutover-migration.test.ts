import fs from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"

const migration = fs.readFileSync(path.join(process.cwd(), "supabase/migrations/20260810160000_financial_cutover_control_plane.sql"), "utf8")

describe("financial cutover migration", () => {
  it("classifies every required legacy surface and records explicit differences", () => {
    for (const source of ["payment", "monthly_cycle", "bookkeeping_credit", "withdrawal_request", "payout_intent"]) {
      expect(migration).toContain(`'${source}'`)
    }
    for (const classification of ["externally_verified", "approved_opening_balance", "legacy_unverified", "reversed_voided"]) {
      expect(migration).toContain(`'${classification}'`)
    }
    expect(migration).toContain("financial_cutover_differences")
    expect(migration).toContain("canonical_amount_mismatch")
    expect(migration).toContain("legacy_unverified_excluded")
  })

  it("posts approved opening balances to balanced liability accounts without value flow", () => {
    expect(migration).toContain("legacy_opening_balance_control")
    expect(migration).toContain("user_withdrawal_liability_control")
    expect(migration).toContain("post_neutral_ledger_transaction")
    expect(migration).toContain("source_bookkeeping_credit_id")
    expect(migration).toContain("production_value_flow_enabled=false")
  })

  it("keeps commands service-only and legacy writes reversible", () => {
    expect(migration).toContain("GRANT EXECUTE ON FUNCTION public.financial_cutover_runtime_enabled")
    expect(migration).toContain("FROM PUBLIC,anon,authenticated")
    expect(migration).toContain("financial_cutover_instance_state")
    expect(migration).toContain("legacy_financial_writes_retired")
    expect(migration).toContain("canonicalRecordsRetained")
  })
})
