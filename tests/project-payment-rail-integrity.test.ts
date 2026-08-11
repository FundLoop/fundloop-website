import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const sql = readFileSync("supabase/migrations/20260811115000_project_payment_rail_integrity.sql", "utf8")
const acssCheckout = readFileSync("supabase/functions/stripe-acss-debit-checkout-create/index.ts", "utf8")
const pbbCheckout = readFileSync("supabase/functions/stripe-pay-by-bank-checkout-create/index.ts", "utf8")
const acssWebhook = readFileSync("supabase/functions/stripe-acss-debit-webhook/index.ts", "utf8")

describe("project payment rail integrity", () => {
  it("derives source currency from an append-only reviewed quote", () => {
    expect(sql).toContain("project_payment_funding_quotes")
    expect(sql).toContain("source_amount_minor")
    expect(sql).toContain("v_source:=round((v_payment.payment_amount/v_rate)*power")
    expect(sql).toContain("stripe_acss_funding_quote_unavailable")
    expect(sql).toContain("stripe_pay_by_bank_funding_quote_unavailable")
    expect(acssCheckout).toContain("funding_quote_id")
    expect(pbbCheckout).toContain("funding_quote_id")
    expect(acssCheckout).not.toContain("input.data.expectedAmountMinor")
    expect(pbbCheckout).not.toContain("input.data.expectedAmountMinor")
  })

  it("claims exactly one settled rail for each payment and binds packages to it", () => {
    expect(sql).toContain("project_payment_settled_rail_claims")
    expect(sql).toContain("project_payment_already_settled_on_another_rail")
    expect(sql).toContain("epoch_project_package_payment_rail_claim_mismatch")
    expect(sql).toContain("pg_advisory_xact_lock")
  })

  it("records failed or canceled ACSS observations without inventing a mandate", () => {
    expect(sql).toContain("v_terminal_without_mandate")
    expect(sql).toContain("ingest_stripe_acss_debit_webhook_requiring_mandate")
    expect(acssWebhook).toContain("terminalBeforeMandate")
    expect(acssWebhook).toContain('["failed", "canceled"]')
  })
})
