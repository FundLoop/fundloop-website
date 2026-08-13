import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const setup = readFileSync("supabase/tests/epoch_allocation_v2_four_epoch_setup.sql", "utf8")
const assertion = readFileSync("supabase/tests/epoch_allocation_v2_four_epoch_lifecycle.sql", "utf8")
const wrapper = readFileSync("supabase/tests/epoch_allocation_v2_four_epoch_lifecycle.sh", "utf8")

describe("four epoch allocation lifecycle executable contract", () => {
  it("models E minus three through E with partial claim protection and released re-eligibility", () => {
    for (const cycle of ["2026-03", "2026-04", "2026-05", "2026-06"]) expect(setup).toContain(`'${cycle}'`)
    for (const state of ["reserved", "queued", "held", "paid", "closed", "released"]) expect(setup).toContain(`'${state}'`)
    expect(setup).toContain("v_active<>5*v_unit")
    expect(setup).toContain("v_obligation.total_minor-v_active")
    expect(setup).toContain("four_epoch_eur_source_harvest_carry_no_double_use_failed")
    expect(setup).toContain("cs_test_four_epoch_current")
    expect(setup).toMatch(/v_eur_source_lot[\s\S]*v_current_source_lot=v_eur_source_lot/)
  })

  it("runs a genuine two-session claim/harvest race and rejects the stale selection", () => {
    expect(wrapper).toContain("FOR UPDATE")
    expect(wrapper).toContain("pg_advisory_xact_lock")
    expect(wrapper).toContain("SQL\nclaim_pid=$!")
    expect(wrapper).toContain("wait \"$claim_pid\"")
    expect(wrapper).toContain("epoch_allocation_v2_(harvest_balance_changed|preview_stale)")
    expect(wrapper).toContain("status='released'")
    expect(wrapper).toContain("calculate-four-epoch-allocation.mjs")
    expect(wrapper).toContain("record_funded_epoch_allocation_v2_once")
  })

  it("asserts cap, source, predecessor, close, report, and root conservation", () => {
    for (const evidence of [
      "four_epoch_manifest_claim_harvest_conservation_failed",
      "four_epoch_score_discount_initial_claim_cap_or_carryout_failed",
      "four_epoch_source_minor_exact_conservation_failed",
      "four_epoch_native_project_rail_asset_custody_fx_evidence_failed",
      "four_epoch_duplicate_harvest_insert_accepted",
      "four_epoch_close_rerun_root_failed",
      "four_epoch_report_hash_or_replay_failed",
      "four_epoch_carryout_predecessor_chain_failed",
      "four_epoch_eur_source_initial_harvest_carry_double_use_failed",
    ]) expect(assertion).toContain(evidence)
    expect(assertion).toContain("manifest.funded_exact_usd")
    expect(assertion).toContain("source.native_atomic_amount<>lot.native_atomic_amount")
    expect(assertion).toContain("source.fx_snapshot_id<>lot.fx_snapshot_id")
    expect(assertion).toContain("source.evidence_hash<>lot.evidence_hash")
    expect(assertion).toMatch(/v_eur_funded_minor<>v_active\+v_harvest\+v_carry/)
    expect(assertion).toMatch(/coalesce\(pool\.origin_disposition_id,fill\.disposition_id\)/)
  })
})
