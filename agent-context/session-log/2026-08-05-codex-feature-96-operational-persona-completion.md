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

### session v4: Close invitation validator authorization findings (#114)

- Timestamp: 2026-08-05T04:54:00Z
- Agent: Codex
- Branch: codex/feature-96-operational-persona-completion
- Head: 9d0bb5c

#### Objective

Address the independent #114 validator's fail result before allowing invitation work to advance.

#### Actions Taken

- Explicitly revoked the security-definer acceptance RPC and digest-bearing invitation table from `PUBLIC`, `anon`, and `authenticated`, retaining service-role-only command access.
- Added an authenticated project-admin Edge list command that returns a token-free invitation projection and made the founder UI reload durable pending invitations.
- Prevented project-level admin invitations from granting organization-wide Admin and preserved existing Founder/Admin roles during membership reactivation.
- Added migration-boundary, safe-list, and persisted-list UI regression tests.

#### Validation Notes

- Passed: full local Supabase migration/seed replay after the ACL and role changes.
- Passed live ACL query: acceptance execute and invitation-table select are false for both `anon` and `authenticated`.
- Passed live transactional acceptance check: existing organization role remained Founder (`role_id=2`) while project participation was created without admin escalation for a member invite; transaction rolled back.
- Passed separately: invitation contract 4 tests, command 3 tests, migration boundary 2 tests, and founder invitation panel 1 test.

#### Reflections

- Supabase default grants must be revoked explicitly from `anon` and `authenticated`; revoking only `PUBLIC` is insufficient.
- Project role and organization role are different authorization domains and must not be coupled by invitation acceptance.

#### Suggested Next Steps

- Commit the validator fixes and rerun independent #114 validation.
- Continue #115 only after the invitation security boundary is green.

### session v5: Add safe credited-earnings withdrawal requests (#115)

- Timestamp: 2026-08-05T04:57:00Z
- Agent: Codex
- Branch: codex/feature-96-operational-persona-completion
- Head: 53bf1b6

#### Objective

Let authenticated members request withdrawal of eligible credited-not-paid earnings without executing a transfer or marking any earning paid.

#### Actions Taken

- Added forward-only withdrawal-request and one-credit/one-reservation tables with self-read RLS and explicit client write/RPC revocations.
- Added a service-role-only atomic database function that verifies the user's active default route, locks eligible credits, reserves them exactly once, and returns idempotent `requested` state.
- Added typed authenticated Edge command contracts/adapters and an earnings-workspace request panel with eligible/requested/not-paid language.
- Extended the earnings read model with request history, reservation counts, eligible totals, and requested totals.
- Added contract, command, migration-boundary, read-model, and real component regression tests and regenerated local Supabase types.

#### Validation Notes

- Passed: full local Supabase migration/seed replay with both new capability migrations.
- Passed live ACL query: withdrawal RPC execute is false for `anon` and `authenticated`; authenticated request-table select is true while insert is false.
- Passed transactional database smoke: two credits totaling $150 were reserved once, the same idempotency key returned the same request, and both credits remained `not_paid`; the transaction rolled back.
- Passed separately: withdrawal contract 2 tests, command 3 tests, migration boundary 2 tests, panel 2 tests, and user earnings workspace 5 tests.
- Passed: focused ESLint and `pnpm typecheck`.
- Real persona browser activation remains owned by Task #116.

#### Reflections

- Reservation linkage is separate from payment status so request intent cannot be confused with settlement.
- Restricting the RPC to service role keeps caller-supplied actor identity behind the authenticated Edge boundary.

#### Suggested Next Steps

- Commit and independently validate #115.
- After #114 and #115 pass, unblock #116 and activate the invitation and withdrawal persona checkpoints.

### session v6: Make invitation failure states explicit (#114)

- Timestamp: 2026-08-05T04:58:00Z
- Agent: Codex
- Branch: codex/feature-96-operational-persona-completion
- Head: 5fbee77

#### Objective

Close the remaining invitation validator UX findings before browser activation.

#### Actions Taken

- Added distinct invalid, expired, and no-longer-pending acceptance messages.
- Added explicit loading and failure states for the persisted founder invitation list.
- Extended command and real-component regressions for these states.

#### Validation Notes

