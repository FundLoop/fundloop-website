# Session Log: Goal #126 Ledger Control Plane

### session v1: Neutral ledger foundations (#127)

- Timestamp: 2026-08-09T01:20:00-04:00
- Agent: Codex
- Branch: codex/126-ledger-control-plane
- Head: 1cd8b822484c

#### Objective

Implement Task #127's neutral asset, custody, retained-reference, ledger, and
accounting-period foundations without selecting definitive accounting/legal policy,
switching legacy paths, or enabling production value flow.

#### Actions Taken

- Added forward-only schema for provisional financial assets, custody accounts,
  retained native-limit references, neutral accounts, Pacific-time periods,
  append-only transactions, and exact ordered postings.
- Added service-role-only atomic posting and reversal functions with trusted runtime
  controls, advisory locks, stable account locking, idempotency hashes, exact
  functional/native balance, reference conservation, open-period enforcement, and
  immutable reversal lineage.
- Added RLS-scoped user/project reads, direct browser write/RPC denial, retained
  `RESTRICT` foreign keys, and targeted foreign-key, composite, and partial indexes.
- Added a typed shared Edge contract that derives actor/runtime context rather than
  trusting command input and fails closed for missing or production runtime identity.
- Added explicitly labelled local-only fixtures, generated Supabase types, executable
  SQL/RLS/query-plan assertions, focused TypeScript tests, and operating documentation.

#### Validation Notes

- Passed: two fresh disposable local Supabase resets applying all migrations and seed.
- Passed: executable SQL for production/direct-write denial, balanced and unbalanced
  posting, exact native/USD conservation, idempotent replay/conflict, reference
  over-application, idempotent typed reversal, closed periods, append-only retention,
  user/project/unrelated RLS, and production runtime controls.
- Passed: forced query plans used `ledger_postings_user_idx` and
  `ledger_postings_project_idx`.
- Passed: focused Vitest, 2 files and 17 tests.
- Passed: local schema lint with no new ledger warning; one pre-existing unrelated
  unused invitation-function parameter warning remains.
- Passed: Node 22 lint/typecheck and full `CI=1 pnpm check` with 128 files/580 tests
  plus production build.
- Passed: generated type review and `git diff --check`.

#### Reflections

- The Supabase/Postgres best-practices guidance led to indexed policy dimensions,
  retained foreign keys, partial indexes, stable lock ordering, short database-only
  commands, and transaction-scoped advisory locks.
- Production fail-closed behavior needs agreement at the trusted Edge contract,
  database runtime-control row, RPC environment check, and every provisional
  financial reference; no request-body override can activate it.
- Reversal remains append-only and releases reference capacity only through explicit
  lineage, without rewriting the original source application.

#### Suggested Next Steps

- Commit Task #127 and attach the replay, executable SQL, exact-amount, RLS, query-plan,
  contract, and full-check evidence to the issue.
- Leave #127 In Progress for independent validation; stop local Supabase and do not
  open a PR or change Goal #126 status.
