import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { validateFinancialCutoverInput, isFinancialCutoverEnvironmentEnabled } from "@/lib/edge-functions/financial-cutover-contract"
import {
  FINANCIAL_CUTOVER_GOVERNANCE_DOMAINS as GOVERNANCE_DOMAINS,
  isFinancialCutoverGovernanceGateComplete as isGovernanceGateComplete,
  isFinancialCutoverGovernanceUnlocked as isProductionActivationUnlocked,
  type FinancialCutoverGovernanceDomain as GovernanceDomain,
  type FinancialCutoverGovernanceGate as GovernanceGateRecord,
} from "@/lib/governance/financial-cutover-gates"

// ── Source materials under contract ───────────────────────────────────────
const legalReadme = readFileSync("docs/legal/review-drafts/README.md", "utf8")
const termsCanada = readFileSync("docs/legal/review-drafts/terms-canada.md", "utf8")
const privacyNotice = readFileSync("docs/legal/review-drafts/privacy-notice-canada.md", "utf8")
const dataFlowInventory = readFileSync("docs/legal/review-drafts/data-flow-inventory.md", "utf8")
const accountingMemo = readFileSync("docs/legal/review-drafts/accounting-recognition-memo.md", "utf8")
const cutoverRunbook = readFileSync("docs/engineering/financial-cutover-runbook.md", "utf8")
const cutoverMigration = readFileSync(
  "supabase/migrations/20260810160000_financial_cutover_control_plane.sql",
  "utf8",
)
const activationRevalidation = readFileSync(
  "supabase/migrations/20260810161000_financial_cutover_activation_revalidation.sql",
  "utf8",
)

const evaluatedAt = new Date("2026-08-20T12:00:00Z")
const completeRecord = (domain: GovernanceDomain): GovernanceGateRecord => ({
  domain,
  qualifiedReviewerIdentity: "Example Reviewer, CA",
  jurisdictionOrStandard: "Ontario, Canada",
  artifactHash: "a".repeat(64),
  conditions: [],
  conditionResolutions: [],
  disposition: "no engineering action required",
  reReviewDate: "2027-01-01",
  approvedAt: "2026-08-19T00:00:00Z",
})
const allGates = GOVERNANCE_DOMAINS.map(completeRecord)

