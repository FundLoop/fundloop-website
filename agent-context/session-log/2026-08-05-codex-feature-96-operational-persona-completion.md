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
