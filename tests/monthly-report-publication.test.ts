import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { validateMonthlyReportPublicationInput } from "@/lib/edge-functions/monthly-report-publication-contract"

const sql = readFileSync("supabase/migrations/20260813130000_monthly_report_publication.sql", "utf8")
const edge = readFileSync("supabase/functions/monthly-report-publication/index.ts", "utf8")

describe("monthly report publication", () => {
  it("validates typed generation, publication, and audience reads", () => {
    expect(validateMonthlyReportPublicationInput({ action: "generate", closePackageId: "7" }).ok).toBe(true)
    expect(validateMonthlyReportPublicationInput({ action: "publish", closePackageId: "7", rootHash: "a".repeat(64) }).ok).toBe(true)
    expect(validateMonthlyReportPublicationInput({ action: "read", audience: "mcp", cycleKey: "2026-07" }).ok).toBe(true)
    expect(validateMonthlyReportPublicationInput({ action: "publish", closePackageId: "7", rootHash: "bad" }).ok).toBe(false)
  })

  it("binds all audiences to close hashes and executable retention", () => {
    for (const audience of ["public", "user", "founder", "operator", "mcp"]) expect(sql).toContain(`'${audience}'`)
    expect(sql).toContain("manifestHash")
    expect(sql).toContain("resultHash")
    expect(sql).toContain("rootHash")
    expect(sql).toContain("monthly_report_publication_incomplete")
    expect(sql).toContain("monthly_report_events_are_append_only")
    expect(sql).toContain("apply_monthly_report_retention")
    expect(sql).toContain("productionValueFlowEnabled',false")
  })

  it("keeps writes internal and non-internal reads public-or-self", () => {
    expect(edge).toContain("isInternalAdminEmail")
    expect(edge).toContain("if (input.action !== \"read\")")
    expect(edge).toContain("audience.eq.public,and(audience.eq.user,subject_user_id.eq.")
  })
})
