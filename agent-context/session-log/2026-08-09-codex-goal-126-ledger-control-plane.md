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

### session v2: Ledger integrity validator fixes (#127)

- Timestamp: 2026-08-09T01:32:00-04:00
- Agent: Codex
- Branch: codex/126-ledger-control-plane
- Head: 0ff6320c706b

#### Objective

Close the three #127 validator findings without changing the provisional accounting
boundary or introducing a production/value-flow path.

#### Actions Taken

- Added a forward-only composite foreign key from financial reference asset/custody
  to the custody account's own asset, preventing cross-asset reference combinations.
- Added an insert-time database trigger requiring every posting or reversal effective
  timestamp to fall within the selected period's half-open range.
- Removed actor type from untrusted request contracts and bound actor type, actor ID,
  and deployment environment exclusively from trusted Edge runtime context.
- Extended SQL, contract, static migration, documentation, and generated-type evidence
  for crafted actor values, EUR/USD custody mismatch, and out-of-period service calls.

#### Validation Notes

- Passed: fresh disposable local Supabase reset with the forward integrity migration
  and seed.
- Passed: executable SQL rejection of a EUR asset reference to USD custody, a post at
  the exact period end, and a reversal before the period start; all prior ledger/RLS,
  exact-amount, idempotency, reversal, retention, and query-plan assertions stayed green.
- Passed: focused Vitest, 2 files and 17 tests, including crafted request actor type,
  actor ID, and environment replacement with trusted values.
- Passed: Node 22 lint/typecheck and full `CI=1 pnpm check` with 128 files/580 tests
  plus production build.
- Passed: regenerated Supabase type review and `git diff --check`.

#### Reflections

- The composite foreign key encodes custody/asset agreement as relational identity,
  avoiding a trigger-only invariant that could drift from foreign-key behavior.
- A transaction trigger protects every insertion path, so both current RPCs and future
  privileged writers share the same half-open accounting-period boundary.
- Trusted actor mode is command-boundary context, not a request-body field.

#### Suggested Next Steps

- Commit and attach the fresh replay and adversarial evidence to #127.
- Leave #127 In Progress for independent revalidation; stop Supabase and do not open a
  PR or change Goal #126 status.

### session v3: Shadow epoch state machine (#128)

- Timestamp: 2026-08-08T21:50:34-04:00
- Agent: Codex
- Branch: codex/126-ledger-control-plane
- Head: a4edbccd59a8

#### Objective

Implement the approved 12-stage epoch workflow as a local/development shadow control
plane without changing legacy monthly-cycle outcomes, enabling production execution,
or moving value.

#### Actions Taken

- Added forward schema for shadow states, queued attempts, hard/soft gate evidence,
  audited single-admin overrides, business-calendar rows, and artifact references.
- Added service-only enqueue, skip-locked claim, completion, override, and pause/resume
  RPCs with production controls, advisory transaction locks, idempotency keys, and
  optimistic state versions.
- Added Pacific fake-clock helpers for month cutoffs, email-relative business-day
  deadlines, DST/month transitions, payout expiry, the 12-stage ordering, and a
  conservative read-only legacy mapping.
- Added a typed internal-secret Edge scheduler boundary, local scheduler orchestration,
  generated types/config, and a service-role admin observability read model.
- Added an explicitly provisional admin panel and engineering documentation stating
  that the shadow machine cannot change legacy outcomes or enable value flow.

#### Validation Notes

- Passed: fresh local Supabase reset applying all migrations and local fixtures.
- Passed: executable SQL for production and authenticated-browser denial, idempotent
  cron/manual enqueue, distinct `SKIP LOCKED` claims, optimistic supersession,
  pause/resume, hard-gate blocking, audited override retry, artifact evidence, and
  unchanged legacy monthly-cycle status.
- Passed: focused Vitest with 2 files and 7 tests covering 12 stages, compatibility,
  DST/month/holiday fake clocks, expiry/close, trusted production denial, locks, and
  non-mutation boundaries.
- Passed: Node 22 lint, typecheck, and full `CI=1 pnpm check` with 130 files/587 tests
  plus production build; passed `git diff --check`.
- Passed: authenticated local Playwright desktop 1440x900 and mobile 390x844 smoke of
  the shadow observability row with zero browser console errors. Screenshots are kept
  as ignored local evidence under `output/playwright/`.

#### Reflections

- Claim and completion are separate database transactions, so external evaluation can
  occur only after the row lock is released; the schema also constrains the recorded
  no-external-call invariant to true.
- Production denial is layered at the Edge boundary, scheduler, database runtime row,
  service RPCs, and schema production flags.
- Compatibility mapping is observability-only and contains no write to the legacy
  `monthly_cycles` workflow.

#### Suggested Next Steps

- Commit Task #128 and attach migration replay, executable concurrency/gate evidence,
  focused/full checks, and desktop/mobile smoke to the issue.
- Leave #128 In Progress for independent validation, stop services, and do not start
  #129 or open a PR.

### session v4: Shadow epoch validator fixes (#128)

- Timestamp: 2026-08-08T22:05:22-04:00
- Agent: Codex
- Branch: codex/126-ledger-control-plane
- Head: 254eebc24ea8

