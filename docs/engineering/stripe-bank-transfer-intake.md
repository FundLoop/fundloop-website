# Stripe bank-transfer intake (sandbox review)

Status: provisional, sandbox-only, and production fail-closed.

FundLoop's Stripe intake boundary uses Customer Balance bank transfers with server-side
PaymentIntents. It creates a dedicated Stripe Customer for each FundLoop payment, requests
only the `customer_balance` payment method with `bank_transfer` funding, and returns only a
Stripe-hosted instruction URL to the authenticated project administrator. FundLoop never
stores or returns raw routing or account numbers.

The current Stripe payment-method contract supports USD bank transfers, but not CAD bank
transfer presentment. The application therefore rejects CAD before making a provider call.
CAD remains part of the intended treasury asset model but cannot be activated until Stripe
or a separately approved provider supplies authoritative CAD push-transfer support. Canadian
pre-authorized debit is explicitly out of scope because it is pull-based. See Stripe's
[bank-transfer support](https://docs.stripe.com/payments/bank-transfers) and
[funding-instruction API](https://docs.stripe.com/api/cash_balance_transactions/create_or_retrieve_funding_instructions).

## Trust and evidence boundary

- `stripe-bank-transfer-intent-create` authenticates the founder, requires the exact current
  non-effective Terms acknowledgement, verifies project financial-admin authority and payment
  amount, and rejects non-test Stripe keys.
- The adapter uses deterministic Stripe idempotency keys and creates only Customer Balance
  push-transfer objects. Cards, ACH debit, and Canadian PAD are absent.
- `stripe-bank-transfer-webhook` consumes the unmodified request body, verifies
  `Stripe-Signature` through the Stripe SDK, rejects live-mode events, and independently reads
  the PaymentIntent/charge/dispute plus the current Stripe balance before calling Postgres.
- Postgres rechecks the exact environment, provider account, event/evidence mapping, currency,
  expected amount, gross = fee + net conservation, and custody route. Events and normalized
  evidence are immutable and exact replays are idempotent; changed replays conflict.
- Presentment principal and Stripe balance-settlement amounts are separate evidence ledgers.
  If Stripe converts a USD payment into a CAD balance transaction, FundLoop retains both
  currencies and the settlement gross/fee/net tuple but refuses to classify the USD custody
  route as available. A converted or incomplete balance transaction cannot silently mix units
  or unlock shadow posting.
- Delivery signature timestamps and account-wide balance snapshots may legitimately change on
  an exact Stripe retry. They are excluded from the database replay-equivalence hash, while the
  signed payload and normalized event evidence remain canonical. The Edge boundary short-circuits
  exact signed payload replays before re-reading a provider object that may since have advanced.
- Only signed `payment_intent.succeeded` evidence can create the external financial event,
  bounded financial reference, neutral ledger transaction, funding application, and shadow
  receipt journal. Full refunds or lost disputes reverse the original ledger transaction.
- Out-of-order evidence remains visible without regressing the latest provider-time state.
  The legacy `payments` row is not marked confirmed or mutated by this shadow path.
- The local USD route is labelled `clearing_sweep_required`. Missing evidence of a transfer to
  separately reconcilable custody stays visible and blocks production activation.

Provider payloads, customer IDs, routing details, signature values, and secrets are unavailable
to browser roles. The founder read model contains only FundLoop intent/payment IDs, currency,
amount, normalized status, ordering, shadow-close readiness, and sweep-gate state.

## Local and sandbox validation

1. Authenticate the Stripe CLI to the FundLoop sandbox profile and confirm `livemode=false`.
2. Enable Bank Transfers in the Stripe sandbox Payment Methods settings before claiming the
   provider success path. A `bank_transfer` access error is a blocker, not a fixture success.
3. Run a fresh local Supabase replay and `supabase/tests/stripe_bank_transfer_intake.sql`.
4. Start the webhook function with untracked `STRIPE_SECRET_KEY`, `STRIPE_ACCOUNT_ID`, and the
   temporary `STRIPE_WEBHOOK_SECRET` printed by `stripe listen`.
5. Forward only required test event types and prove valid signature, invalid signature,
   duplicate, delayed/out-of-order, availability, mismatch, refund/dispute, and balance cases.
6. Run focused Vitest/component tests, desktop/mobile founder-browser evidence, and the full
   Node 22 `CI=1 pnpm check` gate.

Never put Stripe keys or webhook secrets in tracked files. Do not use `--live`, live-mode keys,
remote production Supabase, or real funds for this workflow.
