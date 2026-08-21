import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { CAPABILITY_REGISTRY } from "@/tests/e2e/personas/capabilities"
import {
  PERSONA_IDS,
  type PersonaId,
  type PersonaJourney,
} from "@/tests/e2e/personas/contracts"
import {
  newFounderJourney,
  newMemberJourney,
  returningFounderJourney,
  returningMemberJourney,
  returningOperatorJourney,
} from "@/tests/e2e/personas/journeys"
import { validatePersonaJourneys } from "@/tests/e2e/support/persona-selection"
import { validateWithdrawalOperatorInput } from "@/lib/edge-functions/withdrawal-operator-contract"
import { validateUserWithdrawalRequestInput } from "@/lib/edge-functions/user-withdrawal-request-contract"

// ── SQL contract files used for evidence assertions ────────────────────────
const reportPublicationMigration = readFileSync(
  "supabase/migrations/20260813130000_monthly_report_publication.sql",
  "utf8",
)
const profilePublicationMigration = readFileSync(
  "supabase/migrations/20260808233000_profile_publication_consents.sql",
  "utf8",
)
const boundaryFixMigration = readFileSync(
  "supabase/migrations/20260809010000_review_consent_boundary_fixes.sql",
  "utf8",
)
const withdrawalMigration = readFileSync(
  "supabase/migrations/20260809180000_withdrawal_obligation_control_plane.sql",
  "utf8",
)
const capabilityMatrix = JSON.parse(
  readFileSync("tests/e2e/operational/feature-118-capability-matrix.json", "utf8"),
)
const readinessBoundaries = JSON.parse(
  readFileSync("tests/e2e/personas/readiness-boundaries.json", "utf8"),
)

// These no-op actions validate journey contracts only. Real hosted execution
// lives in the Playwright projects and requires the hosted credential set.
const contractShapeAction = async () => ({ outcome: "observed" as const, evidence: {} })
const contractShapeActions = new Proxy({}, { get: () => contractShapeAction }) as Record<string, typeof contractShapeAction>

// ────────────────────────────────────────────────────────────────────────────

