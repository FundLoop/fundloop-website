# Stripe Connect sandbox payouts

Status: review-only, sandbox/test mode, production disabled.

## Boundary

FundLoop uses Stripe-hosted Express onboarding for payout recipients. FundLoop never collects or stores routing numbers, account numbers, or raw bank credentials. The application retains only the connected-account reference, readiness flags, requirement counts, country/currency, and an external-account last four.

The withdrawal obligation remains the canonical source. The provider sequence is:

1. A user creates one inventory-backed withdrawal request.
2. Stripe-hosted onboarding must report `details_submitted`, payouts enabled, an eligible external account, and no currently-due requirements.
3. An internal operator submits the persisted payout intent. The adapter transfers only the net provider-native amount to the connected account, then creates a standard payout with separate idempotency keys.
4. Signed connected-account webhooks update provider state. Duplicate events are payload-bound; older events are retained as out of order without regressing state.
5. `payout.paid` is not sufficient by itself. FundLoop matches account, payout ID, currency, provider-native amount, and canonical USD value, posts a balanced neutral-ledger transaction, then atomically marks the execution attempt, intent, withdrawal, claims, and reservations reconciled/paid.

Failed or canceled payouts move the withdrawal to remediation. If the platform-to-connected-account transfer already succeeded, retry reuses that transfer and creates only a new payout, preventing double funding.

## Currency model

- USD and CAD routes are allowed.
- Withdrawal entitlements and user-fee snapshots remain canonical USD minor units.
- The provider payout uses the selected inventory asset's native minor units at the originating locked FX snapshot.
- Ledger postings retain both functional USD and provider-native amount/FX evidence.

## Local configuration

Use only untracked local environment values:

```text
FUNDLOOP_DEPLOYMENT_ENV=local
FUNDLOOP_SITE_URL=http://127.0.0.1:3000
STRIPE_SECRET_KEY=sk_test_...
STRIPE_ACCOUNT_ID=acct_...
STRIPE_CONNECT_WEBHOOK_SECRET=whsec_...
```

The secret key must be test mode and must resolve to the configured platform account. Start a local signed webhook forwarder with the official Stripe CLI:

```bash
stripe listen --project-name=fundloop \
  --events account.updated,payout.created,payout.updated,payout.paid,payout.failed,payout.canceled \
  --forward-connect-to http://127.0.0.1:55321/functions/v1/stripe-connect-webhook
```

Do not track the temporary webhook secret. Do not use `--live`.

## Sandbox checkpoint

The code and local database can exercise incomplete onboarding, requirements changes, USD/CAD native amounts, idempotent provider submission, failure/remediation, duplicate/out-of-order events, and paid-plus-journal reconciliation. An actual Stripe-hosted onboarding/payout checkpoint additionally requires Connect to be enabled on the Fundloop sandbox account. If the API reports that the account has not signed up for Connect, enable Connect in the sandbox Dashboard before retrying; this is a provider-account configuration gate, not permission to activate production.

## Production gates

Production remains fail closed in Edge runtime controls and database constraints. Before production, require all of the following:

- approved effective Terms/Privacy and production consent evidence;
- qualified counsel and accountant/bookkeeper approval;
- verified live Connect platform configuration, liability/pricing model, supported countries/currencies, webhook endpoint, and key custody;
- reviewed custody, fee, FX, payout, failure, reversal, reconciliation, monitoring, and incident runbooks;
- controlled-value live evidence authorized separately.

No production key, account activation, payout, provider transfer, or real value flow is part of #141.
