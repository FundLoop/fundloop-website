import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const migration = readFileSync("supabase/migrations/20260810140000_stripe_connect_payout_control_plane.sql", "utf8")
const integrity = readFileSync("supabase/migrations/20260810141000_stripe_connect_fee_and_commit_recovery.sql", "utf8")
const webhook = readFileSync("supabase/functions/stripe-connect-webhook/index.ts", "utf8")
const account = readFileSync("supabase/functions/stripe-connect-account/index.ts", "utf8")
const payoutOperator = readFileSync("supabase/functions/stripe-connect-payout-operator/index.ts", "utf8")

describe("Stripe Connect payout migration", () => {
  it("keeps production and direct table mutation fail closed", () => {
    expect(migration).toContain("production_value_flow_enabled=false")
    expect(migration).toContain("deployment_environment<>'production'")
    expect(migration).toContain("REVOKE ALL ON TABLE public.stripe_connect_runtime_controls")
    expect(migration).not.toMatch(/GRANT (?:INSERT|UPDATE|DELETE|ALL).*stripe_connect_/)
    expect(payoutOperator.indexOf("stripe_connect_runtime_disabled")).toBeLessThan(payoutOperator.indexOf("new Stripe"))
  })
  it("requires provider settlement plus a balanced ledger before paid", () => {
    expect(migration).toContain("v_status='paid'")
    expect(migration).toContain("post_neutral_ledger_transaction")
    expect(migration).toContain("stripe_connect_paid_and_reconciled")
    expect(migration).toContain("provider_payout_minor")
    expect(integrity).toContain("stripe_connect_fee_inventory_reservations")
    expect(integrity).toContain("stripe_user_fee_revenue")
    expect(integrity).toContain("'resumed',true")
  })
  it("verifies signed test-mode webhooks and never accepts raw bank input", () => {
    expect(webhook).toContain("constructEventAsync")
    expect(webhook).toContain("event.livemode")
    expect(webhook).toContain("STRIPE_CONNECT_WEBHOOK_SECRET")
    expect(account).toContain("accountLinks.create")
    expect(account).not.toMatch(/routing_number|account_number/)
  })
})