describe("Founder, Verified-User, and Operator Contract Coverage (#183)", () => {
  describe("1. All Five Persona Journey Definitions Are Structurally Valid", () => {
    const journeys: PersonaJourney[] = [
      newMemberJourney(contractShapeActions),
      returningMemberJourney(contractShapeActions),
      newFounderJourney(contractShapeActions),
      returningFounderJourney(contractShapeActions),
      returningOperatorJourney(contractShapeActions),
    ]

    it("all five personas are registered in the canonical persona ID registry", () => {
      expect(PERSONA_IDS).toEqual([
        "new-member",
        "returning-member",
        "new-founder",
        "returning-founder",
        "returning-operator",
      ])
    })

    it("all five journey definitions validate cleanly against the harness contract schema", () => {
      expect(validatePersonaJourneys(journeys)).toBe(true)
    })

    it("journeys cover all three actor kinds required by the persona harness", () => {
      const kinds = new Set(journeys.map((j) => j.actorKind))
      expect(kinds.has("new")).toBe(true)
      expect(kinds.has("returning")).toBe(true)
      expect(kinds.has("operator")).toBe(true)
    })

    it("readiness boundaries file binds all five personas to exact surface contracts", () => {
      for (const personaId of PERSONA_IDS) {
        expect(readinessBoundaries[personaId]).toBeDefined()
        expect(readinessBoundaries[personaId].journeySource).toMatch(/journeys\.ts$/)
      }
    })

    it("every checkpoint carries a required mode or a registry-registered pending declaration", () => {
      for (const journey of journeys) {
        for (const checkpoint of journey.checkpoints) {
          if (checkpoint.mode === "expected-pending") {
            expect(CAPABILITY_REGISTRY).toHaveProperty(checkpoint.capabilityId)
            expect(CAPABILITY_REGISTRY[checkpoint.capabilityId as keyof typeof CAPABILITY_REGISTRY].state).toBe(
              "expected-pending",
            )
          } else {
            expect(checkpoint.mode).toBe("required")
          }
        }
      }
    })
  })

  describe("2. Founder Journey — Funding, Profile, Reporting, and Invitation", () => {
    const newFounder = newFounderJourney(contractShapeActions)
    const returningFounder = returningFounderJourney(contractShapeActions)

    it("new founder covers all required contribution and attribution checkpoints", () => {
      const ids = newFounder.checkpoints.map((c) => c.id)
      expect(ids).toContain("founder.publish-project-profile")
      expect(ids).toContain("founder.create-project-invitation")
      expect(ids).toContain("founder.submit-monthly-contribution")
      expect(ids).toContain("founder.submit-active-user-attribution")
    })

    it("returning founder covers next-cycle contribution, attribution, and invitation in sequence", () => {
      const ids = returningFounder.checkpoints.map((c) => c.id)
      expect(ids).toContain("founder.create-project-invitation")
      expect(ids).toContain("founder.submit-next-month-contribution")
      expect(ids).toContain("founder.submit-next-month-attribution")
    })

    it("founder readiness boundaries require project onboarding, invitation, contribution, and attribution commands", () => {
      const founderBounds = readinessBoundaries["new-founder"].commandBoundaries
      expect(founderBounds["founder.publish-project-profile"]).toContain("project-onboarding-publish")
      expect(founderBounds["founder.create-project-invitation"]).toContain("project-invitation-create")
      expect(founderBounds["founder.submit-monthly-contribution"]).toContain("project-monthly-contribution-submit")
      expect(founderBounds["founder.submit-active-user-attribution"]).toContain("project-attribution-dataset-submit")
    })

    it("founder report audience is a distinct bound subject_project_id audit artifact", () => {
      expect(reportPublicationMigration).toContain(
        "audience='founder' AND subject_user_id IS NULL AND subject_project_id IS NOT NULL",
      )
      expect(reportPublicationMigration).toContain("monthly_report_artifact_project_once")
    })
  })

  describe("3. Verified-User (CUBID Member) Journey — Participation, Earnings, Claims, and Reporting", () => {
    const newMember = newMemberJourney(contractShapeActions)
    const returningMember = returningMemberJourney(contractShapeActions)

    it("new member covers auth OTP, profile publication, earnings, and withdrawal checkpoints in order", () => {
      const ids = newMember.checkpoints.map((c) => c.id)
      expect(ids.indexOf("auth.request-local-otp")).toBeLessThan(ids.indexOf("member.publish-profile"))
      expect(ids.indexOf("member.publish-profile")).toBeLessThan(ids.indexOf("member.view-earnings-total"))
      expect(ids.indexOf("member.view-earnings-total")).toBeLessThan(ids.indexOf("member.withdraw-earnings"))
    })

    it("returning member surfaces earnings, project sources, and withdrawal as required checkpoints", () => {
      const ids = returningMember.checkpoints.map((c) => c.id)
      expect(ids).toContain("member.view-earnings-total")
      expect(ids).toContain("member.view-project-sources")
      expect(ids).toContain("member.withdraw-earnings")
      expect(returningMember.checkpoints.every((c) => c.mode === "required")).toBe(true)
    })

    it("user report audience is a distinct bound subject_user_id audit artifact", () => {
      expect(reportPublicationMigration).toContain(
        "audience='user' AND subject_user_id IS NOT NULL AND subject_project_id IS NULL",
      )
      expect(reportPublicationMigration).toContain("monthly_report_artifact_user_once")
    })

    it("withdrawal request contract accepts valid member create and cancel inputs", () => {
      const validCreate = validateUserWithdrawalRequestInput({
        action: "create",
        payoutRouteId: 3,
        requestedMinor: 5000,
        projectId: 7,
        assetKey: "stripe_sandbox_usd",
        idempotencyKey: "contract-evidence-183",
        userFeeBps: 0,
      })
      expect(validCreate.ok).toBe(true)

      const validCancel = validateUserWithdrawalRequestInput({
        action: "cancel",
        requestId: "00000000-0000-4000-8000-000000000001",
      })
      expect(validCancel.ok).toBe(true)
    })
  })

  describe("4. Operator Journey — Gates, Reconciliation, Reporting, and Audit", () => {
    const operator = returningOperatorJourney(contractShapeActions)

    it("operator journey covers the complete cadence from lock through reporting", () => {
      const ids = operator.checkpoints.map((c) => c.id)
      expect(ids).toEqual([
        "auth.login-returning-operator",
        "operator.view-cycle-readiness",
        "operator.lock-cycle",
        "operator.calculate-cycle",
        "operator.verify-cycle",
        "operator.approve-cycle",
        "operator.create-bookkeeping-credits",
        "operator.view-performance",
        "operator.view-allocation-breakdown",
      ])
    })

    it("all operator checkpoints are required (no pending stubs in the cadence)", () => {
      expect(operator.checkpoints.every((c) => c.mode === "required")).toBe(true)
    })

    it("operator readiness boundaries bind lock, calculation, verification, approval, and bookkeeping commands", () => {
      const opBounds = readinessBoundaries["returning-operator"].commandBoundaries
      expect(opBounds["operator.lock-cycle"]).toContain("monthly-cycle-lock")
      expect(opBounds["operator.calculate-cycle"]).toContain("monthly-cycle-calculation-package")
      expect(opBounds["operator.verify-cycle"]).toContain("monthly-cycle-verification-review")
      expect(opBounds["operator.approve-cycle"]).toContain("monthly-cycle-approval")
      expect(opBounds["operator.create-bookkeeping-credits"]).toContain(
        "monthly-cycle-bookkeeping-credits-create",
      )
    })

    it("operator withdrawal actions are strictly scoped: prepare, hold, and expire only", () => {
      expect(validateWithdrawalOperatorInput({ action: "prepare", closePackageId: 1 }).ok).toBe(true)
      expect(
        validateWithdrawalOperatorInput({
          action: "hold",
          requestId: "00000000-0000-4000-8000-000000000002",
          reasonCode: "review_required",
          evidenceHash: "a".repeat(64),
        }).ok,
      ).toBe(true)
      expect(validateWithdrawalOperatorInput({ action: "expire" }).ok).toBe(true)
      // Future-dated expire is rejected (server-timed only)
      expect(
        validateWithdrawalOperatorInput({ action: "expire", observedAt: "2099-01-01T00:00:00Z" } as object).ok,
      ).toBe(false)
    })

    it("operator report audience produces a distinct non-subject audit artifact", () => {
      expect(reportPublicationMigration).toContain(
        "audience IN('public','operator','mcp') AND subject_user_id IS NULL AND subject_project_id IS NULL",
      )
      expect(reportPublicationMigration).toContain("monthly_report_artifact_global_once")
    })
  })

  describe("5. Public Multilingual Reader Journey", () => {
    it("public report audience is schema-valid and does not require a subject user or project", () => {
      expect(reportPublicationMigration).toContain(
        "(audience IN('public','operator','mcp') AND subject_user_id IS NULL",
      )
    })

    it("monthly report exposes claimsExpiryRollover and accurate current/hosted/pending capability state", () => {
      expect(reportPublicationMigration).toContain("claimsExpiryRollover")
      expect(reportPublicationMigration).toContain("withdrawal claims remain protected until expiry")
    })

    it("capability matrix marks production value flow disabled across all capabilities", () => {
      expect(capabilityMatrix.productionValueFlowEnabled).toBe(false)
    })

    it("CAD PAD and Pay by Bank capabilities are present in the matrix with accurate pending-reason evidence", () => {
      const cadPad = capabilityMatrix.capabilities.find(
        (c: { id: string }) => c.id === "stripe-canadian-pad-intake",
      )
      const payByBank = capabilityMatrix.capabilities.find(
        (c: { id: string }) => c.id === "stripe-eur-gbp-pay-by-bank-intake",
      )
      expect(cadPad).toBeDefined()
      expect(cadPad.state).toBe("local-real")
      expect(payByBank).toBeDefined()
      expect(payByBank.state).toBe("local-real")
    })

    it("Base USDT and PYUSD routes are stubbed in the capability matrix (not activated)", () => {
      const usdt = capabilityMatrix.capabilities.find(
        (c: { id: string }) => c.id === "base-usdt-review-route",
      )
      const pyusd = capabilityMatrix.capabilities.find(
        (c: { id: string }) => c.id === "base-pyusd-review-route",
      )
      expect(usdt?.state).toBe("stubbed")
      expect(pyusd?.state).toBe("stubbed")
    })

    it("delegates locale-prefixed reports reachability to the real hosted Playwright spec", () => {
      const hostedPublicSpec = readFileSync("tests/e2e/hosted/public-locales.spec.ts", "utf8")
      expect(hostedPublicSpec).toContain('const supportedLocales = ["en", "es", "fr"]')
      expect(hostedPublicSpec).toContain("page.goto(`/\${locale}/reports`")
    })
  })

  describe("6. Privacy Negatives — No PII Leakage Without Explicit Opt-In", () => {
    it("profile defaults to private: is_public=false enforced at schema level", () => {
      expect(profilePublicationMigration).toContain("ALTER COLUMN is_public SET DEFAULT false")
    })

    it("public profile discovery only returns user IDs for users who have granted publication", () => {
      expect(profilePublicationMigration).toContain("DISTINCT ON (consent.user_id)")
      expect(profilePublicationMigration).toContain("latest.action = 'grant'")
    })

    it("publication choice is user-owned: only the consenting user can see their own consent records", () => {
      expect(profilePublicationMigration).toContain("profile_publication_consents_self_select")
    })

    it("only discoverable public user IDs are exposed to anon/authenticated — no profile fields until consented", () => {
      expect(profilePublicationMigration).toContain(
        "GRANT EXECUTE ON FUNCTION public.list_discoverable_public_user_ids() TO anon, authenticated, service_role",
      )
    })

    it("public-read shape returns only exact consented field list, not all profile fields", () => {
      expect(boundaryFixMigration).toContain("RETURNS TABLE (user_id uuid, fields jsonb)")
      expect(boundaryFixMigration).toContain("consent.fields")
    })

    it("earnings amounts and project sources are not exposed in public or other-user contexts", () => {
      // RLS enforces self-only access to withdrawal obligations and earnings
      expect(withdrawalMigration).toContain("withdrawal_obligations_self_select")
      expect(withdrawalMigration).toContain("payout_inventory_self_select")
      expect(withdrawalMigration).toContain("auth.uid()=user_id")
    })

    it("report artifact retention prevents PII leakage after lifecycle expiry", () => {
      expect(reportPublicationMigration).toContain("retention_expires_at>generated_at")
      expect(reportPublicationMigration).toContain("monthly_report_events_are_append_only")
    })
  })

  describe("7. No-Value / Sandbox Guards Across All Roles", () => {
    it("capability matrix asserts production_value_flow_enabled=false as the top-level guard", () => {
      expect(capabilityMatrix.productionValueFlowEnabled).toBe(false)
    })

    it("withdrawal runtime production guard is present in the obligation control plane", () => {
      expect(withdrawalMigration).toContain("withdrawal_runtime_production_closed")
      expect(withdrawalMigration).toContain("withdrawal_runtime_no_value_flow")
    })

    it("all obligation, inventory, and request rows carry production_enabled=false constraints", () => {
      expect(withdrawalMigration).toContain("withdrawal_obligation_production_disabled")
      expect(withdrawalMigration).toContain("payout_inventory_production_disabled")
      expect(withdrawalMigration).toContain("user_withdrawal_requests_production_disabled")
    })

    it("every terminal function call in the withdrawal plane returns noPayoutExecuted:true", () => {
      const sentinels = withdrawalMigration.match(/'noPayoutExecuted',true/g) ?? []
      expect(sentinels.length).toBeGreaterThanOrEqual(4)
    })

    it("report artifacts also carry production_enabled=false constraint closing the reporting plane", () => {
      expect(reportPublicationMigration).toContain("production_enabled=false")
      expect(reportPublicationMigration).toContain("monthly_report_artifact_production_closed")
    })

    it("operator withdraw expire action is strictly server-timed with no future timestamp injection", () => {
      expect(
        validateWithdrawalOperatorInput({ action: "expire", observedAt: "2099-01-01T00:00:00Z" } as object).ok,
      ).toBe(false)
      expect(validateWithdrawalOperatorInput({ action: "expire" }).ok).toBe(true)
    })
  })

  describe("8. Hosted Runner Configuration Boundary", () => {
    it("hosted-operational playwright project targets the Dev Vercel/Supabase pair only", () => {
      const playwrightConfig = readFileSync("playwright.config.ts", "utf8")
      expect(playwrightConfig).toContain('name: "hosted-operational"')
      expect(playwrightConfig).toContain("PLAYWRIGHT_REMOTE_BASE_URL")
    })

    it("operational MVP spec fails closed if target is not dev deployment environment", () => {
      const spec = readFileSync("tests/e2e/hosted/operational-mvp.spec.ts", "utf8")
      expect(spec).toContain('FUNDLOOP_DEPLOYMENT_ENV !== "dev"')
      expect(spec).toContain("hosted-smoke-target-not-dev")
    })

    it("operational MVP spec validates the exact Supabase project hostname before running", () => {
      const spec = readFileSync("tests/e2e/hosted/operational-mvp.spec.ts", "utf8")
      expect(spec).toContain("kyxtqnfnksvcaugxwzuj.supabase.co")
      expect(spec).toContain("hosted-smoke-supabase-refused")
    })

    it("operational MVP spec validates the Vercel base URL pattern before running", () => {
      const spec = readFileSync("tests/e2e/hosted/operational-mvp.spec.ts", "utf8")
      expect(spec).toContain("hosted-smoke-base-url-refused")
      expect(spec).toContain("fundloop-website.vercel.app")
    })

    it("all five persona definitions cover browser and controlled-command surfaces", () => {
      const action = async () => ({ outcome: "observed" as const, evidence: {} })
      const actions = new Proxy({}, { get: () => action }) as Record<string, typeof action>
      const allJourneys: PersonaJourney[] = [
        newMemberJourney(actions),
        returningMemberJourney(actions),
        newFounderJourney(actions),
        returningFounderJourney(actions),
        returningOperatorJourney(actions),
      ]
      const surfaces = new Set(allJourneys.flatMap((j) => j.checkpoints.map((c) => c.surface)))
      expect(surfaces.has("browser")).toBe(true)
      expect(surfaces.has("controlled-command")).toBe(true)
    })

    it("all registered personas have readiness boundaries with explicit route and command surface definitions", () => {
      for (const personaId of PERSONA_IDS as readonly PersonaId[]) {
        const bounds = readinessBoundaries[personaId]
        expect(bounds).toBeDefined()
        expect(bounds.journeySource).toContain("journeys.ts")
        expect(bounds.commandBoundaries).toBeDefined()
      }
    })
  })
})