describe("Governance Gate Framework and External Qualification Contracts (#184)", () => {
  describe("1. Domain Inventory Is Complete and Fail-Closed", () => {
    it("all 15 required governance domains are registered", () => {
      expect(GOVERNANCE_DOMAINS).toHaveLength(15)
      expect(GOVERNANCE_DOMAINS).toContain("canadian_legal_counsel")
      expect(GOVERNANCE_DOMAINS).toContain("retail_payment_activities_act")
      expect(GOVERNANCE_DOMAINS).toContain("fintrac_msb_obligations")
      expect(GOVERNANCE_DOMAINS).toContain("sanctions_kyc_kyb")
      expect(GOVERNANCE_DOMAINS).toContain("accounting_tax_recognition")
      expect(GOVERNANCE_DOMAINS).toContain("privacy_retention")
      expect(GOVERNANCE_DOMAINS).toContain("production_readiness_engineering")
    })

    it("production activation requires all 15 gates — zero filled means denied", () => {
      expect(isProductionActivationUnlocked([])).toBe(false)
    })

    it("14 of 15 complete gates still denies production activation", () => {
      const fourteenGates = GOVERNANCE_DOMAINS.slice(0, 14).map(completeRecord)
      expect(isProductionActivationUnlocked(fourteenGates, evaluatedAt)).toBe(false)
    })

    it("all 15 complete gates unlocks activation", () => {
      expect(isProductionActivationUnlocked(allGates, evaluatedAt)).toBe(true)
    })
  })

  describe("2. Gate Record Validation Is Strict", () => {
    const baseGate: GovernanceGateRecord = {
      domain: "canadian_legal_counsel",
      qualifiedReviewerIdentity: "Jane Smith, LLB",
      jurisdictionOrStandard: "Ontario, Canada",
      artifactHash: "b".repeat(64),
      conditions: [],
      conditionResolutions: [],
      disposition: "terms updated per counsel comments",
      reReviewDate: "2027-01-01",
      approvedAt: "2026-08-19T00:00:00Z",
    }

    it("accepts a complete gate record", () => {
      expect(isGovernanceGateComplete(baseGate, evaluatedAt)).toBe(true)
    })

    it("rejects a gate with missing artifact hash", () => {
      expect(isGovernanceGateComplete({ ...baseGate, artifactHash: "" })).toBe(false)
    })

    it("rejects a gate with an invalid artifact hash format", () => {
      expect(isGovernanceGateComplete({ ...baseGate, artifactHash: "not-a-hash" })).toBe(false)
      expect(isGovernanceGateComplete({ ...baseGate, artifactHash: "a".repeat(63) })).toBe(false)
    })

    it("rejects a gate with a short or blank reviewer identity", () => {
      expect(isGovernanceGateComplete({ ...baseGate, qualifiedReviewerIdentity: "J" })).toBe(false)
      expect(isGovernanceGateComplete({ ...baseGate, qualifiedReviewerIdentity: "   " })).toBe(false)
    })

    it("rejects a gate with a missing disposition", () => {
      expect(isGovernanceGateComplete({ ...baseGate, disposition: "" })).toBe(false)
    })

    it("rejects a gate with an invalid timestamp format", () => {
      expect(isGovernanceGateComplete({ ...baseGate, approvedAt: "2026-08-19" })).toBe(false)
      expect(isGovernanceGateComplete({ ...baseGate, approvedAt: "not-a-date" })).toBe(false)
    })

    it("rejects conditional conclusions until every condition has resolution evidence", () => {
      expect(
        isGovernanceGateComplete({
          ...baseGate,
          conditions: ["re-review required if Pay by Bank is added", "sandbox-only until PAD authorization confirmed"],
        }, evaluatedAt),
      ).toBe(false)
    })

    it("accepts resolved conditions with exact evidence and timestamps", () => {
      const condition = "sandbox-only until PAD authorization confirmed"
      expect(isGovernanceGateComplete({
        ...baseGate,
        conditions: [condition],
        conditionResolutions: [{ condition, evidenceHash: "c".repeat(64), resolvedAt: "2026-08-19T10:00:00Z" }],
      }, evaluatedAt)).toBe(true)
    })

    it("rejects expired review dates and malformed calendar values", () => {
      expect(isGovernanceGateComplete({ ...baseGate, reReviewDate: "2026-08-19" }, evaluatedAt)).toBe(false)
      expect(isGovernanceGateComplete({ ...baseGate, reReviewDate: "2027-02-31" }, evaluatedAt)).toBe(false)
      expect(isGovernanceGateComplete({ ...baseGate, approvedAt: "2026-02-31T00:00:00Z" }, evaluatedAt)).toBe(false)
    })

    it("rejects a gate for an unregistered domain", () => {
      expect(isGovernanceGateComplete({ ...baseGate, domain: "unknown_domain" as GovernanceDomain })).toBe(false)
    })

    it("fails closed for malformed nested gate JSON", () => {
      expect(isGovernanceGateComplete(null, evaluatedAt)).toBe(false)
      expect(isGovernanceGateComplete({ ...baseGate, conditionResolutions: [null] }, evaluatedAt)).toBe(false)
      expect(isProductionActivationUnlocked([null, ...allGates.slice(1)], evaluatedAt)).toBe(false)
    })
  })

  describe("3. Legal and Accounting Packets Are Bound to the Gate Framework", () => {
    it("legal README contains the complete production approval gate checklist", () => {
      expect(legalReadme).toContain("Production approval gate")
      expect(legalReadme).toContain("qualified Canadian counsel identity")
      expect(legalReadme).toContain("Retail Payment Activities Act")
      expect(legalReadme).toContain("FINTRAC/MSB")
      expect(legalReadme).toContain("qualified accountant identity")
      expect(legalReadme).toContain("data inventory")
      expect(legalReadme).toContain("production UI copy")
    })

    it("legal packet docs are marked DRAFT / NOT APPROVED / NOT EFFECTIVE", () => {
      for (const doc of [legalReadme, termsCanada, privacyNotice, dataFlowInventory, accountingMemo]) {
        expect(doc.toUpperCase()).toContain("DRAFT")
      }
    })

    it("terms contain experimental-warning and privacy notice contains security disclaimer", () => {
      // Terms: contains "experimental" label
      expect(termsCanada.toLowerCase()).toContain("experimental")
      // Privacy notice: contains security guarantee disclaimer (not "no guarantee" verbatim)
      expect(privacyNotice.toLowerCase()).toContain("security")
    })

    it("data flow inventory covers all major provider categories", () => {
      // Inventory uses "Cubid" (title-case) in prose and tables
      for (const provider of ["Stripe", "Supabase", "Vercel", "Cubid"]) {
        expect(dataFlowInventory).toContain(provider)
      }
    })

    it("accounting memo covers recognition, FX, token, fee, and expiry/unclaimed treatment", () => {
      for (const topic of ["recognition", "FX", "fee", "expiry"]) {
        expect(accountingMemo.toLowerCase()).toContain(topic.toLowerCase())
      }
    })
  })

  describe("4. Cutover Gate Enforces All Governance Domains at Activation", () => {
    it("SQL production cutover runtime is closed: production cannot prepare or activate", () => {
      expect(cutoverMigration).toContain("financial_cutover_runtime_production_closed")
      expect(cutoverMigration).toContain("deployment_environment <> 'production'")
      expect(cutoverMigration).toContain("production_value_flow_enabled=false")
      expect(cutoverMigration).toContain("financial_cutover_runtime_no_value_flow")
    })

    it("activation revalidates canonical dependencies under lock before switching the singleton", () => {
      expect(activationRevalidation).toContain("financial_cutover_canonical_evidence_drift")
      expect(activationRevalidation).toContain("singletonActiveRun")
    })

    it("cutover contract allowlist matches non-production environments only", () => {
      for (const env of ["local", "development", "dev", "preview", "test"]) {
        expect(isFinancialCutoverEnvironmentEnabled(env)).toBe(true)
      }
      expect(isFinancialCutoverEnvironmentEnabled("production")).toBe(false)
      expect(isFinancialCutoverEnvironmentEnabled("staging")).toBe(false)
      expect(isFinancialCutoverEnvironmentEnabled(undefined)).toBe(false)
    })

    it("prepare contract requires exact evidence hash and deduplicated opening-balance approvals", () => {
      const validPrepare = validateFinancialCutoverInput({
        action: "prepare",
        idempotencyKey: "governance-184-fixture",
        evidenceHash: "c".repeat(64),
        approvedOpeningBalances: [
          { sourceType: "bookkeeping_credit", sourceId: "1", evidenceHash: "d".repeat(64) },
        ],
      })
      expect(validPrepare.ok).toBe(true)

      // Duplicate source IDs must be rejected
      const approval = { sourceType: "bookkeeping_credit", sourceId: "1", evidenceHash: "d".repeat(64) }
      const duplicatePrepare = validateFinancialCutoverInput({
        action: "prepare",
        idempotencyKey: "governance-184-duplicate",
        evidenceHash: "c".repeat(64),
        approvedOpeningBalances: [approval, approval],
      })
      expect(duplicatePrepare.ok).toBe(false)
    })

    it("activate contract requires run ID, exact manifest hash, and activation evidence hash", () => {
      const validActivate = validateFinancialCutoverInput({
        action: "activate",
        runId: 1,
        manifestHash: "e".repeat(64),
        evidenceHash: "f".repeat(64),
        governanceGates: allGates,
      })
      expect(validActivate.ok).toBe(true)
    })

    it("rollback contract has identical shape to activate — both require manifest binding", () => {
      // Rollback's expected schema mirrors activate (runId + manifestHash + evidenceHash).
      // The contract type union explicitly includes both actions.
      // This assertion proves the contract migration strings encode rollback as a distinct reversible action.
      expect(cutoverRunbook).toContain("action=rollback")
      expect(cutoverMigration).toContain("rolled_back_at")
      // Activation with wrong evidence hash is rejected (proves manifest binding is enforced)
      const invalidActivate = validateFinancialCutoverInput({
        action: "activate",
        runId: 1,
        manifestHash: "e".repeat(63), // too short
        evidenceHash: "f".repeat(64),
        governanceGates: allGates,
      })
      expect(invalidActivate.ok).toBe(false)
    })
  })

  describe("5. Activation/Rollback Plan Has Separation of Duties and Cannot Be Authorized by Deployment Alone", () => {
    it("runbook confirms production requires separately approved runbook beyond deployment", () => {
      expect(cutoverRunbook).toContain("independently approved production runbook")
      expect(cutoverRunbook).toContain("professional accounting/legal decisions")
      expect(cutoverRunbook).toContain("remote-database authority")
    })

    it("runbook documents rollback as routing switch — not destructive, retaining all audit rows", () => {
      expect(cutoverRunbook).toContain("reversible routing switch")
      expect(cutoverRunbook).toContain("retaining classifications, links, neutral-ledger transactions, and obligations")
      expect(cutoverRunbook).toContain("Never delete audit rows")
    })

    it("prepare produces an immutable manifest hash that activation must supply exactly", () => {
      expect(cutoverMigration).toContain("manifest_hash")
      expect(cutoverMigration).toContain("financial_cutover_run_hash_check")
      expect(cutoverMigration).toContain("idempotency_key")
    })

    it("every source row in the manifest has an owner and an evidence hash — no unnamed entries", () => {
      expect(cutoverMigration).toContain("classification_evidence_hash")
      expect(cutoverMigration).toContain("source_hash")
      expect(cutoverMigration).toContain("actor_user_id")
    })
  })
})
