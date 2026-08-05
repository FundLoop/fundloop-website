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

## 2026-08-04 Dev Intake Reference-Data Repair

Status: pending PR dry-run, dev deploy, and hosted smoke rerun.

Repair approach:

- Add a Supabase deploy workflow session setting, `app.settings.fundloop_target_environment`, so migrations can distinguish `dev` from `main` without reading secrets or hard-coding project refs.
- Add a forward migration that upserts active EVM contract-mode intake rows only when non-zero configured addresses are available.
- For `dev` only, the migration may use deterministic non-production placeholder intake and treasury addresses so remote-safe Playwright can create payment-route fixtures without depending on production contracts.
- For `main`, missing configured addresses are ignored rather than written, so existing production rows are not overwritten by placeholders or zero addresses.

Required validation before claiming repair complete:

- Open a PR into `dev` and confirm the Supabase Deploy dry-run succeeds.
- Merge through the approved path so the push-triggered dev Supabase Deploy applies the migration.
- Re-run read-only remote diagnosis and confirm at least two active chain/asset/intake route candidates are available.
- Re-run `pnpm dlx node@22.22.1 /opt/homebrew/bin/pnpm test:e2e:remote`.
- Run or add the full founder/operator/user operational MVP hosted smoke and record credited-but-not-paid evidence.

Boundary notes:

- This repair is intentionally non-production.
- The branch does not run a remote seed or reset.
- No successful hosted operational MVP smoke is claimed until the post-merge dev deploy and smoke rerun pass.

## 2026-08-05 Remote-Safe Hosted Smoke Repair Complete

Status: remote-safe hosted payment smoke passed; full operational MVP credited-earnings smoke still remains separate.

Environment evidence checked:

- Worktree: `/Users/botmaster/src/fundloop`
- Branch: `dev`
- Dev head: `a5eddff87a040fcb848f7ef6d5c69ae24027a3ec`
- Hosted URL: `https://fundloop-website.vercel.app`
- Remote Supabase lane: non-production Preview/dev values exported from ignored `.env.remote.local`
- Remote mutation: remote-safe Playwright fixture setup and cleanup only
- Production/main mutation: none
- Real payout execution: none

GitHub evidence:

- PR #111 merged to `dev` at `a5eddff87a040fcb848f7ef6d5c69ae24027a3ec`.
- Dev Supabase Deploy run `30970060012` completed successfully, including database migrations and Edge Function deployment.
- Dev CI run `30970059994` completed successfully.

Hosted smoke evidence:

- Command:

```bash
PLAYWRIGHT_REMOTE_BASE_URL="https://fundloop-website.vercel.app" \
PLAYWRIGHT_REMOTE_ALLOW_CANONICAL_SUPABASE=true \
pnpm dlx node@22.22.1 /opt/homebrew/bin/pnpm test:e2e:remote
```

- Result: 2 remote-safe Playwright tests passed in 29.4 seconds.
- Covered routes/flows:
  - seeded project payment statuses and onchain progress render safely
  - project crypto route create/update-style management works without touching irreversible onchain state

Repair chain completed:

- Dev intake-contract reference rows were repaired through approved forward migrations and the GitHub Supabase Deploy workflow.
- Remote payment smoke fixtures were hardened against stale shared sequences and schema drift.
- PostgREST schema cache reload was applied through a forward migration.
- Hosted Preview/dev E2E login gating was fixed to use `FUNDLOOP_DEPLOYMENT_ENV=dev` while failing closed for unknown/prod-like values.
- Supabase Edge command runtime now accepts Supabase's native `SUPABASE_URL` and `SUPABASE_ANON_KEY` function secret names.
- The crypto route manager now reconciles persisted server state while preserving unrelated unsaved draft rows.

Remaining validation gap:

- This proves the remote-safe hosted payment lane, not the full operational MVP founder/operator/user cycle through credited-but-not-paid earnings.
- A focused regression test for preserving multiple unsaved crypto-route drafts is still desirable if/when the project adds a component test harness for `ProjectCryptoRouteManager`.

Boundary notes:

- No production/main environment was touched.
- No remote seed, reset, or manual schema migration was run from the local shell.
- No secrets, bearer tokens, cookies, Supabase keys, or private payloads are recorded here.
- No real payout transfer was executed.
