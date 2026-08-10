import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const sql = readFileSync("supabase/migrations/20260809170000_epoch_allocation_close_package.sql", "utf8")

describe("epoch allocation close migration", () => {
  it("consumes exact approved results and preserves the conditional non-payable boundary", () => {
    expect(sql).toContain("rerun_result_hash = result_hash")
    expect(sql).toContain("epoch_close_approved_result_mismatch")
    expect(sql).toContain("provisional_conditional_non_payable_award")
    expect(sql).toContain("payable_status='not_payable'")
    expect(sql).toContain("ownership_status='not_user_owned'")
  })

  it("posts source-linked award and residue controls and conserves the approved totals", () => {
    expect(sql).toContain("epoch_provisional_award_control")
    expect(sql).toContain("epoch_allocated_source_control")
    expect(sql).toContain("epoch_returned_residue_control")
    expect(sql).toContain("final_allocation_minor+returned_residue_minor=funded_minor")
    expect(sql).toContain("top_up_minor+returned_residue_minor=redistribution_pool_minor")
  })

  it("hashes every close artifact and stops at payout readying with production closed", () => {
    for (const key of ["allocation_result", "trial_balance", "custody", "project_funds", "fees", "fx", "carryover", "initial_claims", "redistribution_pool", "top_ups", "provisional_awards", "exceptions"]) {
      expect(sql).toContain(`('${key}'`)
    }
    expect(sql).toContain("approved_close_package_ready")
    expect(sql).toContain("current_stage='payout_readying'")
    expect(sql).toContain("epoch_close_runtime_production_closed")
    expect(sql).not.toContain("current_stage='payout_open'")
  })

  it("keeps user details private and thresholds public cohort counts", () => {
    expect(sql).toContain("CASE WHEN package.user_count>=3 THEN package.user_count ELSE NULL END")
    expect(sql).toContain("CASE WHEN summary.cohort_count>=3 THEN summary.cohort_count ELSE NULL END")
    expect(sql).toContain("epoch_close_public_view WITH(security_barrier=true)")
    expect(sql).toContain("epoch_close_project_forbidden")
    expect(sql).toContain("GRANT SELECT ON TABLE public.epoch_close_public_view,public.epoch_close_public_project_view TO anon,authenticated,service_role")
  })
})