#### Objective

Close #128's idempotency, required-gate, override-provenance, and operational
scheduling findings without enabling production, changing legacy outcomes, or
introducing value flow.

#### Actions Taken

- Added a forward-only migration that compares every canonical transition field on
  idempotent replay and returns an explicit conflict for changed payloads.
- Added a required hard-gate registry for all eleven transitions and made completion
  fail attempts with missing gates before any stage change.
- Bound override evidence to one claimed attempt, exact state/transition/gate, an
  override-eligible requirement, and the same internal-admin actor as the attempt.
- Linked shadow states to regional business calendars and added explicit readiness,
  email-delivery, payout-open, and carryover-completion scheduling inputs.
- Operationalized cutoff, intermediate readiness, holiday-aware opt-out, payout
  expiry, and final close enqueue decisions, plus a tracked five-minute non-production
  scheduler manifest.
- Extended executable SQL, fake-clock/orchestration tests, docs, and generated types.

#### Validation Notes

- Passed: two fresh local Supabase resets applying the forward migration and seed.
- Passed: executable SQL proving empty collecting gates fail, changed payloads conflict,
  unrelated overrides fail, exact overrides can satisfy only eligible gates, concurrent
  claims remain distinct, and legacy status remains unchanged.
- Passed: focused Vitest with 3 files and 10 tests covering all trigger derivations,
  holiday linkage, fake clocks, production denial, and scheduled manifest behavior.
- Passed: Node 22 lint and typecheck; full check recorded after this session entry.
- Passed: `git diff --check`. Browser evidence is N/A because the prior validated admin
  UI was not changed by these database/orchestration corrections.

#### Reflections

- An idempotency key is safe only when a replay proves equality of the command it names.
- A gate table makes transition requirements data-visible and prevents an empty result
  array from being treated as successful evidence.
- Scheduler inputs now come from persisted state and linked calendar data rather than
  optional caller-only values.

#### Suggested Next Steps

- Commit the narrow #128 corrections and attach fresh replay, adversarial SQL,
  scheduler fake-clock, and full-check evidence.
- Leave #128 In Progress for independent revalidation, stop services, and do not start
  #129 or open a PR.

### session v6: Shadow external financial reconciliation (#129)

- Timestamp: 2026-08-08T22:26:30-04:00
- Agent: Codex
- Branch: codex/126-ledger-control-plane
- Head: 704afad1c0b4

#### Objective

Add immutable external-event and shadow reconciliation foundations without provider
calls, canonical cutover, payables, transfers, or production value flow.

#### Actions Taken

- Added deduplicated immutable provider/chain events with out-of-order classification,
  custody/asset integrity, and labelled legacy non-settlement timestamp evidence.
- Added bounded funding applications, account/asset tolerance snapshots, exactly
  conserved receipt/fee/allocation/payout/suspense journals, and close-package scaffolding.
- Added an internal-secret Edge ingestion command, typed contract, service-only operator
  read model, generated types, executable SQL, focused tests, and documentation.

#### Validation Notes

- Passed: fresh local Supabase replay and executable SQL covering replay/conflict,
  out-of-order classification, over-application denial, variance, exact conservation,
  production denial, and authenticated read denial.
- Passed: focused tests, typecheck, lint, and diff-check; full Node 22 check follows.
- Browser N/A: no operator UI route changed; this task supplies the read model only.

#### Suggested Next Steps

- Commit and attach evidence to #129; leave it In Progress for independent validation.
- Stop services, do not change Goal #126, and do not open a PR.

### session v5: Recurring scheduler idempotency (#128)

- Timestamp: 2026-08-08T22:17:19-04:00
- Agent: Codex
- Branch: codex/126-ledger-control-plane
- Head: e5321295bf81

#### Objective

Make recurring scheduler polls reuse the same canonical attempt for an unchanged
eligible state while retaining conflicts for genuinely changed commands.

#### Actions Taken

- Separated eligibility poll time from canonical transition trigger time.
- Derived `scheduled_for` from the persisted period cutoff, stage readiness instant,
  holiday-aware opt-out deadline, payout expiry, or carryover/state evidence time.
- Kept the deterministic key bound to state/version/target/gate so recurring ticks
  submit the exact same payload to the database idempotency boundary.
- Added a real scheduler probe that executes ticks at 08:00 and 08:05 and compares the
  complete RPC payload, key, and stable 07:00 cutoff schedule.

#### Validation Notes

- Passed: fresh local Supabase reset and the full executable epoch SQL suite.
- Passed: focused Vitest with 3 files and 11 tests, including repeated-tick reuse.
- Passed: Node 22 typecheck, lint, and full check recorded after this entry.
- Passed: `git diff --check`. Browser evidence is N/A because this is orchestration-only.

#### Reflections

- Poll time answers whether a trigger is due; it must never become part of the command
  identity once the underlying trigger instant is known.

#### Suggested Next Steps

- Commit and attach recurring-tick, fresh replay, SQL, and full-check evidence to #128.
- Leave #128 In Progress for independent revalidation, stop services, and do not start
  #129 or open a PR.
