### session v1: Preserve the approved epoch treasury decision record (#119)

- Timestamp: 2026-08-08T15:55:22Z
- Agent: Codex
- Branch: codex/118-epoch-treasury
- Head: 9c78484ac45fc880336e1c8d22b0eba602147321

#### Objective

Preserve the completed settlement-backed epoch treasury interview as a durable,
published decision record so subsequent architecture and implementation work does
not depend on the conversation transcript.

#### Actions Taken

- Recorded the confirmed monthly cutoff, settlement attribution, treasury, rail,
  asset, fee, FX, allocation, payout, expiry, Cubid, legal, privacy, and consent
  decisions in the Feature definition.
- Kept unresolved legal, custody, provider, control, migration, and reporting
  choices visibly separated under Open decisions.
- Recorded the published Feature #118 hierarchy, native dependency plan, and
  GitHub issue mapping.
- Corrected stale pre-publication status text and replaced pre-payout user-liability
  wording with the approved conditional-award ownership boundary.

#### Validation Notes

- Passed: `git diff --check` for the decision and issue-tree artifacts.
- Reviewed the Markdown structure, internal file references, published issue link,
  confirmed/open-decision separation, and Feature publication record.
- Code and automated product tests are not applicable because Task #119 is a
  documentation-only product-decision preservation task.

#### Reflections

- The legal/accounting approval gate must resolve recognition and ownership before
  the canonical ledger implementation begins.
- Native blockers keep the full vetted tree visible without implying that later
  financial Tasks are currently executable.

#### Suggested Next Steps

- Independently validate Task #119 and move it to `In Review` if the decision
  artifact is complete and internally consistent.
- Continue with architecture Task #120 in the same Feature worktree.

### session v2: Link the decision record from its coordinating issues (#119)

- Timestamp: 2026-08-08T15:58:58Z
- Agent: Codex
- Branch: codex/118-epoch-treasury
- Head: 14ec68b

#### Objective

Close the independent validator finding that the parent Feature and architecture
Task did not provide clickable reverse links to the approved decision artifact.

#### Actions Taken

- Added an idempotently marked Decision Artifact section to live Feature #118.
- Added the same branch-qualified artifact link to live architecture Task #120.
- Kept the Feature branch unpublished so the orchestrator can batch implementation
  and validation before the eventual PR; the issue text states when the link becomes
  browsable.

#### Validation Notes

- Verified both live issue bodies contain the `decision-artifact:feature-118:v1`
  marker and the exact durable artifact path.
- Passed: `git diff --check` for this session-log update.
- Product code, schema, UI, and tests remain unchanged.

#### Reflections

- Reverse linkage is part of the Task acceptance contract even when the repository
  artifact already links outward to the Feature.

#### Suggested Next Steps

- Rerun independent validation for Task #119 against commits `14ec68b` and this
  validator-fix commit.
- Move #119 to `In Review` only after the validator passes.

### session v3: Finalize the settlement-backed architecture and threat model (#120)

- Timestamp: 2026-08-08T16:29:13Z
- Agent: Codex
- Branch: codex/118-epoch-treasury
- Head: d1ac8f8

#### Objective

Turn the approved Feature decisions and repository baseline into implementation-
ready accounting, custody, migration, command/event, control, threat, and validation
contracts without implementing production financial behavior.

#### Actions Taken

- Finalized the twelve-stage epoch, settlement-only cash-flow, fixed monthly FX,
  fee, custody, conditional-award, payout, reconciliation, and close architecture.
- Kept pre-processing awards in an immutable memorandum subledger and reserved live
  economic classification for Task #121 professional approval.
- Added a decision register that separates locked engineering contracts from Stripe,
  Safe, FX, Cubid, reporting, migration, and legal launch gates.
- Defined versioned command/event envelopes for external events, ledger posting,
  stage attempts, conditional awards, and payout execution.
- Mapped every existing monthly-cycle, payment, package, allocation, credit,
  withdrawal, payout, preference, and intake-contract surface to an additive,
  shadow-first migration disposition.
- Added a repository-grounded threat model covering privileged commands, provider
  events, ledger integrity, reservation races, signer theft, and privacy boundaries.
- Recorded public experimental-warning acceptance and independently enforced Safe
  limits of $20 per payout, $500 rolling daily, and $5,000 per epoch.
- Applied Supabase/Postgres guidance for exact types, retained references, indexed
  foreign keys, RLS, least privilege, short transactions, advisory locks,
  consistent lock order, partial/composite indexes, and `SKIP LOCKED` workers.

#### Validation Notes

- Rendered all three Mermaid diagrams locally; each reported `Render status: ok`.
- Inspected full-page Playwright screenshots for the target architecture, epoch
  state machine, and threat-boundary diagrams after changing dense flows to a
  top-down layout.
- Passed Markdown whitespace, required-section, internal-link, and repository
  evidence-path checks. Stripe, Base, and Safe references returned HTTP 200; the
  official FTC guidance URL rejected the automated request with HTTP 403 and was
  retained as a valid bot-protected primary reference.
- Product tests and Supabase migration tests are not applicable because Task #120
  changes architecture documentation only.

#### Reflections

- The neutral ledger foundation can be specified precisely without claiming an
  accountant-approved revenue or payable presentation.
- The experimental warning communicates product maturity but is never a substitute
  for settlement, identity, sanctions, reconciliation, or allocation controls.
- Enforcing signer limits inside the Safe/module is essential; database counters
  alone cannot contain a stolen application signer.

#### Suggested Next Steps

- Independently validate Task #120 and move it to `In Review` only on pass.
- Obtain Task #121 counsel/accountant approval before any Goal 1 implementation.
