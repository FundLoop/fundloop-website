import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const sql = readFileSync("supabase/migrations/20260809160000_epoch_funded_allocation.sql", "utf8")

describe("epoch funded allocation migration", () => {
  it("locks only approved settled packages and journal-backed source lots", () => {
    expect(sql).toContain("epoch_allocation_package_not_approved")
    expect(sql).toContain("epoch_allocation_ledger_backing_missing")
    expect(sql).toContain("epoch_review_distributable_control")
    expect(sql).toContain("package.status IN ('approved','silent_approved')")
  })

  it("keeps artifacts immutable, service-only, provisional, and production disabled", () => {
    expect(sql).toContain("epoch_allocation_records_are_append_only")
    expect(sql).toContain("epoch_allocation_runtime_production_closed")
    expect(sql).toContain("epoch_allocation_runtime_no_value_flow")
    expect(sql).toContain("GRANT EXECUTE ON FUNCTION public.epoch_allocation_runtime_enabled(text),public.lock_funded_epoch_allocation(jsonb)")
    expect(sql).not.toMatch(/GRANT EXECUTE ON FUNCTION public\.lock_funded_epoch_allocation\(jsonb\)[\s\S]{0,120}TO authenticated/)
  })

  it("enforces cap and canonical source conservation when recording results", () => {
    expect(sql).toContain("final_minor<=minor_unit_cap")
    expect(sql).toContain("epoch_allocation_source_conservation_failed")
    expect(sql).toContain("epoch_allocation_award_conservation_failed")
    expect(sql).toContain("final_allocation_minor+returned_residue_minor=funded_minor")
    expect(sql).toContain("top_up_minor+returned_residue_minor=score_pool_minor+overlap_pool_minor")
  })
})
