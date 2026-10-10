# GitHub Delivery Controls — read-back, 2026-10-10

A live API read-back of the controls that govern delivery, taken after two deliberate changes: the
`Production` environment's required reviewer was removed, and `dev`'s linear-history requirement was
disabled. It supersedes [the 2026-08-13 read-back](./github-delivery-controls-2026-08-13.md) as the
description of what is live; that document remains the record of the original hardening and of the
unsafe baseline before it.

Checked-in documentation is not configuration evidence. These values came from the API at the time
above and should be re-read before a promotion rather than trusted from here.

## Branch protection

Identical on `dev` and `main`:

| Control | Value |
| --- | --- |
| Required status checks | `validate`, `Supabase fresh-schema replay`, `Supabase dry-run` |
| Strict (branch up to date) | `true` |
| Required conversation resolution | `true` |
| Enforced for administrators | `true` |
| Force pushes | disabled |
| Branch deletion | disabled |
| Required approving reviews | **0** |
| Required linear history | **false** |

Two of those need explaining, because both look like gaps and only one is.

**Required approving reviews is 0, and cannot currently be raised.** Every pull request an agent
opens is authored by the owner's own GitHub account, and GitHub will not let an author approve their
own pull request, so requiring one approval would deadlock every agent-opened PR. Review is
therefore a rule in `AGENTS.md` — the designated reviewer reviews every PR, merges the ones into
`dev`, and the owner merges `dev` to `main` — and not something GitHub enforces. A separate machine
identity for agent-opened PRs would make it enforceable; until then this is an agreement, not a
control.

**Required linear history is false, deliberately.** The requirement is *full* history: squash
merging is disabled repository-wide, and merge commits are allowed, so a pull request lands as a
merge commit and its individual commits survive. Requiring linear history forced every branch to be
rebased onto its base, which rewrites those commits.

## Merge methods

| Method | Allowed |
| --- | --- |
| Merge commit | yes |
| Rebase | yes |
| Squash | no |

## Production environment

| Control | Value |
| --- | --- |
| Protection rules | `branch_policy` only |
| Deployment branches | `main` |
| Administrator bypass | **disabled** (`can_admins_bypass: false`) |
| Required reviewers | **none** |

The absent reviewer is the deliberate change: the approval is the owner's merge of the
release-candidate PR, and approving the same release twice adds nothing. See
[#271](https://github.com/FundLoop/fundloop-website/issues/271).

Two consequences worth stating rather than leaving to be discovered:

- **A merge to `main` starts the Production deploy with no further gate.** The `dev` to `main` pull
  request is the last point at which a migration is inspected, and its `Supabase dry-run` output is
  the last thing to read before it applies.
- **If a reviewer is ever restored, the `PUT` must pass `can_admins_bypass=false` explicitly.** The
  API defaults that field to `true` when it is omitted, so a careless restore would trade one
  control for the loss of another.

## Known exposure, accepted for now

The `Preview` and `Production` environments hold the same org-wide Supabase personal access token,
so a same-repo pull request — which runs in `Preview` — holds a token that can manage the Production
project through the management API. Accepted while FundLoop is not live and no one else works in the
repository, to be scoped when the token is next replaced. Tracked in
[#276](https://github.com/FundLoop/fundloop-website/issues/276).
