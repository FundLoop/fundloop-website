# Stripe Canadian PAD intake

Status: non-production implementation; legal/accounting activation deferred.

FundLoop uses Stripe-hosted Checkout for a one-time, on-session Canadian pre-authorized debit. CAD is the only enabled denomination. FundLoop never collects or stores account, transit, or institution numbers, a Checkout client secret, or raw provider payloads. The browser sends only the project slug, payment ID, CAD, and the expected minor-unit amount.

The Checkout command authenticates a project financial administrator, requires the current review Terms acknowledgement, and prepares an idempotent local command before provider mutation. It then verifies the test account's `acss_debit_payments` capability and a dedicated active payment-method configuration in which ACSS debit is the only enabled method. Checkout uses that dynamic configuration and does not send `payment_method_types`. It does not save the method for future use or authorize off-session mandate reuse.

Returning from Checkout is never settlement. A verified Stripe signature triggers authoritative SDK reads of the Checkout Session, PaymentIntent, Charge, PaymentMethod, mandate identifier, and BalanceTransaction. Every event resolves the unique Checkout Session for the authoritative PaymentIntent; the command pins the Session, PaymentIntent, Charge, and mandate identities on first evidence and rejects later identity drift. Only an ACSS debit with an exact command/session/account/currency/amount/mandate match, a conserved gross = fee + net balance transaction, and `balance_transaction.status=available` creates the provisional custody reference and balanced neutral-ledger receipt.

Processing, failure, cancellation, refund, and dispute evidence stays append-only. An open dispute blocks package eligibility immediately. A full refund or lost dispute is durable terminal evidence: it reverses the receipt once, appends invalidation evidence for every package source already using the command, marks those packages unsettled, and prevents an older settlement event arriving later from posting. A won dispute can make the source eligible for a newly validated package, but never silently repairs an already-invalidated package.

The local CAD custody route and USD functional conversion are explicitly provisional fixtures. Production is disabled at Edge, runtime-control, route, command, evidence, and ledger layers. USD is also disabled because FundLoop does not yet have a privacy-safe authoritative signal proving that the exact payer account accepts USD PAD. Provider capability/configuration absence is shown truthfully and causes zero Checkout mutation.

Validation:

```bash
DOCKER_CONTEXT=colima-codex-supabase supabase db reset --local
PGPASSWORD=postgres psql -h 127.0.0.1 -p 55322 -U postgres -d postgres -v ON_ERROR_STOP=1 -f supabase/tests/stripe_acss_debit_intake.sql
deno check --config supabase/functions/deno.json supabase/functions/stripe-acss-debit-*/index.ts
CI=1 pnpm exec vitest run tests/stripe-acss-debit-*.test.ts tests/stripe-acss-debit-*.test.tsx
```

Required untracked test configuration is `STRIPE_SECRET_KEY`, `STRIPE_ACCOUNT_ID`, `STRIPE_ACSS_DEBIT_PAYMENT_METHOD_CONFIGURATION_ID`, `STRIPE_ACSS_DEBIT_WEBHOOK_SECRET`, `FUNDLOOP_DEPLOYMENT_ENV`, and `FUNDLOOP_APP_ORIGIN`. Use test-mode restricted credentials where possible; never commit them and never run this flow with `--live`.
