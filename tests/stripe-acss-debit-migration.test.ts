import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const sql = readFileSync("supabase/migrations/20260811100000_stripe_acss_debit_intake.sql", "utf8")
const lifecycleSql = readFileSync("supabase/migrations/20260811103000_stripe_acss_debit_lifecycle_integrity.sql", "utf8")
const edge = readFileSync("supabase/functions/stripe-acss-debit-checkout-create/index.ts", "utf8")
const webhook = readFileSync("supabase/functions/stripe-acss-debit-webhook/index.ts", "utf8")

describe("Stripe ACSS debit boundaries", () => {
  it("keeps production and USD fail closed with service-only commands", () => {
    expect(sql).toContain("stripe_acss_runtime_usd_closed_check")
    expect(sql).toContain("deployment_environment <> 'production' OR NOT checkout_enabled")
    expect(sql).toContain("REVOKE INSERT,UPDATE,DELETE,TRUNCATE")
    expect(sql).toContain("TO service_role")
  })
  it("requires mandate, available balance evidence, conserved fees, and reversal", () => {
    expect(sql).toContain("stripe_acss_mandate_or_session_mismatch")
    expect(sql).toContain("stripe_acss_availability_evidence_missing")
    expect(sql).toContain("feeAmountMinor")
    expect(sql).toContain("reverse_neutral_ledger_transaction")
  })
  it("uses dynamic Checkout and signed authoritative refetch", () => {
    expect(edge).not.toContain("payment_method_types")
    expect(edge).toContain("payment_method_configuration")
    expect(edge).toContain("integration_identifier")
    expect(webhook).toContain("constructEventAsync")
    expect(webhook).toContain("authoritativeObservation")
    expect(webhook).toContain("paymentIntents.retrieve")
    expect(webhook).toContain("checkout.sessions.list")
  })
  it("pins provider identities and invalidates disputed or reversed package sources", () => {
    expect(lifecycleSql).toContain("stripe_acss_provider_identity_conflict")
    expect(lifecycleSql).toContain("stripe_acss_terminal_evidence_blocks_settlement")
    expect(lifecycleSql).toContain("stripe_acss_debit_package_invalidations")
    expect(lifecycleSql).toContain("NOT IN ('disputed','refunded','dispute_lost')")
  })
})
