# Persona Happy-Path Harness

Status: shared local harness foundation implemented by Task [#100](https://github.com/FundLoop/fundloop-website/issues/100), with independently selectable member/founder journeys implemented by Task [#101](https://github.com/FundLoop/fundloop-website/issues/101). The returning-operator cadence journey remains owned by Task #102. Task [#97](https://github.com/FundLoop/fundloop-website/issues/97) supplied the narrowing evidence and Task [#98](https://github.com/FundLoop/fundloop-website/issues/98) fixed the contracts and capability-gap policy below.

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

## Implementation Contract

### Typed scenario model

Task #100 should add the following public types in `tests/e2e/personas/contracts.ts`. The names and unions are part of the harness contract; implementation may add fields but should not weaken them to untyped strings or arbitrary JSON.

```ts
import type { BrowserContext, Page } from "@playwright/test"

export type PersonaId =
  | "new-member"
  | "returning-member"
  | "new-founder"
  | "returning-founder"
  | "returning-operator"

export type CheckpointMode = "required" | "expected-pending"
export type CheckpointStatus = "pass" | "expected-pending" | "fail"
export type RunStatus = "passed" | "incomplete" | "failed"
export type EvidenceValue = string | number | boolean | null
export type SanitizedEvidence = Readonly<Record<string, EvidenceValue>>
export type PendingCapabilityId =
  | "member-withdrawal"
  | "project-invitation-persistence"
  | "founder-distribution-after-operator-cadence"
export type ActorAlias =
  | "fixture-inviter"
  | "new-member"
  | "returning-member"
  | "new-founder"
  | "returning-founder"
  | "returning-operator"

export type CapabilityRegistryEntry = {
  capabilityId: PendingCapabilityId
  state: "expected-pending"
  reasonCode: string
  ownerUrl: string
  rationale: string
}

export type CapabilityRegistry = Readonly<Record<PendingCapabilityId, CapabilityRegistryEntry>>

export type RunIdentity = {
  runId: string
  selectedPersonas: readonly PersonaId[]
  startedAt: string
}

export type CycleClock = {
  baseCycleKey: string
  cycleKeyFor: (personaId: PersonaId, offset?: number) => string
  boundsFor: (cycleKey: string) => { periodStart: string; periodEnd: string }
}

export type ActorHandle = {
  alias: ActorAlias
  authUserId: string
  kind: "new" | "stored" | "operator" | "fixture"
}

export type OwnedDatabaseRecord = {
  table: string
  primaryKey: Readonly<Record<string, string | number>>
  cleanupPhase: number
}

export type OwnedInvitation = {
  code: string
  createdByUserId: string
  maxUses: 1
}

export type OwnedCycle = {
  cycleId: number | null
  cycleKey: string
  operatorNoteMarker: string
  createdByUserId: string
  state: "planned" | "created" | "clean"
}

export type OwnershipLedger = {
  schemaVersion: 1
  run: RunIdentity
  state: "arranging" | "running" | "cleaning" | "clean"
  records: readonly OwnedDatabaseRecord[]
  authUserIds: readonly string[]
  storagePaths: readonly string[]
  invitations: readonly OwnedInvitation[]
  cycles: readonly OwnedCycle[]
}

export type CleanupResult = {
  status: "clean" | "residual"
  deletedCount: number
  residualCount: number
  reasonCode: string | null
}

export type FixtureController = {
  ledger: OwnershipLedger
  checkpoint: () => Promise<void>
  cleanup: () => Promise<CleanupResult>
}

export type ControlledCadenceDriver = {
  advanceThroughApproval: (cycleKey: string) => Promise<SanitizedEvidence>
  createBookkeepingCredits: (cycleKey: string) => Promise<SanitizedEvidence>
}

export type SanitizedEvidenceSink = {
  add: (checkpointId: string, evidence: SanitizedEvidence) => void
}

export type ServiceOwnership = {
  supabase: "caller"
  mailpit: "caller"
  next: "runner"
  nextPid: number | null
}

export type PersonaContext = {
  run: RunIdentity
  personaId: PersonaId
  actor: ActorHandle
  browserContext: BrowserContext
  page: Page
  clock: CycleClock
  fixtures: FixtureController
  cadence: ControlledCadenceDriver
  evidence: SanitizedEvidenceSink
  services: ServiceOwnership
}

export type CheckpointBase = {
  id: string
  title: string
  actorAlias: ActorAlias
  surface: "browser" | "controlled-command" | "fixture-observation"
  execute: (context: PersonaContext) => Promise<CheckpointObservation>
}

export type PersonaCheckpoint = CheckpointBase &
  (
    | { mode: "required"; capabilityId: string }
    | { mode: "expected-pending"; capabilityId: PendingCapabilityId }
  )

export type PersonaJourney = {
  id: PersonaId
  title: string
  actorKind: "new" | "returning" | "operator"
  checkpoints: readonly PersonaCheckpoint[]
}

export type CheckpointObservation = {
  outcome: "observed" | "capability-unavailable"
  evidence: SanitizedEvidence
  reasonCode?: string
}

export type CheckpointResult = {
  checkpointId: string
  capabilityId: string
  status: CheckpointStatus
  durationMs: number
  reasonCode: string | null
  evidence: SanitizedEvidence
}

export type PersonaResult = {
  personaId: PersonaId
  status: RunStatus
  durationMs: number
  checkpoints: readonly CheckpointResult[]
  cleanup: CleanupResult
}

export type HarnessRunSummary = {
  schemaVersion: 1
  runId: string
  selectedPersonas: readonly PersonaId[]
  unselectedPersonas: readonly PersonaId[]
  status: RunStatus
  exitCode: 0 | 1 | 2
  startedAt: string
  durationMs: number
  cycleKeys: Readonly<Partial<Record<PersonaId, string>>>
  services: Omit<ServiceOwnership, "nextPid">
  personas: readonly PersonaResult[]
  cleanup: CleanupResult
}
```

The ownership ledger is deliberately an internal, ignored recovery artifact and may contain exact local record/Auth IDs needed for safe deletion. `HarnessRunSummary`, `PersonaResult`, and `CheckpointResult` are the sanitized reporting boundary and must never include those IDs. `PersonaContext` must not expose the service-role key to page code. Checkpoint IDs and capability IDs are stable kebab-case identifiers; user-facing labels and routes may evolve independently.

`tests/e2e/personas/capabilities.ts` is the only expected-pending registry. Each entry contains `capabilityId`, `reasonCode`, `ownerUrl`, and a short non-sensitive rationale. A checkpoint may produce `expected-pending` only when all of these are true:

1. its contract declares `mode: "expected-pending"`;
2. the capability is present in that registry; and
3. its observation returns `capability-unavailable` with the registry reason code.

A required checkpoint that is unavailable is `fail`. An unavailable capability missing from the registry is `fail` with `undeclared-capability-gap`. A pending declaration whose probe observes the capability working is `fail` with `stale-pending-declaration`, forcing the declaration and assertion to be promoted together. Ordinary Playwright `test.skip`, `test.fixme`, conditional early return, and catch-and-continue behavior are forbidden in persona specs.

### Result aggregation and exit codes

Checkpoint status is derived, not chosen by a scenario:

- `pass`: the expected user-visible observation completed.
- `expected-pending`: the three registry checks above succeeded; it never means implemented.
- `fail`: assertion failure, authorization failure, undeclared/stale gap, setup error, timeout, sanitizer rejection, or cleanup residue.

Run aggregation is deterministic: any failure makes the run `failed`; otherwise any expected-pending checkpoint makes it `incomplete`; only all-pass selected checkpoints make it `passed`. The local runner exits `0` for `passed`, `2` for `incomplete`, and `1` for `failed`, including preflight, service startup, fixture, or cleanup failures. An empty/unknown persona filter is a failed preflight and exits `1`. This makes pending-only runs visibly non-green while keeping them distinguishable from regressions.

Cleanup runs in `finally` after pass, pending, failure, or interrupt. A cleanup failure upgrades any result to `failed`. The runner writes the summary before exiting when enough state exists to do so.

### Ordered persona contracts

The initial journeys use these ordered checkpoints. “Required” means the implementation Task must assert the named browser behavior; it does not mean the capability is known to pass before that Task is implemented.

#### New member

1. `auth.request-local-otp` — required; use the public `/en/join?invite=<run-token>` browser UI to validate the run-owned invitation and request a local OTP.
2. `auth.verify-local-otp` — required; retrieve the new message from Mailpit in Node, enter the six digits in the browser, and assert an authenticated session.
3. `member.publish-profile` — required; complete the personal-profile onboarding UI and observe the published profile at `/en/my-profile`.
4. `member.view-earnings-total` — required; after run-owned historical fixture arrangement, observe accumulated credited earnings at `/en/workspace/earnings`.
5. `member.view-project-sources` — required; observe the project/source breakdown and credited/not-paid state on that page.
6. `member.withdraw-earnings` — expected-pending capability `member-withdrawal`; no safe local withdrawal executor or product flow exists.

#### Returning member

1. `auth.login-returning-member` — required; authenticate the run-scoped stored account through `/api/internal/e2e/login` and then prove access to a protected browser route.
2. `member.view-existing-profile` — required; observe the fixture-owned published profile at `/en/my-profile`.
3. `member.view-earnings-total` — required; observe existing accumulated credited earnings at `/en/workspace/earnings`.
4. `member.view-project-sources` — required; observe source projects and credited/not-paid state.
5. `member.withdraw-earnings` — expected-pending capability `member-withdrawal`.

#### New founder

1. `auth.request-local-otp` — required through `/en/join?invite=<run-token>`.
2. `auth.verify-local-otp` — required through Mailpit plus the public browser UI.
3. `founder.publish-personal-profile` — required through the onboarding UI.
4. `founder.publish-project-profile` — required through the project onboarding UI; observe the managed project under `/en/founder/projects`.
5. `founder.create-project-invitation` — expected-pending capability `project-invitation-persistence`; `components/invite-member-form.tsx` currently generates a client-only link and success toast without persistence or delivery, which is not a passing invite.
6. `founder.submit-monthly-contribution` — required at `/en/founder/projects/[slug]/contributions` through `project-monthly-contribution-submit`.
7. `founder.submit-active-user-attribution` — required at `/en/founder/projects/[slug]/attribution` through `project-attribution-dataset-submit`.
8. `cadence.await-operator-distribution` — expected-pending capability `founder-distribution-after-operator-cadence`; Task #101 proves the founder inputs and reports the handoff, while Task #102 owns authenticated cadence execution and the resulting distribution assertions.

#### Returning founder

1. `auth.login-returning-founder` — required through the secret-gated local E2E login endpoint, followed by protected-route authorization.
2. `founder.view-existing-profile-and-project` — required; observe the stored profile and managed project.
3. `founder.create-project-invitation` — expected-pending capability `project-invitation-persistence`.
4. `founder.submit-next-month-contribution` — required through the founder contribution UI.
5. `founder.submit-next-month-attribution` — required through the founder attribution UI.
6. `cadence.await-operator-distribution` — expected-pending capability `founder-distribution-after-operator-cadence`; Task #102 promotes this handoff into cadence execution plus founder reporting assertions.

#### Returning operator

1. `auth.login-returning-operator` — required through the stored account login endpoint, followed by the internal-admin authorization boundary.
2. `operator.view-cycle-readiness` — required at `/en/admin/cycles`.
3. `operator.lock-cycle` — required through the operator browser control and `monthly-cycle-lock`.
4. `operator.calculate-cycle` — required through `/en/admin/cycles/[cycleKey]/zkas` and `monthly-cycle-calculation-package`.
5. `operator.verify-cycle` — required through `/en/admin/cycles/[cycleKey]/verification` and `monthly-cycle-verification-review`.
6. `operator.approve-cycle` — required through the same operator review surface and `monthly-cycle-approval`.
7. `operator.create-bookkeeping-credits` — required controlled authenticated command through `monthly-cycle-bookkeeping-credits-create`, followed by browser verification at `/en/admin/cycles/[cycleKey]/payouts`; assert that no payout executes. The current page has no bookkeeping-credit creation button.
8. `operator.view-performance` — required at `/en/admin/cycles/observability` and `/en/admin/cycles/[cycleKey]/reporting`.
9. `operator.view-allocation-breakdown` — required; observe per-user and per-project counts/totals plus credited/not-paid state.

The monthly contribution checkpoints prove submission of the current product's contribution data, including source amount/reference and calculated contribution. They do not prove that funds settled. No journey may label a contribution submission, bookkeeping credit, or payout intent as a transfer.

## Auth and actor contract

`tests/e2e/support/persona-fixtures.ts` provisions one run namespace and actor aliases such as `new-member`, never reports raw emails, and records every created database, storage, and Auth identifier in a cleanup ledger.

- New member/founder Auth users are created only by requesting and verifying OTP through the public browser UI at `/en/join?invite=<run-token>`. After verification, the Node fixture layer may resolve the actor's Auth UUID for run-owned historical arrangements; it may not replace the signup checkpoint.
- Returning member/founder/operator users are created before the app starts with run-scoped deterministic emails/passwords through the local service-role admin API. Authentication uses `loginThroughE2EEndpoint`; the next protected page proves FundLoop session and role authorization.
- The runner adds only its run-scoped operator email to `FUNDLOOP_INTERNAL_ADMIN_EMAILS` and `FUNDLOOP_ZKAS_SUPERADMIN_EMAILS` before starting Next. The test still exercises `requireInternalAdminActor`; it must not mock or bypass it.
- CUBID snapshots, reference rows, an open cycle, contribution commitments, historical credits, and other history needed to establish a precondition may be fixture-arranged. The fixture must not pre-create the result a checkpoint claims to prove.
- Actor credentials exist only in process memory. Neither fixtures nor reports may log email, password, Auth UUID, bearer token, cookie, service-role key, private attribution payload, wallet destination, or raw Mailpit response.

### Run-owned invitation prerequisite

The current join page requires an `invitation_codes` row and redirects `/en/join` without an `invite` query back to `/`. The harness therefore does not rely on a shared seed invitation:

1. Before Next starts, provision a run-owned `fixture-inviter` Auth user and matching `public.users` row through the local service-role fixture boundary.
2. For each selected new persona, insert a distinct code such as `persona-<run-suffix>-new-member` into `public.invitation_codes` with `created_by=<fixture-inviter UUID>`, `usage_count=0`, `max_uses=1`, and `expires_at=<run start plus one hour>`. Persist the exact code and inviter UUID to the ownership ledger before browser navigation.
3. Navigate to the exact URL `/en/join?invite=${encodeURIComponent(code)}`. Assert the invitation-accepted state before opening onboarding; then request and verify OTP through the rendered auth UI.
4. On profile publication, assert `public.users.invited_by_code` equals the run token and `invitation_codes.usage_count >= 1`. Do not assert exactly `1`: the current schema has the `increment_invite_code_usage` insert trigger and `lib/onboarding/user-onboarding-commands.ts` also increments during first publish. `max_uses=1` still makes the token single-consumer because join validation refuses it once `usage_count >= max_uses`; every new persona gets its own token and the harness never reuses it.
5. Cleanup deletes the new actor's drafts/dependent rows, `public.users` row, and Auth user first; then deletes that exact invitation code; then deletes the run-owned inviter profile/Auth user after every invitation is gone. Failure before Auth creation still deletes the invitation and inviter. The recovery path uses the same exact ledger order. No shared invitation is decremented or restored.

The ignored ownership ledger may hold the token for exact cleanup, but console output, screenshots, persona result files, and the aggregate summary identify it only as `new-member-invite` or `new-founder-invite`.

`tests/e2e/support/mailpit-otp.ts` owns OTP retrieval. It polls the local Mailpit API at `http://127.0.0.1:55324/api/v1/search` with a URL-encoded recipient query, chooses only a message received after the checkpoint start time, loads that message through `/api/v1/message/{id}`, extracts exactly one six-digit token in memory, and immediately discards the response body after the browser input is filled. Poll errors use fixed error codes and must not include the query URL, recipient, message, or token. The helper never returns the token as evidence.

Because Playwright traces, screenshots, and video can capture email or OTP input, the `local-personas` project disables automatic trace, screenshot, and video capture. Specs may capture a screenshot only after authentication and only after a sanitizer confirms no auth form, email address, token, private attribution row, or payout destination is visible.

## UI, fixture, and command boundaries

| Boundary | Allowed | Forbidden |
| --- | --- | --- |
| Browser persona action | Public OTP request/verification, onboarding, contribution/attribution forms, operator controls, navigation, visible assertions | Direct Supabase writes, service-role key, mocked authorization, claiming a toast proves persistence |
| Local fixture arrangement | Reference/precondition records, run-scoped stored actors, CUBID snapshots, open cycles, historical earnings, exact cleanup | Creating the output of the checkpoint under test, broad deletion, remote fallback, lifecycle status shortcuts |
| Controlled cadence driver | Existing typed Edge Function clients/contracts authenticated as the run operator | Writing `monthly_cycles.status`, results, credits, or reports directly; changing host clock; invoking real payout execution |

Founder scenarios use `tests/e2e/support/persona-monthly-cycle.ts` to represent the monthly wait. It executes lock, calculation, verification, approval, and bookkeeping-credit commands in order with a run-scoped authenticated operator. The operator persona uses existing browser controls through approval. Because `/en/admin/cycles/[cycleKey]/payouts` currently renders credits and offers only the later payout-intent control, bookkeeping-credit creation is a controlled authenticated command in both paths, not a fabricated UI action.

The exact credit boundary is `MONTHLY_CYCLE_BOOKKEEPING_CREDITS_CREATE_FUNCTION` plus `MonthlyCycleBookkeepingCreditsCreateCommandInput` and `normalizeMonthlyCycleBookkeepingCreditsCreateResult` from `lib/edge-functions/monthly-cycle-bookkeeping-credits-create-contract.ts`. The driver signs a local anon-key Supabase client into the run-owned operator account and passes that user-scoped client to `invokeEdgeCommandWithClient` from `lib/edge-functions/invoke.ts`; this invokes the same `monthly-cycle-bookkeeping-credits-create` Edge Function and internal-admin allowlist check as the app. It does not use the service role for the command. `lib/edge-functions/monthly-cycle-bookkeeping-credits-create-server.ts` remains the server-session adapter for application callers, but it is not used outside a Next request context. After the normalized result reports `status: "distribution"` and `noPayoutExecuted: true`, the browser reloads `/en/admin/cycles/[cycleKey]/payouts` and asserts the credited/not-paid rows. Both paths assert intermediate status and audit evidence; neither calls the payout-intents command or any transfer rail. Task #102 does not add a bookkeeping-credit button.

The default injected clock is `FUNDLOOP_PERSONA_CYCLE_BASE=2035-01`. Scenario offsets are stable and collision-free in a combined run: new member `+0`, returning member `+1`, new founder `+2`, returning founder `+3`, and operator `+4`. The returning-founder key is the next founder cycle after the new-founder key. Date bounds are derived from those keys in UTC. The clock is data supplied to existing command contracts: it never changes `Date`, the host clock, timers, or production scheduling. A CLI override must be a valid `YYYY-MM` and is still subject to the local-only guard.

## Local-only guard and service ownership

`tests/e2e/support/persona-env.ts` must fail closed unless all of the following hold before any service-role call or fixture mutation:

- `FUNDLOOP_DEPLOYMENT_ENV` equals `local`;
- `NEXT_PUBLIC_SUPABASE_URL` has exact origin `http://127.0.0.1:55321` (normalize `localhost` to the same loopback origin before comparison);
- `PLAYWRIGHT_PERSONA_BASE_URL` has loopback host and the dedicated default port `3002`;
- Mailpit has loopback host and port `55324`;
- local anon and service-role keys are present in memory;
- the local Supabase health/auth endpoints and Mailpit API answer;
- no option requests remote fixtures, remote base URLs, Supabase linking/pushing, or payout execution.

The guard captures `supabase status --output json` only for local endpoint comparison and never prints its key-bearing output. A mismatch stops with a fixed, sanitized preflight error before fixture creation. There is no fallback to `PLAYWRIGHT_REMOTE_*`, `NEXT_PUBLIC_SUPABASE_URL` from a hosted project, or a linked remote project.

Service ownership is explicit:

- The caller owns local Supabase and Mailpit. Start/reset them with the documented commands below. The harness checks them but never starts, resets, or stops them implicitly.
- The runner owns the Next process on `127.0.0.1:3002`. It refuses an occupied port, starts Next with local-only env, waits for HTTP readiness, and terminates only that child on completion or signal.
- The persona lane does not start Hardhat or reuse the injected local-wallet account because this Feature does not execute a wallet transfer or withdrawal.
- If future checkpoints need the wallet lane, orchestration must extract a shared child-process primitive from `scripts/run-playwright-local-wallet.mjs`; it must not nest `pnpm test:e2e:local` or silently start a second app/Supabase stack.

## Isolation and cleanup

`scripts/run-playwright-local-personas.mjs` acquires `output/persona-harness/local.lock` with exclusive creation before preflight. A concurrent destructive persona run fails before mutation. The `local-personas` project uses `fullyParallel: false` and `workers: 1`; each persona gets a fresh browser context and fixture namespace. The run ID is `persona-<UTC timestamp>-<random suffix>` and is used in fixture metadata, not in user-facing assertions. The runner removes only its own lock in `finally`.

Each persona fixture ledger lives at `output/persona-harness/<run-id>/ownership-ledger-<persona-id>.json`, with its directory mode `0700` and file mode `0600`. The legacy unsuffixed name remains readable for recovery. A ledger is written after every mutation through a flushed temporary file and atomic rename, and records exact inserted IDs and storage paths. Cleanup runs in reverse dependency order while preserving `users.user_id` until owned cycle rows are removed, because deleting the public user first nulls the cycle ownership marker. Existing seed rows and reference data are never deleted. Deletion by email prefix, unscoped date, cycle status, or table-wide filter is forbidden.

Local Auth creates the initial inactive `users` row and its real `auth.identities` foreign key. Persona setup updates that trigger-owned row; it does not insert a competing profile or invent an identity UUID. New-actor setup leaves `invited_by_code` unset until the real publish command runs. The publish checkpoint then proves the visible profile, persisted invitation code, and exactly one invitation use.

After Playwright exits, the runner inspects every selected persona ledger before aggregation. A missing result or non-clean ledger triggers exact-ledger recovery and an atomic failed persona result; an absent ledger is residual/unproven, never clean. `--self-test --force-timeout --persona returning-member` creates a run-owned actor and deliberately exceeds a five-second test timeout so this process-interruption recovery can be verified without a database reset.

Successful persona-state captures are explicit 1440x1100 screenshots at `output/playwright/persona-harness/<run-id>/<persona-id>-success.png`. Capture is refused when sensitive controls or values are visible, and the result records only the persona capture identifier. The local persona lane disables Playwright trace/video/automatic screenshots, uses the list reporter, and removes persona failure-context directories after execution so email, OTP, invitation, session, and token material cannot remain in failure artifacts.

### Fixed-cycle ownership and recovery

`monthly_cycles` has no dedicated harness metadata column. The fixture uses its existing `operator_note` field as a local-only ownership marker and corroborates it with `created_by_user_id`; cadence commands currently update `status_note`, not `operator_note`.

1. After acquiring the global lock and before inserting a cycle, write a planned `OwnedCycle` entry with `cycleId: null`, `operatorNoteMarker: "persona-harness:<run-id>"`, the run operator UUID, and `state: "planned"` to the atomic ledger.
2. Query `monthly_cycles` by the fixed `cycle_key`. If any row exists, a normal run refuses the collision without mutation. If its `operator_note` starts with `persona-harness:`, report only the owning run ID and `pnpm test:e2e:personas -- --cleanup-run <owner-run-id>`; otherwise report `cycle-key-not-owned` without exposing row contents.
3. Insert the new row with the exact cycle key/bounds, `operator_note=<marker>`, and `created_by_user_id=<run operator>`, select its numeric ID, then atomically checkpoint the ledger with that ID and `state: "created"`. If the process dies between insert and checkpoint, the planned ledger plus exact marker and creator fields are sufficient for recovery to resolve the ID.
4. Every normal fixture/cadence step queries by the recorded cycle ID and key. A focused contract test must prove the current lock-through-credit commands preserve `operator_note`; a missing or changed marker is a harness failure.
5. `--cleanup-run <run-id>` loads only that run's private ledger. For a planned entry with no ID, it may adopt a row only when `cycle_key`, `operator_note`, and `created_by_user_id` all exactly match the ledger. For a created entry, those same fields plus `id` must match. Any mismatch refuses deletion with `ownership-mismatch`.
6. Recovery deletes only ledger-recorded storage/database IDs and exact dependent rows constrained by the verified owned cycle ID, in reverse dependency order, then deletes the cycle row last. It re-queries the ID/key/marker, records `state: "clean"`, and returns success only at zero residuals. Re-running cleanup for a clean ledger is idempotent.

This marker is fixture setup metadata, not product output, and exists only in local Supabase. The sanitized run summary omits `operator_note`, creator UUIDs, and ledger contents.

## Filters and sanitized output

The implementation exposes these commands:

```bash
# caller-owned local prerequisites
DOCKER_CONTEXT=colima-agents supabase start -x logflare -x vector
DOCKER_CONTEXT=colima-agents supabase db reset

# all five personas
pnpm test:e2e:personas

# one or more independently selectable personas
pnpm test:e2e:personas -- --persona new-member
pnpm test:e2e:personas -- --persona returning-member,new-founder

# exact recovery of an interrupted run
pnpm test:e2e:personas -- --cleanup-run <run-id>

# implementation validation
pnpm test -- tests/persona-harness-contracts.test.ts tests/persona-harness-env.test.ts tests/persona-harness-reporting.test.ts tests/persona-harness-fixtures.test.ts
pnpm exec playwright test --project=local-personas --list
pnpm check
```

The runner validates filters against the `PersonaId` union, passes a generated Playwright grep matching `@persona:<id>`, and preserves registry order. No filter means all five. The aggregate includes only selected personas and lists unselected personas separately; it does not count them as skipped or pending.

`tests/e2e/support/persona-reporting.ts` writes each persona result atomically to `output/persona-harness/<run-id>/personas/<persona-id>.json`; after the single-worker Playwright child exits, the runner aggregates those records into a concise console table and `output/persona-harness/<run-id>/summary.json`. A missing selected-persona record is a failure, even when Playwright itself exits unexpectedly. The JSON contains schema version, run ID, selected persona IDs, local service aliases (never URLs containing queries or keys), deterministic cycle keys, run status/exit code, durations, checkpoint IDs/statuses/fixed reason codes, numeric/boolean observations, cleanup status, and residual counts. It excludes raw exceptions and arbitrary strings until they pass an allowlist sanitizer. The sanitizer rejects secret-like keys, JWTs, six-digit OTPs, email patterns, cookies, authorization headers, UUID/Auth IDs, service-role values, wallet destinations, and private attribution content. `output/` is already ignored; only a manually copied sanitized summary may enter an issue or session log.

## Planned implementation surfaces

Task #100 owns the shared harness and should create or modify exactly these surfaces:

- `package.json` — add `test:e2e:personas`.
- `playwright.config.ts` — add the isolated `local-personas` project matching `personas/*.spec.ts`, base URL port `3002`, and secret-safe artifact settings.
- `scripts/run-playwright-local-personas.mjs` — CLI, local guard ordering, lock, Next lifecycle, Playwright child, exit mapping, and cleanup-only mode.
- `tests/e2e/personas/contracts.ts` and `tests/e2e/personas/capabilities.ts` — contracts and pending registry.
- `tests/e2e/support/persona-env.ts`, `persona-fixtures.ts`, `mailpit-otp.ts`, `persona-monthly-cycle.ts`, and `persona-reporting.ts` — shared support boundaries.
- `tests/persona-harness-contracts.test.ts`, `tests/persona-harness-env.test.ts`, `tests/persona-harness-reporting.test.ts`, and `tests/persona-harness-fixtures.test.ts` — focused unit coverage.

Task #101 owns `tests/e2e/personas/new-member.spec.ts`, `returning-member.spec.ts`, `new-founder.spec.ts`, and `returning-founder.spec.ts`. Task #102 owns `tests/e2e/personas/returning-operator.spec.ts` plus integrated aggregate-report assertions and the final local runbook updates in this document and `docs/engineering/env-and-testing.md`.

Task #101 also adds `tests/e2e/personas/journeys.ts`, `tests/e2e/support/persona-browser-actions.ts`, and `tests/e2e/support/persona-journey-runner.ts`. The journey builders fix checkpoint order independently of selectors; the browser adapter owns real UI/auth actions and run-owned arrangements; the runner derives outcomes, stops on the first failure, cleans in `finally`, and writes one sanitized result record. Founder specs stop at a declared `founder-distribution-after-operator-cadence` checkpoint because Task #102 owns the authenticated cadence execution. This pending result is visible and non-green; it is not a substitute for contribution or attribution assertions, which remain required UI actions.

Existing `tests/e2e/support/env.ts`, `e2e-login.ts`, and `supabase-fixtures.ts` may be reused or receive small extracted helpers when their contracts genuinely match. Do not broaden `remote-safe` or `local-wallet` fixture types merely to make persona names fit.

## Reuse and non-duplication boundary

- `remote-safe` stays the hosted/non-production project-payment smoke and is never selected by the persona command.
- `local-wallet` stays the Hardhat/injected-wallet payment lane and keeps owning simulated onchain receipt behavior.
- The persona lane reuses `loginThroughE2EEndpoint`, local Supabase client/cleanup patterns, existing Edge Function clients, and Playwright configuration conventions.
- The Feature #51 / Goal #60 operational-MVP smoke remains the lower-level proof of lock-through-credit calculation. Persona specs assert actor navigation, authorization, inputs, and user-visible results; shared cycle-driving logic should call the same commands rather than clone allocation logic or seed final outputs.
- Focused Vitest, Edge Function contract tests, Hardhat tests, and the two existing Playwright projects remain required owners of their narrower behavior.

## Acceptance mapping and implementation stop condition

| Task #98 acceptance criterion | Closed design decision |
| --- | --- |
| Every persona has an ordered contract | Five ordered checkpoint lists above; the four Task #101 builders are enforced by focused Vitest coverage |
| New actors use real local OTP UI | Run-owned single-use invitation at `/en/join?invite=<run-token>` plus secret-safe Mailpit helper |
| Returning/operator actors are deterministic but authorized | Run-scoped stored accounts, E2E login, protected-route/allowlist checks |
| Withdrawal and cadence-owned handoff remain pending | Registry-owned `member-withdrawal` and `founder-distribution-after-operator-cadence` checkpoints with exit `2` semantics |
| Exact files and commands are named | Planned surfaces and command block above |
| Local-only, secrets, cleanup, and remote guards are explicit | Fail-closed env guard, artifact policy, fixture ledger, service ownership |
| No additional product discovery is needed | Types, routes, boundaries, clock, filters, reporting, ownership, and sequencing are fixed |

Implementation Tasks stop at an `incomplete` exit when only declared product gaps remain; they do not make those gaps green. Task #98 itself stops after this design and the branch session log are committed and evidence is posted. It does not add the Playwright project, runner, fixtures, tests, persona specs, product capabilities, remote execution, or payout behavior.

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

None block implementation. The user confirmed the persona split, auth strategy, and expected-pending treatment; Task #98 fixes the exact scenario/checkpoint types, aggregate status rules, isolation guarantees, command boundaries, and cleanup contracts above.

## Handoff

- Goal #99 and Tasks #100-#102: implement the fixed orchestration/reporting contract, member/founder journeys, and operator cadence journey in the registered Feature #96 worktree.
- Keep withdrawal and any unavailable invitation behavior explicit and pending until their product capabilities are delivered outside this Feature.
