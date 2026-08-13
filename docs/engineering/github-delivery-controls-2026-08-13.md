# GitHub delivery-control read-back — 2026-08-13

Observed at `2026-08-13T10:31:10Z` through the GitHub REST API as repository
administrator `KazanderDad`. This record contains configuration metadata only; no
secret value, deployment payload, or Supabase data was read.

## Before

- Repository rulesets: `[]`.
- `dev` branch protection: HTTP `404 Branch not protected`.
- `main` branch protection: HTTP `404 Branch not protected`.
- `Production`: no protection rules, no deployment branch policy, and
  `can_admins_bypass=true`.
- `Preview`: no protection rules, no deployment branch policy, and
  `can_admins_bypass=true`.

## After

Both `dev` and `main` use classic branch protection with the same fail-closed
contract:

- require an up-to-date branch and the exact check-run contexts `validate`,
  `Supabase fresh-schema replay`, and `Supabase dry-run` (all GitHub Actions app ID
  `15368`);
- require the pull-request path and dismiss stale reviews;
- enforce the rules for administrators;
- require linear history and resolved conversations; and
- disallow force pushes and deletion.

`Production` now has one required reviewer (`KazanderDad`, user ID `98373366`),
`can_admins_bypass=false`, and a custom deployment-branch policy whose sole rule is
the exact branch `main`. Self-review prevention remains false because this
repository currently has one eligible human reviewer; the environment still pauses
every Production job for a deliberate human approval.

FundLoop currently has one repository collaborator and organization member,
`KazanderDad`. Branch approval count is therefore zero: enforcing a branch approval
from a write-authorized reviewer while also enforcing rules for administrators would
make a PR authored by the sole member impossible to merge. Human review remains a
delivery process requirement and the Production environment approval is live and
mandatory; adding a second qualified collaborator permits raising the branch approval
count without deadlocking delivery.

`Preview` intentionally remains a non-approval environment. PR execution there is
dry-run/read-only, while shared Dev mutation occurs only after protected-branch
merge. It does not grant Production deployment authority, cutover authority, or
value-flow authority.

The repository has no rulesets because the equivalent live controls are enforced
with classic branch protection. API read-back, not this document, remains the
authoritative current state.

## Required-check continuity

GitHub branch protection matches the check-run `name`, not a display label composed
from workflow and job. Exact-head REST read-back on PR #203 returned `validate`,
`Supabase fresh-schema replay`, and `Supabase dry-run`; live branch protection was
corrected to those exact values. `validate` and `Supabase fresh-schema replay` remain
jobs in the `CI` workflow even though `CI /` is not part of their protected context.

The Supabase workflow runs on every PR into `dev` or `main`. A scope classifier
starts the provider-backed execution only when the candidate changes a reviewed
Supabase path. A final `Supabase dry-run` job always reports: it requires successful
provider execution for an in-scope candidate and requires that execution be skipped
for an out-of-scope candidate. Classification failure or failed/skipped required
execution fails the required context, so an absent path-filtered workflow cannot
silently satisfy branch protection.

## Authority boundaries

The configuration change does not approve a Production job. A main-target rehearsal
must stop at the `Production` approval boundary and be cancelled without approval.
Production Supabase mutation, cutover, go-live, payout, and real-value-flow controls
remain outside Task #162.

Rehearsal run `31691571764` selected `target_environment=main` and `mode=deploy`
from `dev`. GitHub created a pending `Production` deployment requiring
`KazanderDad`, with no job step started, then rejected the run because the exact
deployment branch was not `main`. A second dispatch against `main` was rejected with
HTTP 422 because the workflow on the current `main` branch does not yet expose
`workflow_dispatch`. This proves both the human pause and branch rejection without
approval or provider execution. Re-run from the promoted `main` workflow only at the
separate Production authority boundary.
