import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const sql = readFileSync("supabase/migrations/20260811110000_stripe_pay_by_bank_intake.sql", "utf8")
const edge = readFileSync("supabase/functions/stripe-pay-by-bank-checkout-create/index.ts", "utf8")
const webhook = readFileSync("supabase/functions/stripe-pay-by-bank-webhook/index.ts", "utf8")

describe("Stripe Pay by Bank boundaries", () => {
  it("keeps production fail closed and EUR/GBP service-only", () => {
    expect(sql).toContain("currency_code IN('EUR','GBP')")
    expect(sql).toContain("deployment_environment <> 'production' OR NOT checkout_enabled")
    expect(sql).toContain("REVOKE INSERT,UPDATE,DELETE,TRUNCATE")
    expect(sql).toContain("TO service_role")
  })
  it("requires authoritative identity, available balance evidence, conserved fees, and exact refund handling", () => {
    expect(sql).toContain("stripe_pay_by_bank_identity_or_country_mismatch")
    expect(sql).toContain("stripe_pay_by_bank_availability_evidence_missing")
    expect(sql).toContain("feeAmountMinor")
    expect(sql).toContain("reverse_neutral_ledger_transaction")
    expect(sql).toContain("stripe_pay_by_bank_refund_residual")
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
  it("pins provider identities and invalidates refund-pending or refunded package sources", () => {
    expect(sql).toContain("stripe_pay_by_bank_provider_identity_conflict")
    expect(sql).toContain("stripe_pay_by_bank_terminal_evidence_blocks_settlement")
    expect(sql).toContain("stripe_pay_by_bank_package_invalidations")
    expect(sql).toContain("reason IN('refund_pending','refunded')")
  })
})
