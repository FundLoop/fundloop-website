# Financial cutover runbook

Status: local/dev/test review control for Task #143. This runbook does not authorize a remote database change, production cutover, payable recognition, provider call, or value transfer.

## Outcome and boundary

The cutover replaces ambiguous legacy financial projections with one classified and reproducible handoff to the settlement-backed control plane:

- approved project packages and funding applications are the allocation inputs;
- approved close-package award controls are the normal source of withdrawal obligations;
- an explicitly approved legacy bookkeeping credit can become a provisional opening liability exactly once;
- a user withdrawal request and payout intent are canonical only when they use the project/asset-scoped obligation path;
- legacy records remain available through compatibility reports, while payment, bookkeeping-credit,
  withdrawal-request, and payout-intent monetary writes are disabled after activation;
- `monthly_cycles` remains the lifecycle input to the canonical epoch engine, so lock, calculation,
  approval, distribution, and reporting transitions remain writable through their typed commands.

Production is structurally excluded. `financial_cutover_runtime_controls` disables prepare and activation for `production`, `financial_cutover_instance_state` cannot become canonical in production, and the feature creates no provider call or value flow.

## Classification contract

Every retained source row receives exactly one immutable classification in `financial_cutover_source_records`:

| Classification | Meaning | Canonical treatment |
| --- | --- | --- |
| `externally_verified` | The row already has a settlement-backed or canonical obligation/request link. | Link to the canonical record; do not recreate value. |
| `approved_opening_balance` | An internal operator supplied a source-specific evidence hash for an exact-cent legacy credit. | Post a balanced provisional liability and create one withdrawal obligation. |
| `legacy_unverified` | The projection lacks evidence or a canonical link. | Keep read-only and report the difference; active credit/request/intent rows block activation. |
| `reversed_voided` | The legacy record is voided, cancelled, failed, closed, deleted, or inactive. | Retain evidence only; create no canonical value. |

An approval is valid only for `bookkeeping_credit`, its exact numeric source ID, and a 64-character evidence hash. Sub-cent opening balances block activation until a separate forward decision preserves the remainder; the cutover never rounds an asserted liability upward or silently drops it.

## Prepare and review

1. Run a fresh local migration replay.
2. Invoke the authenticated internal-admin `financial-cutover` Edge command with `action=prepare`, a stable idempotency key, a run evidence hash, and the reviewed opening-balance approvals.
3. Read `financial_cutover_reconciliation_report` and `financial_cutover_source_report` through the same Edge boundary.
4. Resolve every blocker. Warnings for unverified legacy payment/cycle projections are allowed only because those rows remain explicitly classified and excluded from canonical funding.
5. Record the immutable manifest hash. A changed command under the same idempotency key fails rather than silently reclassifying the run.

The prepare command calculates old/new minor-unit totals and records explicit source-level differences. An active bookkeeping credit, withdrawal request, or payout intent cannot disappear into a warning: if it lacks a canonical link or approved opening treatment, it is a blocker.

## Activate locally or in an authorized non-production environment

Invoke `financial-cutover` with `action=activate`, the prepared run ID, exact manifest hash, and activation evidence hash. The database takes one transaction-scoped advisory lock and then:

1. rejects production, a changed manifest, or any remaining blocker;
2. posts each approved exact-cent opening credit through `post_neutral_ledger_transaction`;
3. debits `legacy_opening_balance_control` and credits the user-dimensioned `user_withdrawal_liability_control` by the same functional-USD amount;
4. creates or reuses the unique `source_bookkeeping_credit_id` withdrawal obligation;
5. links existing canonical package, close, request, and payout records without recreating them;
6. switches the singleton read state to canonical and the legacy monetary write state to read-only.

The earnings workspace and monthly-cycle payout overview resolve that singleton through a
server-owned, fail-closed read model. An exact active state reads amount and payment state from the
canonical withdrawal obligation compatibility view; an exact inactive state reads the legacy
credit table; missing or contradictory state returns no monetary rows and an operator warning.

Replay is safe: ledger idempotency keys and unique source obligation/link constraints return the original canonical records. Direct result-based payout intents remain retired independently of this switch.

## Verification

Before accepting the local/non-production cutover, verify:

- `blocker_count = 0` and `difference_minor = 0` for active credits;
- every active legacy credit is linked to exactly one canonical obligation;
- each opening transaction has equal functional debits and credits;
- every canonical withdrawal request retains project, financial asset, obligation claims, and request hash;
- every canonical payout intent points to a withdrawal request and not a published result;
- legacy payment and bookkeeping writes fail after activation while monthly-cycle lifecycle commands
  remain available;
- authenticated clients cannot execute cutover RPCs or write audit tables directly;
- production preparation and activation fail before any mutation.

Executable proof is in `supabase/tests/financial_cutover_control_plane.sql`. Run:

```bash
supabase db reset --local
PGPASSWORD=postgres psql -h 127.0.0.1 -p 55322 -U postgres -d postgres \
  -f supabase/tests/financial_cutover_control_plane.sql
PATH=/opt/homebrew/opt/node@22/bin:$PATH CI=1 pnpm check
```

## Rollback and forward fixes

`action=rollback` is a reversible routing switch, not a destructive undo. It re-enables legacy writes and disables canonical reads for the active non-production run while retaining classifications, links, neutral-ledger transactions, and obligations. Retained canonical records prevent a later run from creating duplicate obligations.

Use a forward migration or a new prepared run to correct classifications, source evidence, or compatibility logic. Never delete audit rows, reset a remote project, edit an applied migration, or erase opening-liability postings. A future production cutover requires its own reviewed change, remote-database authority, professional accounting/legal decisions, provider readiness, backups, and an independently approved production runbook.
