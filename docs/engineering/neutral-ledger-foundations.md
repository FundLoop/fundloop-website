# Neutral ledger foundations

Task #127 introduces a non-production accounting substrate for local and preview
validation. It is infrastructure, not approved bookkeeping policy. The schema does
not decide ownership, payable, revenue, expense, tax, principal-agent, gross-net,
refund, reserve, expiry, custody, or abandoned-property treatment.

## Boundary

The foundation stores:

- provisional financial assets, custody references, and retained source references;
- neutral account keys and Pacific-time accounting periods;
- append-only transactions and ordered debit/credit postings;
- exact `numeric(78,0)` native atomic quantities and exact numeric functional USD/FX;
- immutable evidence and command hashes, idempotency keys, actor evidence, optional
  project/user dimensions, and typed reversal lineage.

All financial foreign keys use retained `RESTRICT` behavior. Direct browser writes
and RPC execution are revoked. Authenticated reads are limited to a posting's user
or an existing participant in its project; service commands own posting. Posted
transactions and postings cannot be updated or deleted, including by a privileged
caller using ordinary DML.

## Posting contract

Future Edge commands must validate requests through
`supabase/functions/_shared/ledger-posting-contract.ts`, derive the actor and runtime
environment at the trusted boundary, and then call one of the service-role-only RPCs:

- `post_neutral_ledger_transaction(jsonb)`
- `reverse_neutral_ledger_transaction(jsonb)`

The database serializes each idempotency key with a transaction-scoped advisory lock,
locks periods/references/accounts in a stable order, rejects closed periods, requires
functional and per-asset/custody native balance, and prevents active applications from
exceeding a retained reference's exact native limit. Reversal creates a new transaction
with inverted postings; it never mutates the original.

## Production gate

The Edge contract accepts only an explicitly configured local, development, dev,
preview, or test runtime. It rejects missing and production runtime identity even if a
request body claims otherwise. The database independently rejects `production`, and
the production runtime-control row is constrained to neutral posting off, value flow
off, and no professional approval reference. Every asset, custody account, reference,
account, and period created by this Task is also constrained production-disabled.

Production activation requires a later forward migration plus qualified counsel and
accountant/bookkeeper approval evidence. Task #127 creates no external event adapter,
opening balance, user-visible payable, transfer instruction, provider call, or legacy
cutover.

## Local validation

`supabase/seed.sql` contains explicitly labelled local-only fixtures. They do not claim
settlement or custody. Validate from a disposable local stack:

```bash
supabase db reset
psql postgresql://postgres:postgres@127.0.0.1:55322/postgres \
  -f supabase/tests/neutral_ledger_foundations.sql
supabase gen types typescript --local > types/supabase.ts
```

The SQL suite proves balanced posting, exact amounts, idempotent replay, conflict and
over-application rejection, typed reversal, closed-period rejection, append-only and
direct-write denial, user/project isolation, production fail-closed behavior, and the
targeted user/project query plans.
