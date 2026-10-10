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

### session v2: Codex review — three documents still promised the gate

- **Timestamp:** 2026-10-09T19:52:00Z
- **Head before commit:** `5d4ffb7`

---

#### Objective

Codex found that removing the gate was not the whole job: other active instructions still told an
operator the gate existed, which is the same hazard I had flagged for the operations runbook and
then missed elsewhere.

---

#### Actions Taken

- **`docs/engineering/release-candidate.md`** was the serious one. Its current-state section said
  `Production` "requires a human approval", and its promotion sequence said to merge only after the
  approval gate is active and then to approve the environment deployment. An agent or operator
  following the canonical release path would have waited for a gate that no longer exists. Both are
  corrected, and step 8 now says what is actually true: **the merge into `main` is the decision to
  deploy to Production**, because nothing after it asks anyone anything.
- **The workflow's dry-run output** told the reviewer that Production credentials are "only
  available to approved Production deployments" and called the environment "approval-gated". That
  text appears at the exact moment someone is making the final pre-production judgement, so it was
  the worst place to imply a human barrier still exists. It now says credentials are scoped to an
  environment a pull request does not run in — which is the real reason a PR cannot reach Production
  — and states that merging starts the deploy with no further gate.
- One stale code comment in the same workflow, for the same reason.

Two other matches were left alone deliberately: `docs/legal/review-drafts/terms-canada.md` and
`docs/engineering/persona-happy-path-harness.md` use "production approval gate" in the go-live
readiness sense, not the GitHub environment reviewer, and that gate is unchanged. The legal draft is
also a digest-bound artifact of the counsel packet.

---

#### Validation Notes

- Node project: 1065 tests passing; typecheck clean; workflow YAML parses.
- (This worktree had no `node_modules` link, so my first `tsc` ran a system binary and "failed"
  meaninglessly. Linked and re-run.)

---

#### Reflections

Removing a control is easy; removing every statement that the control exists is the actual work. The
dry-run summary was the sharpest instance, because it is read precisely when someone is deciding
whether to let a migration reach Production.

### session v3: Independent deep review on #272

- **Timestamp:** 2026-10-10T01:45:00Z
- **Head before commit:** `f0adead`

---

#### Actions Taken

- **Three active documents outside the diff still said the gate existed**, and two of them are the
  references a reader is sent to: `README.md`'s Release Candidate Path, the "Enforced GitHub
  Controls" list in `release-candidate.md` (which contradicted the new note 20 lines above it), and
  `supabase-deployments.md`, which README and `edge-functions.md` both link as the current
  deployment reference. All three now carry the same pre-go-live note and link #271.
- **`release-candidate.md` also told the operator not to approve a Production deployment** "until
  the separate release authority boundary is satisfied". There is no deployment to approve, so that
  boundary now has to be satisfied *before* merging — which is a different instruction, not a
  reworded one.
- **Restored "`dev` or `main`" in AGENTS.md section 2.** Dropping `main` went further than Noak's
  decision: it left nothing forbidding an agent from merging a feature branch straight into `main`,
  skipping `dev` entirely, since branch protection requires a PR and green checks but not a
  particular base. The promotion carve-out belongs in the next bullet, where it already is.
- **Fixed a pre-existing error in the same paragraph**: it claimed both branches require linear
  history. Only `dev` does; `main` has `required_linear_history` disabled.
- **#271's restore checklist was incomplete and its command was wrong.** The `PUT` omitted
  `can_admins_bypass`, which the API defaults to `true` — and it is currently `false`, verified
  live. Running the command as written would have restored the reviewer while quietly enabling
  administrator bypass. The corrected checklist includes the flag, a read-back step, and
  `git grep -n '#271'` as the authority for which notes to remove, so it cannot go stale again.

---

#### Held, pending Noak

The reviewer's P2 that AGENTS.md section 2's note conflicts with section 7 — a merge to `main` now
applies migrations to the remote Production database, which section 7 forbids without explicit
permission in the user's most recent prompt. Both cannot be followed at once. HBIC is asking Noak
whether merge-triggered Production deploys count as permitted; the line stays as it is until he
answers.

---

#### Escalated, because I cannot resolve it

Both `Production` and `Preview` hold a secret named `SUPABASE_ACCESS_TOKEN`. I can read the names,
not the values. A `pull_request` run selects `Preview`, so if that token is an account-level PAT
that can manage the Production project, a same-repo pull request can reach Production through the
management API — independent of this change, and narrower than the dry-run summary's reasoning
sounds. Recorded on #271 for someone who can see both values. The summary line now claims only what
is verifiable: the Production *database URL* is a `Production` secret, so the job could not connect
to that database.

---

#### Reflections

Every finding here was a document that still described the world as it was before the change. The
check that would have caught them is the one the reviewer suggested for the restore: grep for the
control's name, not for the files I remembered touching.
