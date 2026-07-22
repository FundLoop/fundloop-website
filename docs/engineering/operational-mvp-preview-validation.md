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
