import fs from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"

const controlPlaneMigration = fs.readFileSync(
  path.join(process.cwd(), "supabase/migrations/20260810160000_financial_cutover_control_plane.sql"),
  "utf8"
)

describe("Financial Cutover Production Gates (#170)", () => {
  describe("Production ledger denial", () => {
    it("enforces fail-closed production constraint", () => {
      // The runtime controls must disable production value flow
      expect(controlPlaneMigration).toContain("CONSTRAINT financial_cutover_instance_production_closed CHECK(")
      expect(controlPlaneMigration).toContain("deployment_environment<>'production'")
      expect(controlPlaneMigration).toContain("production_value_flow_enabled=false")
    })

    it("prevents financial writes when cutover is active", () => {
      // Must prevent legacy monetary writes and read from canonical source
      expect(controlPlaneMigration).toContain("legacy_financial_writes_retired")
    })
  })

  describe("Opening-balance manifest reproducibility", () => {
    it("binds run manifest to evidence hash", () => {
      // Prepare must generate an immutable manifest hash
      expect(controlPlaneMigration).toContain("manifest_hash text,")
      expect(controlPlaneMigration).toContain("evidence_hash text NOT NULL")
      expect(controlPlaneMigration).toContain("UNIQUE(deployment_environment,idempotency_key)")
    })

    it("requires exact source-level differences", () => {
      expect(controlPlaneMigration).toContain("CREATE TABLE public.financial_cutover_differences")
      expect(controlPlaneMigration).toContain("legacy_minor numeric")
      expect(controlPlaneMigration).toContain("canonical_minor numeric")
      expect(controlPlaneMigration).toContain("difference_minor numeric")
    })
  })

  describe("V2 allocation cutover inventory", () => {
    it("includes v2 canonical types in link constraints", () => {
      // V2 allocations (award obligations, carry lots) are the target canonical state
      expect(controlPlaneMigration).toContain("CONSTRAINT financial_cutover_link_type_check CHECK(canonical_type IN(")
      expect(controlPlaneMigration).toContain("'epoch_project_package','epoch_close_package','withdrawal_obligation','withdrawal_request','payout_intent'")
    })
  })

  describe("Read-only Production preflight surface", () => {
    it("asserts denial behavior for production", async () => {
      const { isFinancialCutoverEnvironmentEnabled } = await import("@/lib/edge-functions/financial-cutover-contract")
      // Production is explicitly denied by the cutover edge contract
      expect(isFinancialCutoverEnvironmentEnabled("production")).toBe(false)
      // Assert that any other unspecified environment falls back to production and is denied
      expect(isFinancialCutoverEnvironmentEnabled("")).toBe(false)
      expect(isFinancialCutoverEnvironmentEnabled(undefined)).toBe(false)
    })
  })
})
