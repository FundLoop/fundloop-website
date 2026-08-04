# Operational MVP Preview/Dev Validation

This document records sanitized Preview/dev validation evidence for the operational MVP workflow. It is separate from local validation so hosted readiness is not confused with local smoke evidence.

## 2026-07-21 Preview/Dev Status

Status: blocked pending branch publication and Preview/dev deploy.

Environment evidence checked:

- Worktree: `/Users/botmaster/src/fundloop`
- Branch: `codex/operational-mvp-issue-51`
- Base branch: `dev`
- Remote mutation: none
- Production/main mutation: none
- Real payout execution: none

GitHub evidence:

- `gh pr list --head codex/operational-mvp-issue-51` returned no pull requests.
- `gh run list --branch codex/operational-mvp-issue-51` returned no workflow runs.
- The branch therefore has no Preview deployment, no Supabase deploy dry-run evidence, and no hosted app URL that can honestly be used for the Preview/dev operational MVP smoke.

Local branch evidence:

- The branch is ahead of `origin/dev` and not yet published as a PR for this issue tree.
- The local operational MVP smoke is recorded separately in [Operational MVP Local Validation](./operational-mvp-local-validation.md).

Required next step:

- Publish this operational MVP branch to a PR against `dev`.
- Let CI and the Supabase deploy dry-run complete.
- After merge/deploy to the dev target, run hosted founder/operator/user smoke against the deployed dev app and record sanitized evidence here.

Boundary notes:

- No Preview/dev smoke is claimed in this status entry.
- No remote Supabase mutation was attempted from the local shell.
- No production/main environment was touched.
- No payout transfer was executed.

## 2026-07-22 Dev Deploy Status

Status: blocked pending authorized hosted smoke.

Environment evidence checked:

- Worktree: `/Users/botmaster/src/fundloop`
- Branch: `dev`
- Dev head: `9417a0d30601dfb9f0dadfb9c828ad751c70f604`
- Remote mutation: only through the approved GitHub Actions deploy workflow
- Production/main mutation: none
- Real payout execution: none

GitHub evidence:

- Operational MVP PR #90 merged to `dev`.
- Follow-up Supabase deploy repair PR #94 merged to `dev`.
- Dev CI run `29891135934` completed successfully for `9417a0d`.
- Dev Supabase Deploy run `29891135998` completed successfully for `9417a0d`, including database migrations and Edge Function deployment.

Hosted smoke status:

- Preview/dev branch publication and deploy are no longer the blocker.
- A hosted end-to-end operational MVP smoke has not been rerun or claimed in this pass.
- The remaining blocker is an authorized hosted smoke context: a current non-production app URL plus non-production actor access/E2E credentials that can exercise founder, operator, and user checkpoints without exposing secrets in docs or issue comments.

Required next step:

- Run hosted founder/operator/user smoke against the deployed dev app with authorized non-production credentials.
- Verify the full path reaches credited-but-not-paid bookkeeping earnings.
- Record sanitized route, command, CI/deploy, and visual evidence here without bearer tokens, Supabase keys, cookies, service-role keys, private payloads, or unnecessary private emails.

Boundary notes:

- No Preview/dev smoke is claimed in this status entry.
- No remote Supabase mutation was attempted from the local shell.
- No production/main environment was touched.
- No payout transfer was executed.

## 2026-08-04 Hosted Smoke Attempt

Status: blocked by remote dev payment-route reference data.

Environment evidence checked:

- Worktree: `/Users/botmaster/src/fundloop`
- Branch: `codex/operational-mvp-hosted-validation-status`
- Base hosted URL: `https://fundloop-website.vercel.app`
- Remote Supabase lane: non-production Preview/dev values exported from ignored `.env.remote.local`
- Remote mutation: remote-safe Playwright fixture setup was attempted with the provided non-production service-role key, but failed before inserting the fixture project because required active intake-contract reference rows were unavailable
- Production/main mutation: none
- Real payout execution: none

Command evidence:

- `pnpm exec playwright install chromium` installed the missing local Playwright Chromium/headless-shell binaries needed to run the smoke harness.
- `pnpm dlx node@22.22.1 /opt/homebrew/bin/pnpm test:e2e:remote` initially skipped both tests because `.env.remote.local` used canonical Supabase variable names while the harness required the `PLAYWRIGHT_REMOTE_SUPABASE_*` aliases.
- The harness now falls back from `PLAYWRIGHT_REMOTE_SUPABASE_URL` to `NEXT_PUBLIC_SUPABASE_URL`, and from `PLAYWRIGHT_REMOTE_SUPABASE_SERVICE_ROLE_KEY` to `SUPABASE_SERVICE_ROLE_KEY`, when the env file is already scoped to Preview/dev.
- After mapping the canonical remote Supabase values into the smoke command, `pnpm dlx node@22.22.1 /opt/homebrew/bin/pnpm test:e2e:remote` reached the remote database and failed on both remote-safe tests with: `At least two active chain/asset/intake route combinations are required for Playwright fixtures.`

Read-only remote reference-data diagnosis:

- Active supported chains for `ethereum`, `base`, and `celo`: 3
- Active chain assets: 8
- Active contract-mode intake contracts: 0
- `crypto_contract` payment method rows: 1
- Required payment statuses (`draft`, `pending`, `awaiting_confirmation`, `failed`): 4
- Total route candidates available to the remote-safe fixture: 0
- `chain_intake_contracts` contains placeholder rows for EVM chains and Solana, but each checked row is inactive and points at a zero/null placeholder address.

Hosted smoke status:

- The hosted URL and E2E secret are no longer the blocker.
- The full operational MVP Preview/dev smoke is still not complete.
- The current blocker is remote dev reference-data readiness: the deployed Supabase target needs at least two active non-production chain/asset/intake-contract combinations before the existing remote-safe payment/founder smoke can seed routes and continue.

Required next step:

- Repair the non-production dev Supabase intake-contract reference data through the approved deploy/configuration path, not a production mutation and not a remote reset.
- Rerun `pnpm dlx node@22.22.1 /opt/homebrew/bin/pnpm test:e2e:remote` using `.env.remote.local`.
- Then rerun or add the full founder/operator/user operational MVP hosted smoke through credited-but-not-paid earnings and record sanitized route/result evidence here.

Boundary notes:

- No successful hosted operational MVP smoke is claimed in this entry.
- No remote seed, reset, or manual schema migration was run from the local shell.
- No production/main environment was touched.
- No payout transfer was executed.
- No secrets, bearer tokens, cookies, Supabase keys, or private payloads are recorded here.
