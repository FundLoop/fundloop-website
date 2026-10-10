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

### session v4: Noak revised the decision — approval moves to PR review

- **Timestamp:** 2026-10-10T02:05:00Z
- **Head before commit:** `3263a87`

---

#### Objective

Noak, directly: "Let's revert #271 and go back to normal standards. I'll manually review PRs to dev.
However, I don't need to then also approve a downstream CI job, just getting my merge approval is
enough." Plus two corrections: we require **full** history, not linear history, and the two
`SUPABASE_ACCESS_TOKEN` secrets are the same org-wide PAT.

---

#### What this changes

The two halves of the original change are now decided differently:

- **Owner approval is back**, as PR review. He reviews and approves every PR, to `dev` and to
  `main`, and an agent does not merge without it. That is the standard this PR had removed.
- **The per-run environment approval stays gone**, because approving the same release twice adds
  nothing. So the `Production` environment keeps no reviewer — not "until go-live" but by design.

That also answers the conflict the deep review raised and HBIC was taking to him: his approval of a
`dev` to `main` merge **is** the explicit permission section 7 requires for the migrations that
merge applies to Production. AGENTS.md now says so, and adds that no other route is permitted —
migrations and function deployments go through CI, never the CLI against a hosted project.

Every document that described the old state was rewritten again: AGENTS.md, README, the
release-candidate controls list and promotion steps, supabase-deployments.md, the operations runbook
and the workflow's dry-run summary. Promotion step 8 now says the owner merges, and that an agent
does not.

---

#### Branch protection corrected

`dev` had `required_linear_history: true`, which is what forced every PR to rebase. Noak: that is
incorrect — the requirement is full history, which means no squash (already disabled repo-wide) and
merge commits allowed. Disabled it with a full `PUT`, then read back every field and compared:
exactly one value changed, `required_linear_history` True to False. Everything else — strict checks
and the three contexts, admin enforcement, conversation resolution, no force pushes, no deletions —
is byte-identical.

Worth noting for whoever expects his approval to be *enforced* rather than agreed: it cannot be
today. `required_approving_review_count` is 0 on both branches, and raising it would deadlock every
PR, because the `gh` CLI here authenticates as his own account, so he is the author of every PR an
agent opens and GitHub will not let an author approve their own PR. Until there is a separate
machine identity, "do not merge without his approval" is a rule in AGENTS.md rather than a branch
protection setting.

---

#### The shared token is a real exposure

He confirmed both `SUPABASE_ACCESS_TOKEN` secrets are the same org-wide PAT. A `pull_request` run
selects `Preview`, so **any same-repo pull request holds a token that can manage the Production
Supabase project**, which is wider than the CI-only path the docs describe. His instruction to route
all migrations and function deployments through CI is recorded in AGENTS.md; the exposure itself is
filed separately, because a rule about how agents behave does not constrain what a workflow edit in
a PR could do.

---

#### Validation Notes

- Node project: 167 files, 1065 tests passing; typecheck clean; workflow YAML parses.
- Live read-back of `dev` protection recorded above.

### session v5: Correction — review is split by target branch

- **Timestamp:** 2026-10-10T02:20:00Z

Noak clarified: he reviews PRs to **`main`**; the coordinating review session reviews PRs to
**`dev`**. My previous entry had him reviewing every PR into both branches, which was wrong and
would have stalled every feature branch waiting on him.

`AGENTS.md` now states the split explicitly, with the reason it is written here rather than
configured: neither gate can be a branch protection setting today, because
`required_approving_review_count` must stay 0 while every agent-opened PR is authored by his own
account. README and the release-candidate controls list follow.

Corrected once more, to the final shape: **an agent never merges a pull request.** Every PR is
reviewed by the designated review session, which also merges PRs into `dev`; the user merges the
`dev` to `main` PR himself.

About today's merges, stated plainly rather than tidied away: I merged #274, #270 and #269 into
`dev` myself, on that reviewer's explicit and verified approval, which was the standing process at
the time. Under the rule as it now stands I would have reported them ready and left the merge to the
reviewer. Nothing about those three changes is in doubt — all six conditions held and CI was green
on each — but the merges were mine, and that is no longer my part to play.

### session v6: Codex review — the evidence contract could not describe the new control

- **Timestamp:** 2026-10-10T03:55:00Z

Four findings, and the second was the one that mattered: with `Production` deliberately having no
per-run reviewer, the v1 evidence contract became **unsatisfiable**. The schema required
`requiredReviewerCount >= 1` and the evaluator emitted `protection-missing:production-reviewer` for
zero, so every truthful manifest would have failed Production certification after a correctly
authorized merge.

Two rounds ago I argued for leaving that failing deliberately, as a go-live tripwire. That was
defensible while the zero-reviewer state was temporary. It is now permanent policy, so a
permanently-failing required certification is just a broken gate, and the contract has to model the
control that actually exists.

#### What the contract says now

`githubControls.promotionApproval` is required: the pull request number, who reviewed it, who merged
it, and when. `requiredReviewerCount` may be zero, with the schema explaining why. The evaluator's
reviewer blocker is replaced by four: a missing pull request, review, merger or merge time.

Stated plainly in the schema and the contract, because it is a real weakening: **the control changed
from an enforced setting to a recorded human action.** GitHub guaranteed the old one; a person
attests the new one. That is the same limitation as the review gate itself, and it has the same
remedy — a separate machine identity would let `required_approving_review_count` be raised and make
both enforceable again.

#### The other three

- The promotion sequence had the owner reviewing *and* merging, which would have let an operator
  skip the designated review entirely. Steps 8 and 9 now separate the roles.
- The runbook still carried "confirm required reviewers" as an imperative with a note underneath
  saying it no longer applied — an instruction that cannot be followed. Replaced rather than
  annotated.
- The controls list was presented as the result of the 2026-08-13 read-back, which records the
  opposite state: a required reviewer and linear history. New dated artifact
  `github-delivery-controls-2026-10-10.md` records a live read-back of every value, with the two
  that look like gaps explained, and both documents' review dates updated.

#### Counsel packet, again

`lib/release-readiness/evidence-manifest.ts` is a digest-bound artifact of the counsel review
packet, so changing the evaluator invalidated it. Re-bound as before. This time the change is
substantive rather than editorial: whoever briefs counsel should know the Production control they
will read about is a recorded merge, not an enforced reviewer.

Validated: 167 files, 1068 tests, typecheck and lint clean.
