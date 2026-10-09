# Session Log: chore/271-no-owner-approval-for-main

### session v1: Remove owner approval for promoting to main until go-live

- **Timestamp:** 2026-10-09T16:45:00Z
- **Agent:** Claude Code (Claude Opus 5)
- **Branch:** `chore/271-no-owner-approval-for-main`
- **Head before commit:** `7473aa4`

---

#### Objective

Noak, directly: until FundLoop goes live, promoting to `main` should not require owner approval.
Remove the rule from `AGENTS.md`, remove the required reviewers from the GitHub `Production`
environment, keep branch protection and status checks, leave the section 7 remote-database rule
alone, and record the change as temporary.

---

#### Actions Taken

- `AGENTS.md` section 2: the push rule now covers `dev` only, and a pre-go-live note states that the
  `dev` to `main` PR may be merged once CI is green, names that PR as the review point for anything
  reaching Production, says the requirement returns at go-live, links [#271], and states explicitly
  that section 7's remote-database rule is unchanged.
- GitHub `Production` environment: removed the `required_reviewers` rule (`KazanderDad`, user id
  `98373366`) with a `PUT` that preserved the deployment branch policy. Read back afterwards:
  protection rules are now `branch_policy` alone, and the branch policy is still `branch main`.
- `docs/engineering/operations-runbook.md`: the instruction to confirm required reviewers before
  merging a release candidate is marked suspended until go-live, pointing the reader at the
  release-candidate PR and its `Supabase dry-run` output instead.
- Opened [#271] as the record, including the exact commands to restore both controls at go-live.

---

#### Checked before changing anything

- **Branch protection is untouched**, read back after the change. `dev` and `main` both still require
  `validate`, `Supabase fresh-schema replay` and `Supabase dry-run`, with strict up-to-date branches,
  conversation resolution and no force pushes; `dev` keeps linear history.
- **Four documents stated the reviewer rule.** `lib/release-readiness/evidence-manifest.ts` reports
  `protection-missing:production-reviewer` as a deploy blocker when the reviewer count is zero, and
  `docs/engineering/production-readiness-evidence-contract.md` requires at least one reviewer. Both
  were left exactly as they are: that is a **go-live** criterion and it should fail while we are not
  live. Confirmed first that the evaluator is referenced only by
  `tests/production-readiness-evidence-contract.test.ts` against fixtures — it is not wired into any
  workflow, so removing the reviewer cannot break the Production deploy it would otherwise gate.
- `docs/engineering/github-delivery-controls-2026-08-13.md` keeps its original wording: it is a dated
  record of what was true then, like the other dated evidence artifacts.

---

#### Validation Notes

- Documentation and one tracked log; no application code changed. Lint and typecheck clean.
- Live read-back of the environment and both branches' protection recorded above.

---

#### Reflections

The part worth flagging to Noak rather than burying: Production deploys now run with no human stop,
so the `dev` to `main` PR is the only review point before a migration reaches the Production
database. The go-live readiness blocker is left failing on purpose, so this cannot be forgotten
quietly.

---

#### Suggested Next Steps

- Restore both controls at go-live from the checklist in [#271].

[#271]: https://github.com/FundLoop/fundloop-website/issues/271
