# Persona Happy-Path Harness

Status: narrowed design input for Feature [#96](https://github.com/FundLoop/fundloop-website/issues/96). Task [#98](https://github.com/FundLoop/fundloop-website/issues/98) owns the executable contracts and capability-gap policy; this document records the options and decisions that precede that design.

## Objective

Build toward a locally executable browser harness that describes FundLoop through durable persona journeys. The harness should grow checkpoint by checkpoint as the product grows, while reporting unavailable capabilities honestly instead of hiding them behind unconditional skips.

The initial harness is a complement to focused unit, command, contract, wallet, and operational smoke tests. It is not a replacement for them and must not implement missing product capabilities in order to make a journey appear complete.

## Requested Journeys

| Persona | Happy-path outcome |
| --- | --- |
| New member | Signs up through local OTP, logs in, creates a personal profile, sees accumulated earnings and their project sources, and reaches the withdrawal checkpoint. |
| Returning member | Logs in with a deterministic existing account, sees the existing profile and accumulated earnings/project sources, and reaches the withdrawal checkpoint. |
| New founder | Signs up through local OTP, logs in, creates a personal profile and project profile, invites collaborators, submits the month's contribution and active-user attribution, advances through the monthly cadence, and sees the resulting distribution. |
| Returning founder | Logs in with a deterministic existing account, resumes an existing project, submits the next month's contribution and active-user attribution, advances through the cadence, and sees the resulting distribution. |
| Returning operator | Logs in with a deterministic allowlisted account, prepares and executes the controlled monthly cadence, and sees performance plus per-user and per-project allocation outcomes. |

Each persona must be independently selectable. “Returning users” therefore means both returning members and returning founders; the operator journey is returning-only in the initial scope.

## Current Evidence

Repository and Project evidence was reviewed on 2026-08-04:

- `playwright.config.ts` already defines `remote-safe` and `local-wallet` Playwright projects, with retained traces, screenshots, and video on failure.
- `tests/e2e/remote/project-payments.spec.ts` and `tests/e2e/local/wallet-payments.spec.ts` prove focused project-payment behavior. They do not model complete selectable persona journeys.
- `tests/e2e/support/supabase-fixtures.ts` provides run-scoped identifiers, service-role fixture setup, and ordered cleanup for existing payment scenarios.
- `tests/e2e/support/e2e-login.ts` provides an internal, secret-gated login path suitable for deterministic returning and operator actors. It is not evidence of the public signup and OTP flow required for new personas.
- `scripts/run-playwright-local-wallet.mjs` demonstrates local orchestration of an app server, a local EVM node, contract deployment, environment wiring, and child-process cleanup. A persona runner should reuse or compose these primitives rather than create an unrelated orchestration system.
- `docs/engineering/env-and-testing.md` defines local Supabase at the `5532x` port block, including Mailpit at `55324`, and reserves local Supabase for destructive fixture work and local browser flows.
- `docs/engineering/monthly-cycles.md` documents Edge Function command boundaries and the deterministic monthly-cycle stages. Persona tests should drive those controlled commands and observable UI states rather than wait for wall-clock time or write around command authorization.
- `docs/engineering/operational-mvp-local-validation.md` records a deterministic `2026-05` founder/operator/member smoke through contribution, attribution, lock, calculation, verification, approval, bookkeeping credits, and credited-but-not-paid UI evidence.
- Feature [#51](https://github.com/FundLoop/fundloop-website/issues/51) and Goal [#60](https://github.com/FundLoop/fundloop-website/issues/60) own the operational contribution-to-earnings smoke foundation. They explicitly exclude real outbound payout execution.
- Feature #96 is the coordination container for the new harness. Its required sequence is #97, #98, then implementation under Goal #99; the new work should generalize the existing evidence without duplicating it.

The evidence supports extending Playwright with scenario contracts and shared local orchestration. It does not support claiming that signup, invitations, withdrawal, or every requested navigation step already works end to end.

## Brainstorm

### Product and user-facing behavior

- Describe journeys in the language a person sees: profile created, contribution accepted, cycle prepared, earnings credited, and distribution visible.
- Keep new and returning variants separate because they prove different auth and fixture boundaries.
- Let a developer choose one persona for a quick iteration loop or run the complete suite for an integrated view.
- Treat withdrawal as a visible expected-pending checkpoint until FundLoop has a safe local payout executor and product flow. Credited earnings are not paid earnings.
- Treat invitation creation and delivery as distinct checkpoints so a future delivery assertion can be added without changing the founder scenario's shape.

### UX, navigation, and assertions

- Prefer role-appropriate routes and user-visible content over table names, internal function names, or incidental DOM structure.
- Assert authenticated navigation, accessible page landmarks, meaningful statuses, totals, source projects, and credited-versus-paid language.
- Keep checkpoint names stable even when route composition or implementation details change.
- Capture traces, screenshots, and video on failure through the existing Playwright output configuration; do not commit private fixture data in reports or artifacts.

### Technical shape

- Add a dedicated local persona Playwright project rather than expanding either the remote-safe or wallet-only test glob until their responsibilities blur.
- Use typed persona definitions made of ordered, named checkpoints and reusable actor/fixture helpers.
- Use one local orchestrator to validate prerequisites, start only the services it owns, run selected scenarios, aggregate results, and stop owned services when practical.
- Reuse existing Playwright, Supabase fixture, E2E login, local-wallet, and operational-cycle primitives. Extract shared pieces only where the implementation Tasks demonstrate a real need.
- Keep scenarios independently runnable and deterministic; avoid one monolithic test whose later personas depend on earlier browser state.

### Auth, data, and integrations

- New member and founder scenarios should exercise the public browser signup/login flow against local Supabase and retrieve the OTP from local Mailpit.
- Returning member, returning founder, and operator scenarios may use deterministic accounts plus the existing secret-gated E2E login path for speed, while still exercising FundLoop authorization after login.
- Use run-scoped fixture namespaces and explicit cleanup. Fixture setup may use the local service role, but persona actions must use the product's normal UI and Edge Function/write-command boundaries.
- Refuse remote or production Supabase for the initial destructive persona lane; do not silently fall back when local prerequisites are missing.
- Advance a selected economic month through controlled application commands. Do not change the host clock, wait for a real month, or write lifecycle statuses directly merely to bypass authorization.

### Validation, reporting, and observability

- Emit a machine-readable checkpoint result with `pass`, `expected-pending`, or `fail`, plus a sanitized human summary.
- A declared pending checkpoint makes the persona and aggregate run incomplete, not green. An undeclared missing capability or regression is a failure.
- Distinguish harness/setup failures from user-visible checkpoint failures so developers can diagnose local prerequisites separately from product behavior.
- Verify cleanup and report residual run-scoped records without leaking OTPs, bearer tokens, cookies, service-role keys, private emails, or raw private payloads.
- Add focused Vitest coverage later for environment refusal, scenario selection/contracts, cleanup behavior, and aggregate status semantics.

### Operations and release

- Document one local-first command plus prerequisites and persona filters.
- Keep the initial lane developer-invoked. Preview/dev, scheduled CI, production execution, and broader browser/device matrices are follow-ons.
- Keep generated reports and Playwright artifacts in ignored output locations. Only sanitized summaries belong in issue comments or committed validation documents.

## Options Evaluated

| Option | Benefits | Costs and risks | Decision |
| --- | --- | --- | --- |
| Extend Playwright with typed persona scenarios | Reuses the browser stack and failure artifacts; supports incremental checkpoints and persona filters | Requires deliberate orchestration, fixtures, and reporting contracts | Selected |
| One monolithic end-to-end script | Fastest initial proof | Couples personas and state, is hard to select or extend, and obscures failures | Rejected |
| Seed every actor and bypass public auth | Fast and deterministic | Cannot prove new-user signup/login | Selected only for returning and operator setup; rejected for new personas |
| Use real local OTP for every actor | Proves auth delivery consistently | Adds unnecessary time and Mailpit coupling to returning journeys | Selected for new personas only |
| Wait for the monthly schedule | Mirrors calendar timing | Slow, flaky, and unsuitable for local iteration | Rejected; use controlled cycle commands |
| Build withdrawal, payout, or invitation delivery inside the harness Feature | Could make more narrative steps pass | Broadens into product and payment-safety work and confuses tests with implementation | Deferred to product Features |
| Reuse only the operational-MVP smoke | Already proves core economic stages | Does not provide selectable new/returning auth and persona journeys | Retain as lower-level evidence; do not treat as the persona harness |
| Mark unavailable steps as ordinary skips | Easy incremental adoption | Produces ambiguous or falsely green runs | Rejected; require declared expected-pending results |

## Narrowed Initial Scope

The selected slice is:

1. A local-only Playwright persona lane with independently selectable new member, returning member, new founder, returning founder, and returning operator scenarios.
2. Public local Supabase plus Mailpit OTP for new actors, and deterministic secret-gated login for returning/operator actors.
3. Run-scoped local fixtures with explicit cleanup and no remote database fallback.
4. Controlled monthly-cycle advancement through existing application command boundaries, never wall-clock waiting.
5. User-visible browser assertions and an aggregate, sanitized capability report.
6. Honest `pass`, `expected-pending`, and `fail` checkpoint semantics, with pending results preventing an all-green claim.
7. Reuse of the existing Playwright, wallet, fixture, and operational-MVP foundations.

The initial Feature does not implement invitations, withdrawal, payout execution, or other missing product capabilities. It defines their scenario checkpoints and reports unavailable ones as expected-pending until separately delivered.

## Follow-On Candidates

- A safe local payout executor and withdrawal product flow, followed by promotion of withdrawal from expected-pending to a required assertion.
- Invitation transport/delivery assertions beyond an in-app invitation checkpoint.
- Preview/dev persona execution with separately guarded fixtures and credentials.
- Scheduled CI, flake tracking, and retained sanitized run summaries.
- Cross-browser, mobile viewport, accessibility, and performance matrices.
- Production-like external identity or payment-provider test doubles where local contracts are insufficient.

## Rejected and Protected Boundaries

- No real funds or outbound transfers.
- No production/main or remote Supabase mutation.
- No service-role logic in browser bundles and no bypass of RLS or role authorization.
- No direct database lifecycle transitions that evade Edge Function command boundaries.
- No wall-clock monthly waits, host-clock manipulation, or test-order dependence.
- No unconditional skips, falsely green aggregate status, secrets, private fixture payloads, or raw PII in reports.
- No replacement of focused Vitest, Edge Function, contract, wallet, remote-safe, or operational-MVP coverage.

## Open Questions

None block the next Task. The user confirmed the persona split, auth strategy, and expected-pending treatment. Task #98 should turn these decisions into exact scenario/checkpoint types, aggregate status rules, isolation guarantees, command boundaries, and cleanup contracts before implementation begins.

## Handoff

- Task #98: define the technical persona contracts and capability-gap policy from this narrowing record.
- Goal #99 and Tasks #100-#102: implement orchestration/reporting, member/founder journeys, and the operator cadence journey in the registered Feature #96 worktree.
- Keep withdrawal and any unavailable invitation behavior explicit and pending until their product capabilities are delivered outside this Feature.
