import fs from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"

const migration = fs.readFileSync(path.join(process.cwd(), "supabase/migrations/20260810160000_financial_cutover_control_plane.sql"), "utf8")
const activationFix = fs.readFileSync(path.join(process.cwd(), "supabase/migrations/20260810161000_financial_cutover_activation_revalidation.sql"), "utf8")
const supersessionFix = fs.readFileSync(path.join(process.cwd(), "supabase/migrations/20260810162000_financial_cutover_supersession_events.sql"), "utf8")
const readIntegration = fs.readFileSync(path.join(process.cwd(), "supabase/migrations/20260810163000_financial_cutover_read_integration.sql"), "utf8")

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

  it("revalidates canonical dependencies under lock and preserves one active singleton", () => {
    for (const table of ["epoch_project_packages", "epoch_project_package_payments", "epoch_close_packages",
      "user_withdrawal_obligations", "user_withdrawal_obligation_claims"]) {
      expect(activationFix).toContain(`public.${table}`)
    }
    expect(activationFix).toContain("financial_cutover_canonical_evidence_drift")
    expect(activationFix).toContain("WHERE status='active' AND id<>v_run.id")
    expect(activationFix).toContain("singletonActiveRun")
    expect(activationFix).toContain("FROM PUBLIC,anon,authenticated,service_role")
    expect(supersessionFix).toContain("v_prior_active_ids")
    expect(supersessionFix).toContain("event.event_type='superseded'")
    expect(supersessionFix).toContain("activate_financial_cutover_without_complete_supersession_events")
  })

  it("routes server reads to canonical obligations without freezing cycle lifecycle inputs", () => {
    expect(readIntegration).toContain("DROP TRIGGER IF EXISTS financial_cutover_monthly_cycles_write_guard")
    expect(readIntegration).toContain("financial_cutover_canonical_credit_reads")
    expect(readIntegration).toContain("obligation.total_minor / 100.0")
    expect(readIntegration).toContain("GRANT SELECT ON TABLE public.financial_cutover_canonical_credit_reads TO service_role")
  })
})
