import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const edge = readFileSync("supabase/functions/persona-readiness-identity/index.ts", "utf8")
const schema = readFileSync("supabase/migrations/20260813133000_persona_goal2_schema_readiness.sql", "utf8")

describe("persona candidate readiness identities", () => {
  it("keeps the runtime identity local, secret-bound, exact, and nonmutating", () => {
    expect(edge).toContain('PERSONA_READINESS_RUNTIME_CONTRACT = "fundloop.persona-runtime-readiness.v1"')
    expect(edge).toContain('environment !== "local"')
    expect(edge).toContain("x-fundloop-readiness-secret")
    expect(edge).toContain('import sourceContracts from "./source-contracts.json"')
    expect(edge).toContain("crypto.subtle.digest")
    expect(edge).toContain("selected_function_unknown")
    expect(edge).toContain("productionValueFlowEnabled: false")
    expect(edge).not.toMatch(/supabaseClient|createClient|supabase\.from\(|supabase\.rpc\(|\bfetch\(/)
  })

  it("binds the schema identity to persona and all Goal 2 additions", () => {
    for (const feature of [
      "user_onboarding_drafts", "project_onboarding_drafts", "profile_publication_consents", "project_invitations",
      "project_monthly_contribution_submissions", "project_attribution_datasets", "monthly_cycle_bookkeeping_credits",
      "epoch_redistribution_pool_sources", "monthly_cycle_report_artifacts", "monthly_cycle_report_events",
      "harvested_minor", "selected_preview_hash", "lock_funded_epoch_allocation_v2",
      "record_funded_epoch_allocation_v2_once", "generate_monthly_cycle_reports", "publish_monthly_cycle_reports",
    ]) expect(schema).toContain(feature)
    expect(schema).toContain("missingFeatures")
    expect(schema).toContain("productionValueFlowEnabled',false")
    expect(schema).toContain("TO service_role")
  })
})
