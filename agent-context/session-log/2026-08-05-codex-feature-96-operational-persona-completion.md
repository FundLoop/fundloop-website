### session v1: Record the full hosted cadence configuration blocker (#87)

- Timestamp: 2026-08-05T04:12:22Z
- Agent: Codex
- Branch: codex/feature-96-operational-persona-completion
- Head: 426024cb5bf444b8950852f937ff08a6cfa4403b

#### Objective

Run the larger hosted founder/operator/user operational MVP smoke after the repaired remote-safe payment lane, and record either credited-but-not-paid evidence or the exact safe blocker.

#### Actions Taken

- Re-ran the hosted remote-safe Playwright lane against `https://fundloop-website.vercel.app` on Node 22; both tests passed and cleaned their run-owned fixtures.
- Inspected the linked dev Vercel project's environment-variable inventory without reading or recording secret values.
- Confirmed the dev deployment lacks both internal-operator allowlist variables required by the hosted app and Supabase Edge command authorization boundaries.
- Stopped before creating a monthly cycle or founder/member operational fixtures and recorded the sanitized blocker in `docs/engineering/operational-mvp-preview-validation.md`.

#### Validation Notes

- Passed: `pnpm test:e2e:remote` — 2 tests passed in 23.3 seconds.
- Passed: read-only linked Vercel environment inventory; E2E/Supabase variables are present, operator allowlist variables are absent.
- Pending by blocker: the full cadence through lock, calculation, verification, approval, and credited-but-not-paid bookkeeping earnings.

#### Reflections

- The hosted payment lane is healthy, but it cannot establish operator authorization for the larger cadence. Treating missing deployment authorization as a fixture problem would weaken a deliberate production boundary.
- No operational-cycle remote mutation was appropriate without an allowlisted non-production operator and matching secret-safe credential.

#### Suggested Next Steps

- Configure the dev app and Edge runtime with a dedicated non-production operator allowlist and matching E2E actor credential, redeploy, and rerun #87.
- Continue locally with #112 and the invitation/withdrawal persona capability work while hosted operator configuration is resolved.

### session v2: Protect multi-draft crypto route reconciliation (#112)

- Timestamp: 2026-08-05T04:16:34Z
- Agent: Codex
- Branch: codex/feature-96-operational-persona-completion
- Head: cfd2a3a00099b4142644a6601edd4a0b52f5d84f

#### Objective

Add focused component regression coverage proving that persisting one ready crypto-route draft does not discard another unrelated local draft.

#### Actions Taken

- Added `tests/project-crypto-route-manager.test.tsx` with mocked reference-data, wallet-runtime, toast, and Edge adapter boundaries.
- Rendered the real `ProjectCryptoRouteManager`, created and populated two drafts, persisted the first against a server-returned route list, and asserted that the other draft retained its chain, token, intake-contract, label, and local-only state.
- Confirmed the persisted route is reconciled once and `onRoutesChange` receives the server-owned list.
- Left production component and Edge Function behavior unchanged because the current implementation passed the regression.

#### Validation Notes

- Passed: `pnpm exec vitest run tests/project-crypto-route-manager.test.tsx --pool=forks` — 1 test.
- Passed separately: `tests/project-crypto-routes.test.ts` — 5 tests.
- Passed separately: `tests/project-payment-drafts-create-adapter.test.ts` — 3 tests.
- Passed: `pnpm lint`.
- Passed: `pnpm typecheck`.
- The first combined neighboring-suite invocation did not emit results or terminate after more than one minute; it was stopped, and both suites then passed independently.

#### Reflections

- Exercising the real manager state while mocking only its external boundaries protects the exact review regression without adding a parallel production abstraction.
- No component change was necessary; the preservation logic introduced before PR #111 remains correct.

#### Suggested Next Steps

- Commit and post #112 evidence, then move the low-risk test-only Task to `In Review`.
- Scope and implement the invitation and withdrawal capabilities as new executable follow-up tasks before removing their persona pending declarations.

### session v3: Persist and accept project invitations (#114)

- Timestamp: 2026-08-05T04:41:00Z
- Agent: Codex
- Branch: codex/feature-96-operational-persona-completion
- Head: ac40336

#### Objective

Replace the legacy project invitation mock with an authorized persisted invitation and an email-bound, idempotent acceptance flow without adding an email provider.

#### Actions Taken

- Added a forward-only `project_invitations` migration with normalized invitee email, role/status constraints, token digests, expiry, creator idempotency, RLS, and an atomic security-definer acceptance function.
- Added typed create/accept Edge contracts, browser adapters, authenticated function handlers, and command implementations. Raw tokens are returned only once at creation and never persisted.
- Added a founder invitation panel and converted the legacy invitation redirect into a real authenticated acceptance surface.
- Added focused validation for payload normalization, permission denial, atomic acceptance mapping, email mismatch behavior, and public-route ownership.
- Updated generated Supabase types and the persona harness runbook.

#### Validation Notes

- Passed: local Supabase start followed by `DOCKER_CONTEXT=colima-codex-supabase supabase db reset --local`; all migrations and seed data replayed.
- Passed: local Supabase TypeScript generation and `pnpm typecheck`.
- Passed separately: `tests/project-invitation-contract.test.ts` — 3 tests; `tests/project-invitation-command.test.ts` — 3 tests; `tests/public-route-redirects.test.ts` — 4 tests.
- Passed: focused ESLint over all changed TypeScript/TSX test and production surfaces.
- The initial combined focused Vitest process stalled without emitting results; it was stopped and all suites passed independently.
- Browser persona activation remains intentionally owned by blocked Task #116 after withdrawal Task #115 lands.

#### Reflections

- Digest-only token persistence prevents a database read from becoming an immediately usable invitation link.
- Keeping membership creation inside one locked database function closes the duplicate-participant and partial-organization-membership race while Edge authentication remains the public command boundary.

#### Suggested Next Steps

- Commit and independently validate #114, then move it to `In Review`.
- Implement #115 without marking credits paid or executing any payout rail.