- Passed separately: invitation command 6 tests and invitation panel 2 tests.
- The 1440x1100 invitation create/accept browser smoke and exact fixture cleanup remain intentionally coupled to Task #116's real persona activation.

#### Suggested Next Steps

- Commit these explicit states, then complete the browser evidence through #116.

### session v7: Activate invitation and withdrawal persona checkpoints (#116)

- Timestamp: 2026-08-05T05:29:00Z
- Agent: Codex
- Branch: codex/feature-96-operational-persona-completion
- Head: 5390c37

#### Objective

Promote persisted invitation acceptance and credited-earnings withdrawal requests from declared gaps to required new/returning persona behavior, with real browser assertions, sanitized evidence, and exact cleanup.

#### Actions Taken

- Removed the invitation and withdrawal capability-registry entries and made all four checkpoints required while retaining the independently filtered founder cadence handoff as the only expected-pending capability.
- Extended founder fixtures with run-owned organizations, Founder membership, and project-admin participation; extended member earnings with a run-owned active default payout route.
- Made new and returning members request exactly $125 through the earnings UI, then asserted the request/reservation rows, unchanged `not_paid` credit, `Requested · not paid`, and `no payout executed` language.
- Made new and returning founders create persisted invitations through the project UI, open the raw link only in memory in a separate profiled invitee browser context, accept it, and verify non-admin project participation plus organization membership.
- Added exact ledger ownership for invitation, invitee profile/memberships, withdrawal request/reservation, payout route, and existing dependent fixtures.
- Added sanitized 1440x1100 invitation and withdrawal success captures and made invitation command failures emit bounded, non-sensitive reason codes.
- Made operator screenshot redaction transactional so sensitive text is restored after capture instead of mutating React state and causing later hydration failures.
- Updated focused contracts, journey-runner/reporting tests, member spec expectations, and the local harness/runbook documentation.

#### Validation Notes

- Node v22.23.2 filtered member run `persona-20260805T050514153Z-4a1ba234` passed new and returning member journeys completely with clean teardown.
- Node v22.23.2 filtered founder runs `persona-20260805T051123166Z-5131eb74` and `persona-20260805T050921661Z-58232b62` passed invitation creation/acceptance and all implemented founder checkpoints; each remained incomplete only at the declared cadence handoff and cleaned fully.
- The first integrated run proved all newly activated checkpoints but hit the known local lock stall because Edge was served separately from an already-running excluded stack. Restarting caller-owned Supabase in the documented lean mode with its managed Edge container fixed the environment; filtered operator run `persona-20260805T052354990Z-39f4039b` then passed all nine checkpoints with clean teardown.
- A subsequent matrix exposed permanent screenshot redaction causing a hydration mismatch. After restoring redacted text nodes in `finally`, final matrix `persona-20260805T052635035Z-db98c69d` ran all five Playwright specs successfully: both members and the operator passed, both founders passed every implemented checkpoint and were incomplete only at `founder-distribution-after-operator-cadence`, and all five ledgers were clean with zero residuals. Aggregate exit 2 is therefore the intentional expected-pending result, not a test failure.
- Visually inspected the 1440x1100 withdrawal and invitation acceptance captures; they are legible and contain no email, OTP, raw invitation token/digest, UUID, or credential.
- Independent validators passed #114 and #115 after reviewing the browser artifacts, product/database evidence, and exact cleanup.
- Final `pnpm check` passed on Node v22.23.2 with repo-wide ESLint, 118 Vitest files/527 tests, typecheck, production compilation, and 162 generated routes.

#### Reflections

- Local Edge validation must use the caller-owned managed Edge container started with the stack; bolting `functions serve` onto a stack that excluded Edge can leave long-running commands stalled even while short commands appear healthy.
- Privacy redaction must be reversible. Mutating a live React tree after hydration can poison later route rendering even when the screenshot itself is safe.
- Withdrawal request state remains intentionally separate from payment state: the browser evidence shows reservation and zero remaining eligibility without claiming payout execution.

#### Suggested Next Steps

- Commit and independently validate #116, then run integrated Goal #113 validation.
- Keep the founder-to-operator handoff registry entry until a separately filtered founder journey consumes the cadence result; do not add payout execution or invitation email delivery to this Goal.
