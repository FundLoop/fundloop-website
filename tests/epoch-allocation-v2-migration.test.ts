import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const sql = readFileSync("supabase/migrations/20260811120000_epoch_allocation_policy_v2.sql", "utf8")

describe("epoch allocation v2 migration", () => {
  it("preserves v1 and binds a governed selected cap to immutable v2 artifacts", () => {
    expect(sql).toContain("settled_cubid_redistribution_v1','settled_cubid_redistribution_v2")
    expect(sql).toContain("epoch_allocation_v2_preview_input")
    expect(sql).toContain("selected_preview_hash")
    expect(sql).toContain("cap_multiple BETWEEN 1 AND 10")
    expect(sql).toContain("approve_epoch_allocation_close_v2")
  })

  it("uses the cap only for top-ups and forbids a v2 overlap pool", () => {
    expect(sql).toContain("top_up_capacity_minor=greatest(minor_unit_cap-initial_claim_minor,0)")
    expect(sql).toContain("initial_claim_minor=retained_initial_minor")
    expect(sql).toContain("overlap_pool_minor=0")
    expect(sql).toContain("top_up_minor+returned_residue_minor=score_pool_minor+harvested_unclaimed_minor+carry_in_minor")
  })

  it("harvests exactly E minus three with claim and duplicate-harvest guards", () => {
    expect(sql).toContain("v_target.period_start-interval '3 months'")
    expect(sql).toContain("withdrawal_claim_harvest_guard")
    expect(sql).toContain("claim.status<>'released'")
    expect(sql).toContain("epoch_redistribution_harvest_once_idx")
    expect(sql).toContain("ORDER BY deterministic_sequence DESC,inventory_lot_id DESC")
  })

  it("excludes harvested value from withdrawal state and oldest-first allocation", () => {
    expect(sql).toContain("v_claimed<v_total-v_harvested")
    expect(sql).toContain("obligation.total_minor-obligation.harvested_minor-coalesce")
    expect(sql).toContain("AS unclaimed_minor")
    expect(sql).toContain("withdrawal_available_amount_insufficient")
  })

  it("carries residue with provenance and exposes privacy-thresholded cap and harvest fields", () => {
    expect(sql).toContain("origin_disposition_id")
    expect(sql).toContain("carryforward_residue")
    expect(sql).toContain("CASE WHEN package.user_count>=3 THEN package.cap_multiple ELSE NULL END")
    expect(sql).toContain("CASE WHEN package.user_count>=3 THEN package.harvested_unclaimed_minor ELSE NULL END")
    expect(sql).toContain("production_enabled=false")
  })
})
