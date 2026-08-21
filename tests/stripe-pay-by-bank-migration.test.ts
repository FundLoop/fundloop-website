import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const sql = readFileSync("supabase/migrations/20260811110000_stripe_pay_by_bank_intake.sql", "utf8")
const fixes = readFileSync("supabase/migrations/20260811111000_stripe_pay_by_bank_validator_fixes.sql", "utf8")
const refundNormalization = readFileSync("supabase/migrations/20260811112000_stripe_pay_by_bank_refund_normalization.sql", "utf8")
const refundOrdering = readFileSync("supabase/migrations/20260811113000_stripe_pay_by_bank_refund_ordering.sql", "utf8")
const edge = readFileSync("supabase/functions/stripe-pay-by-bank-checkout-create/index.ts", "utf8")
const webhook = readFileSync("supabase/functions/stripe-pay-by-bank-webhook/index.ts", "utf8")
const fixture = readFileSync("supabase/tests/stripe_pay_by_bank_intake.sql", "utf8")

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
    expect(edge).toContain("stripe.accounts.retrieve(null)")
    expect(edge).toContain("activeMethods.length === 1")
    expect(edge).toContain('(chargeTopology === "platform") !== (providerAccountId === platformAccountId)')
  })
  it("pins provider identities and invalidates refund-pending or refunded package sources", () => {
    expect(sql).toContain("stripe_pay_by_bank_provider_identity_conflict")
    expect(sql).toContain("stripe_pay_by_bank_terminal_evidence_blocks_settlement")
    expect(sql).toContain("stripe_pay_by_bank_package_invalidations")
    expect(sql).toContain("reason IN('refund_pending','refunded')")
  })
  it("supports only implemented topologies, keeps private previews closed, and retires cumulative refund residuals", () => {
    expect(fixes).toContain("charge_topology IN('platform','direct')")
    expect(fixes).toContain("stripe_pay_by_bank_topology_account_mismatch")
    expect(fixes).toContain("upper(p_command->>'customerCountry') IN('FR','DE','IE')")
    expect(fixes).toContain("retire_prior_stripe_pay_by_bank_residuals")
    expect(fixes).toContain("stripe_pay_by_bank_residual_retirements")
  })
  it("keeps the current refund object amount separate from cumulative successful refunds", () => {
    expect(webhook).toContain("refund ? String(refund.amount) : null")
    expect(webhook).toContain("refund ? String(charge?.amount_refunded ?? 0) : null")
    expect(refundNormalization).toContain("current_refund_amount_minor")
    expect(refundNormalization).toContain("cumulative_successful_refund_amount_minor")
    expect(refundNormalization).toContain("stripe_pay_by_bank_refund_observations_append_only")
    expect(refundNormalization).toContain("stripe_pay_by_bank_refund_normalization_missing")
    expect(refundNormalization).toContain("CASE WHEN p_command->>'evidenceType'='refunded' THEN v_cumulative ELSE v_current END")
  })
  it("ignores equal or decreasing cumulative refund observations without losing signed evidence", () => {
    expect(refundOrdering).toContain("v_cumulative<=v_max_cumulative")
    expect(refundOrdering).toContain("stripe_pay_by_bank_refund_observations_provider_event_key")
    expect(refundOrdering).toContain("provider_event_id=p_command->>'providerEventId'")
    expect(refundOrdering).toContain("stripe_pay_by_bank_webhook_dedupe_conflict")
  })

  it("proves the EUR settlement from persisted provider evidence through allocation close and reports", () => {
    for (const accountableFailure of [
      "eur_provider_quote_ledger_provenance_failed",
      "eur_package_source_persisted_provenance_failed",
      "eur_financial_prep_persisted_provenance_or_conservation_failed",
      "eur_calculator_artifact_persisted_result_mismatch",
      "eur_close_persisted_hash_or_amount_conservation_failed",
      "eur_report_persisted_root_or_bytes_hash_failed",
    ]) expect(fixture).toContain(accountableFailure)

    expect(fixture).toMatch(/v_provider\.gross_amount_minor<>v_provider\.fee_amount_minor\+v_provider\.net_amount_minor/)
    expect(fixture).toMatch(/posting\.native_atomic_amount<>v_quote\.source_amount_minor[\s\S]*posting\.functional_usd_amount<>v_quote\.obligation_usd_minor\/100/)
    expect(fixture).toMatch(/v_lot\.gross_exact_usd<>v_lot\.project_fee_exact_usd\+v_lot\.base_fee_exact_usd\+v_lot\.distributable_exact_usd/)
    expect(fixture).toMatch(/jsonb_to_recordset\(v_artifact->'sourceDispositions'\)[\s\S]*epoch_allocation_source_dispositions/)
    expect(fixture).toMatch(/jsonb_agg\(jsonb_build_object\([\s\S]*'artifactKey'[\s\S]*'artifactHash'/)
  })
})
