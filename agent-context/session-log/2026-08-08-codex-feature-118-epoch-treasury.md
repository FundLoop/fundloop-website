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

### session v4: Prepare the Feature #118 PR version checkpoint

- Timestamp: 2026-08-08T16:35:28Z
- Agent: Codex
- Branch: codex/118-epoch-treasury
- Head: e1339d8

#### Objective

Prepare the validated #119-#120 documentation batch for its first pull request into
`dev` using the repository's feature-PR version convention.

#### Actions Taken

- Ran the repository version helper against `origin/dev` after the scoped Task
  commits.
- Bumped the application patch version from `0.1.1` to `0.1.2`.
- Confirmed the lockfile remained unchanged after its lockfile-only refresh.
- Preserved the one-Task-per-commit history and isolated this publish checkpoint in
  its own commit.

#### Validation Notes

- Verified `package.json` is `0.1.2`, exactly one patch above `origin/dev`.
- Passed: `git diff --check` for the manifest and session-log update.
- The helper applied the correct version and refreshed the unchanged lockfile, then
  hit its known inherited-stdio `null.trim()` error; the resulting files were
  inspected directly rather than treating the post-write helper exception as a
  successful command result.
- Full Node 22 `CI=1 pnpm check` runs after this checkpoint commit and before push.

#### Reflections

- The helper's post-refresh exception is packaging-tool debt, not part of the
  Feature architecture scope; the manifest outcome remains deterministic and
  reviewable.

#### Suggested Next Steps

- Commit the version checkpoint, run the full Node 22 gate, and publish one Feature
  PR to `dev` with #119 and #120 linked.
- Leave #121 and all dependent product Goals blocked pending professional approval.

### session v5: Record Feature #118 publication validation

- Timestamp: 2026-08-08T16:42:18Z
- Agent: Codex
- Branch: codex/118-epoch-treasury
- Head: 6ad9df6

#### Objective

Record reproducible Node 22 validation evidence for the independently validated
#119-#120 documentation batch before publishing its pull request to `dev`.

#### Actions Taken

- Ran lint, type checking, production build, and the complete Vitest suite with the
  repository's Node 22 baseline.
- Used an explicit single-worker fork pool for Vitest after the aggregate `pnpm
  check` invocation stalled during its default test-runner startup.
- Kept the validation-record update isolated from the Task implementation commits.

#### Validation Notes

- Passed: `PATH=/opt/homebrew/opt/node@22/bin:$PATH CI=1 pnpm lint`.
- Passed: `PATH=/opt/homebrew/opt/node@22/bin:$PATH CI=1 pnpm typecheck`.
- Passed: `PATH=/opt/homebrew/opt/node@22/bin:$PATH CI=1 pnpm build`.
- Passed: `PATH=/opt/homebrew/opt/node@22/bin:$PATH CI=1 pnpm exec vitest run
  --pool=forks --maxWorkers=1 --reporter=verbose` with 118 test files and 537 tests.
- The default test phase inside `CI=1 pnpm check` stalled without spawning workers;
  its component gates were therefore run separately and completed successfully.

#### Reflections

- Explicit worker configuration provides a deterministic local proof while the
  existing aggregate-runner startup issue remains separate repository tooling debt.

#### Suggested Next Steps

- Publish the branch and open a draft Feature PR to `dev`.
- Keep Task #121 and its dependent implementation work blocked until the required
  counsel and accountant evidence is available.

### session v6: Resolve PR #145 architecture review findings

- Timestamp: 2026-08-08T16:52:30Z
- Agent: Codex
- Branch: codex/118-epoch-treasury
- Head: 90d0085

#### Objective

Remove implementation ambiguity identified by the Copilot and Codex reviews without
changing the approved Feature economics or stage order.

#### Actions Taken

- Defined the project-fee basis as one aggregated `project x rail x epoch`
  assessment with one percentage calculation and one clamp.
- Aligned privileged carryover execution with the canonical state machine: after
  reconciliation, valuation, and fee processing, but before locking and allocation.
- Standardized every limited-signer velocity reference to `$500 per rolling 24-hour
  window`.
- Expanded the withdrawal migration evidence reference to its full repository path.

#### Validation Notes

- Passed: `git diff --check`.
- Verified no `rolling-day`, `rolling day`, or bare `rolling 24 hours` wording remains
  in the Feature artifacts.
- Rechecked the project-fee and carryover clauses against the approved Feature
  decision record and canonical state order.

#### Reflections

- Epoch-level fee aggregation and pre-allocation carryover both affect value
  conservation; keeping those contracts singular prevents divergent implementations.

#### Suggested Next Steps

- Commit and push the review fixes, reply to and resolve all five review threads,
  then wait for the post-fix hosted checks.
- Do not request another Copilot or Codex review; the existing review records remain
  the authoritative gates.

### session v7: Prepare the Canadian legal and accounting review packet

- Timestamp: 2026-08-08T19:46:34Z
- Agent: Codex
- Branch: codex/118-canada-review-drafts
- Head: b4bbce3

#### Objective

Prepare Task #121's repository-grounded Canadian review materials while treating
qualified counsel and accountant approval as non-bypassable production gates rather
than blockers to neutral local and `dev` implementation.

#### Actions Taken

- Recorded Fundloop Canada Inc., Ontario incorporation, and an initial Canada-only
  project/user scope as review assumptions rather than approved legal conclusions.
- Reframed Task #121 as a documentation packet, independently re-vetted it, and kept
  all live Terms, acceptance UX, provider activation, schema, and value-flow changes
  outside this Task.
- Added visibly non-effective Terms and Privacy Notice drafts, a repository-grounded
  current/planned data-flow inventory, and an accounting-recognition alternatives
  memo with linked authoritative sources.
- Preserved the requested ownership, refund, escrow, payout, profile, and invitation
  product intent while flagging non-waivable law, RPAA, FINTRAC, consumer, privacy,
  securities, tax, and accounting classifications for professional review.
- Added one production approval checklist covering professional sign-off, provider
  topology and data-transfer evidence, effective policy versions, runtime acceptance
  controls, and deployment revalidation.
- Updated the Feature architecture, engineering index, and sprint definition so the
  review packet can unblock neutral implementation only after independent validation.

#### Validation Notes

- Passed: exact `DRAFT - NOT APPROVED - NOT EFFECTIVE` marker check on every core
  review artifact.
- Passed: all local packet links and cited repository evidence paths exist.
- Passed: all 19 authoritative external source links returned HTTP 200 after replacing
  moved Supabase and CRA links with their current canonical locations.
- Passed: Mermaid render with `Render status: ok`; visually inspected the full flow
  map and an isolated high-resolution diagram capture using Playwright.
- Passed: `git diff --check`.
- UI evidence: not applicable; this Task changes review documentation only and does
  not add an effective policy surface or product behavior.

#### Reflections

- Contract labels such as ownership and non-escrow language do not by themselves
  determine the platform's Canadian payments, AML, consumer, insolvency, tax, or
  accounting classification; production approval must review actual operational
  functions and user expectations.
- The product's fixed monthly allocation rate can remain a reproducible management
  subledger convention without being presented as an approved statutory FX policy.

#### Suggested Next Steps

- Commit Task #121, attach implementation evidence to the issue, and run the
  independent issue-validator before moving it to `In Review`.
- After validation, begin the neutral ledger foundation while keeping production
  receipt, allocation, payout, and effective policies blocked on the approval packet.

### session v8: Add non-effective Terms preview and acknowledgement gates (#123)

- Timestamp: 2026-08-08T18:24:00-04:00
- Agent: Codex
- Branch: codex/118-canada-review-drafts
- Head: 3378182cb310e5027ac350d9dc7f9022ca19e6f2

#### Objective

Provide auditable Terms versioning and acknowledgement mechanics for local and
`dev` testing without publishing effective Terms or enabling production value flow.

#### Actions Taken

- Replaced the public Terms copy with a prominently labelled Canadian review
  preview whose title, metadata, and body all preserve the exact
  `DRAFT - NOT APPROVED - NOT EFFECTIVE` boundary.
- Added immutable review-document metadata and runtime helpers that fail closed in
  production and cannot treat a `review` document as effective, even when approval
  environment flags are accidentally present.
- Added forward-only legal-document and acceptance-record tables, self-select RLS,
  service-role-only writes, an approval/effective-date constraint, and a typed Edge
  Function acknowledgement command.
- Added separate project-actor and user acknowledgement evidence for the simulated
  project-funding and payout boundaries. Both existing UI actions remain disabled
  until the current review draft is acknowledged for the page session; production
  remains locked because review acknowledgement is disabled by default there.
- Kept profile publication and project-membership consent outside this Task.

#### Validation Notes

- Passed: `PATH=/opt/homebrew/opt/node@22/bin:$PATH CI=1 pnpm lint`.
- Passed: `PATH=/opt/homebrew/opt/node@22/bin:$PATH CI=1 pnpm typecheck`.
- Passed: focused Vitest run for review metadata, production gates, schema/RLS,
  route boundaries, and the existing withdrawal component: 4 files, 10 tests.
- Passed: `git diff --check`.
- Playwright loaded `/en/terms` with zero console errors and confirmed the exact
  non-effective banner, immutable identifier/hash, localized links, and unresolved
  production gates. Captured and visually inspected 1440x900 and 390x844 viewport
  evidence under `output/playwright/issue-123/`.

#### Reflections

- A review acknowledgement is useful test evidence only; it is intentionally
  recorded as `review`, explicitly carries no legal effect, and unlocks no live
  value flow.
- Effective publication needs a separately approved immutable version plus
  professional approval and launch evidence; no such version is seeded here.

#### Suggested Next Steps

- Independently validate Task #123 before moving it to `In Review`.
- Implement Task #124's separate Privacy Notice preview and public-profile consent
  record without bundling it into Terms acknowledgement.

### session v9: Add Privacy preview and explicit profile publication (#124)

- Timestamp: 2026-08-08T18:31:00-04:00
- Agent: Codex
- Branch: codex/118-canada-review-drafts
- Head: 57ae8b1

#### Objective

Provide a truthful local/dev Privacy Notice preview and make public profile
publication a separate, affirmative, prospectively withdrawable choice while
keeping every profile private without current evidence.

#### Actions Taken

- Replaced the public Privacy page with a prominently non-effective Canadian review
  preview covering the verified data categories, recipient classes, public-chain
  exposure, cross-border processing, safeguards, and unresolved provider, authority,
  retention, rights, and incident-response questions.
- Added an immutable Privacy review version and append-only profile-publication
  choice records containing user, document/hash/status, field scope, locale,
  timestamp, action, and source surface.
- Added a typed, authenticated Edge command and service-role-only atomic database
  command. Grant updates only the named public fields; withdrawal immediately turns
  off profile and field visibility while retaining the neutral audit record.
- Added an unselected affirmative account control that is separate from Terms and
  membership. The same surface offers prospective withdrawal and labels both
  actions as review-only.
- Hardened public discovery to require the latest recorded choice to be `grant` in
  addition to existing active/private-field checks. Production returns no review-
  published profiles, and deployed Edge review commands require an explicit
  non-production preview configuration.
- Updated generated Supabase types for the new table and RPC contracts.

#### Validation Notes

- Passed: `PATH=/opt/homebrew/opt/node@22/bin:$PATH CI=1 pnpm lint`.
- Passed: `PATH=/opt/homebrew/opt/node@22/bin:$PATH CI=1 pnpm typecheck`.
- Passed: focused Vitest for opt-in/withdraw UI, contract validation, private
  defaults, latest-choice discovery, RLS/command boundaries, preview content, and
  production fail-closed behavior: 6 files, 15 tests.
- Passed: `git diff --check`.
- Playwright loaded `/en/privacy` with zero console errors and confirmed the exact
  review banner, immutable document evidence, localized links, privacy inventory,
  optional-choice copy, and unresolved production gates. Captured and visually
  inspected 1440x900 and 390x844 evidence under `output/playwright/issue-124/`.

#### Reflections

- The legacy `users.is_public` flag is no longer sufficient for discovery: a
  current append-only publication grant is required, so withdrawal cannot expose a
  stale earlier choice.
- The review choice intentionally does not settle lawful basis or retention; it
  proves product mechanics while the professional production decision stays open.

#### Suggested Next Steps

- Independently validate Task #124 before moving it to `In Review` or unblocking
  invitation Task #125.
- Run the broadest practical local batch validation for #123 and #124 before the
  orchestrator publishes the Feature branch.

### session v10: Enforce Terms acknowledgement at protected commands (#123)

- Timestamp: 2026-08-08T18:59:39-04:00
- Agent: Codex
- Branch: codex/118-canada-review-drafts
- Head: 5ea6e72a90af

#### Objective

Close the independent validation findings for Task #123 by making the current
review Terms acknowledgement a server-owned precondition rather than a React-only
gate, while preserving the non-effective local/dev boundary.

#### Actions Taken

- Added an exact-document acknowledgement guard that checks actor, immutable
  identifier, content hash, locale, review status, capacity, and source surface.
- Applied that guard before both project payment-draft creation and user withdrawal
  request creation, so direct command callers cannot bypass the UI checkbox.
- Added founder and user command tests proving rejection before acknowledgement and
  successful continuation after acknowledgement.
- Normalized the Task #123 files to one newline at EOF to remove validation noise.

#### Validation Notes

- Passed: Node 22 lint and typecheck.
- Passed: focused policy/workflow suite as part of 9 files and 32 tests.
- Passed: fresh disposable local Supabase migration replay through
  `20260808230000_review_policy_versions_and_acceptances.sql`.
- Passed: real SQL/RLS/RPC assertions for valid recording, invalid document/hash
  rejection, authenticated self-read, cross-user denial, and direct-write denial.
- Passed: full Node 22 `CI=1 pnpm check` with 124 files and 554 tests plus production
  build.
- Passed: `git diff --check` with no EOF warnings.

#### Reflections

- The protected commands now own the invariant. UI state is only feedback and can
  no longer authorize a payment draft or withdrawal request by itself.
- The recorded acknowledgement remains `review` evidence only and activates no
  production value flow.

#### Suggested Next Steps

- Commit the #123 validation fixes and update its implementation evidence.
- Complete the #124 consent browser smoke and issue-scoped validation commit.

### session v11: Fail closed and prove profile publication consent (#124)

- Timestamp: 2026-08-08T19:01:00-04:00
- Agent: Codex
- Branch: codex/118-canada-review-drafts
- Head: a70b232

#### Objective

Close the independent validation findings for Task #124 by making review-profile
discovery unconditionally unavailable in production, preserving private onboarding,
and proving grant/withdrawal behavior through the real local stack and browser.

#### Actions Taken

- Made the public preview helper reject production even when the public review flag
  is set; only an explicitly identified preview deployment can use that flag with a
  production-mode build.
- Forced user onboarding publication to write every profile and field visibility
  flag as private. Optional publication remains available only through the separate,
  unselected account choice.
- Changed consent ordering to use `clock_timestamp()` so rapid append-only choices
  have an unambiguous latest action, including inside one transaction.
- Added a reusable local SQL assertion covering Terms and Privacy RPC/RLS controls,
  and a Playwright workflow covering no-consent privacy, grant/discovery, and
  withdrawal/removal.
- Normalized the remaining Task #124 files to one newline at EOF.

#### Validation Notes

- Passed: fresh disposable Supabase reset applied all migrations and seed, including
  `20260808233000_profile_publication_consents.sql`.
- Passed: SQL assertions for grant, invalid document/hash rejection, discoverability,
  explicit latest withdrawal, removal, self-read, cross-user denial, and direct-write
  denial. The same script also re-proved the #123 controls.
- Passed: local Playwright consent workflow, 1 test in 3.5 seconds, through the real
  account control, Edge command, RPC, public directory, and cleanup.
- Passed: Node 22 lint, typecheck, focused 9-file/32-test suite, and full `CI=1 pnpm
  check` with 124 files/554 tests plus production build.
- Passed: `git diff --check` with all prior EOF warnings removed.

#### Reflections

- Onboarding and publication are now structurally separate: completing onboarding
  cannot make a profile public, even if a caller sends public visibility values.
- The local browser smoke required one seeded public-project participation because
  the existing directory intentionally lists only participating users; consent alone
  still does not bypass that product rule.

#### Suggested Next Steps

- Commit the #124 validation fixes and update both issue evidence comments.
- Keep #123 and #124 In Progress for independent revalidation; do not start #125.

### session v12: Make onboarding visibly and persistently private (#124)

- Timestamp: 2026-08-08T19:12:06-04:00
- Agent: Codex
- Branch: codex/118-canada-review-drafts
- Head: a09af219551c

#### Objective

Close the remaining Task #124 revalidation finding by aligning onboarding UI,
defaults, legacy payload handling, and completion language with the private backend
behavior and separate account publication choice.

#### Actions Taken

- Changed new onboarding defaults to the private preset and made payload merging
  coerce retired public/limited inputs and every legacy visibility flag to private.
- Removed public/limited presets and per-field publication switches from onboarding.
  The visibility step now explains that completion activates only a private workspace
  profile and points to the separate, unselected Account > Profile choice.
- Replaced user-facing publish/live/discoverability claims in onboarding completion,
  preview, resume, toast, and join-card copy with explicit private-setup language.
- Extended unit, contract, command, and local Playwright coverage across a legacy
  draft containing every visibility flag set to true.

#### Validation Notes

- Passed: focused Vitest run, 4 files and 21 tests.
- Passed: Node 22 typecheck and lint.
- Passed: fresh disposable local Supabase migration/seed replay.
- Passed: local Playwright, 1 test in 8.3 seconds. The browser inspected the actual
  private onboarding visibility screen, completed a legacy-public draft through the
  real Edge command, verified every stored visibility flag remained false, verified
  the separate account checkbox was unselected, then proved grant/discovery and
  withdrawal/removal.
- Passed: `git diff --check`.

#### Reflections

- Silently overriding public-looking inputs was fail-safe but misleading. The UI and
  stored draft contract now express the same private invariant as the publish command.
- Legacy payload fields remain accepted for compatibility, but they cannot restore
  retired onboarding publication behavior.

#### Suggested Next Steps

- Commit this narrow #124 fix and attach the updated implementation evidence.
- Keep #124 In Progress for independent revalidation and leave #123/#125 unchanged.

### session v13: Add consented project invitation review sharing (#125)

- Timestamp: 2026-08-08T19:37:16-04:00
- Agent: Codex
- Branch: codex/118-canada-review-drafts
- Head: 420d6321a5b9

#### Objective

Implement Task #125 as a local/dev-only invitation review workflow in which a
pending token grants no access, exact non-effective disclosure evidence is recorded
atomically before membership, and only founder-selected profile fields become
visible to accepted participants.

#### Actions Taken

- Added a forward migration for approved sharing fields, immutable Privacy review
  document snapshots, append-only accept/decline/revoke/expiry evidence, atomic
  acceptance, revocation, and a participant-scoped approved-field read model.
- Replaced the legacy accept boundary with typed inspect, acknowledged accept,
  decline, and revoke Edge commands; direct acceptance fails closed outside the
  enabled local/dev review runtime.
- Updated founder and invitee surfaces with field selection, safe persisted status,
  the prominent `DRAFT - NOT APPROVED - NOT EFFECTIVE` disclosure, an initially
  unselected checkbox, and explicit decline/revoke actions.
- Removed public participant-profile projection from project detail. Authenticated
  project participants now receive only fields authorized by accepted invitation
  evidence; unrelated and pre-acceptance viewers receive no member profiles.
- Regenerated Supabase types and extended contract, command, migration, component,
  SQL/RLS, and persona-browser coverage.

#### Validation Notes

- Passed: disposable local Supabase reset applying every migration and seed.
- Passed: real SQL/RLS/RPC assertions for pending denial, direct evidence-write
  denial, invalid document/hash atomic rejection, accepted membership and evidence,
  approved-field reads, unrelated/cross-user denial, decline, expiry, and revocation.
- Passed: focused Vitest, 5 files and 25 tests; Node 22 lint and typecheck.
- Passed: returning-founder Playwright journey and invitation checkpoint against
  the real local app, Auth, Edge commands, and database; cleanup was clean. Its later
  operator-distribution checkpoint remains intentionally expected-pending.
- Captured and visually inspected invitation review evidence at 1440x900 and 390x844
  under `output/playwright/persona-harness/persona-20260808T233513241Z-01cfcd93/`.
- Passed: full Node 22 `CI=1 pnpm check` with 125 files/560 tests and production build.
- Passed: `git diff --check`.

#### Reflections

- Invitation possession is only a lookup capability; verified email plus exact
  affirmative acknowledgement is the atomic membership boundary.
- Keeping field choice on each invitation makes project sharing narrower than public
  profile publication and leaves production activation blocked on later professional
  approval.

#### Suggested Next Steps

- Commit Task #125 and attach the local migration, SQL/RLS, browser, visual, and full
  check evidence to the issue while leaving it In Progress for independent validation.
- Stop the disposable Edge runtime and Supabase stack; do not open the Feature PR yet.

### session v14: Close invitation lifecycle residue findings (#125)

- Timestamp: 2026-08-08T19:51:15-04:00
- Agent: Codex
- Branch: codex/118-canada-review-drafts
- Head: 78e69358b7d5

#### Objective

Close the independent validation findings for Task #125 by failing review sharing
reads closed in production, tracking organization-membership provenance through
accept/revoke, and making every list/create-triggered expiry append evidence.

#### Actions Taken

- Added a forward lifecycle migration that records whether acceptance created,
  reactivated, or left unchanged an organization membership, including the prior
  inactive/deleted state needed for exact restoration.
- Updated revocation to remove invitation-created membership only when no other
  accepted invitation still needs it, restore independently pre-existing inactive
  membership, remove project participation, and leave append-only evidence intact.
- Added a security-definer expiry command that locks and expires pending invitations
  together with versioned `expire` evidence; create/list commands no longer update
  invitation status directly.
- Bound the project member-profile read path to the production fail-closed review
  helper and added an explicit production-mode test.
- Extended SQL and persona browser coverage through accept-then-revoke to prove no
  invitation-created participant, organization membership, or shared-profile residue.

#### Validation Notes

- Passed: two fresh disposable Supabase resets applying all migrations and seed.
- Passed: executable SQL/RLS/RPC assertions for atomic expiry evidence, zero revoke
  residue, and exact restoration of independently pre-existing inactive membership.
- Passed: focused Vitest, 6 files and 29 tests; production read test included.
- Passed: returning-founder Playwright spec through real accept then revoke commands;
  invitation-created residue was absent and harness cleanup was clean. The aggregate
  remains intentionally incomplete only for the existing operator-distribution
  expected-pending checkpoint.
- Passed: Node 22 lint, typecheck, and full `CI=1 pnpm check` with 125 files/562 tests
  plus production build.
- Passed: `git diff --check`.

#### Reflections

- Membership provenance must capture prior state, not only ownership: reactivation
  is reversible without erasing an independent relationship.
- Expiry is a lifecycle event, so the status transition and evidence append belong in
  one database transaction regardless of which surface discovers the stale row.

#### Suggested Next Steps

- Commit this narrow #125 validation fix and update the issue evidence while keeping
  it In Progress for the next independent validator pass.
- Stop the disposable Edge and Supabase services; do not open a PR.

### session v15: Aggregate invitation access provenance (#125)

- Timestamp: 2026-08-08T20:04:07-04:00
- Agent: Codex
- Branch: codex/118-canada-review-drafts
- Head: 67a968ae0599

#### Objective

Close the remaining Task #125 validation gap by making invitation-created
organization membership and project participation ownership aggregate across every
accepted invitation, independent of revoke order.

#### Actions Taken

- Added service-owned aggregate provenance tables keyed by organization/user and
  project/user, with the exact prior membership and participant state needed for
  reversible cleanup.
- Updated acceptance to lock aggregate access keys, snapshot provenance once, and
  preserve that original ownership when later invitations encounter already-active
  membership or participation.
- Updated revocation to retain access while another accepted invitation supports it,
  recalculate project-admin access from remaining invitations and the original
  participant, and delete or restore access only after the final supporting revoke.
- Added safe backfill behavior for any already-accepted review rows: existing access
  is treated as independent rather than destructively claimed by the migration.
- Extended executable SQL coverage for earlier-first/final-later revoke ordering,
  aggregate provenance retention/removal, admin-role recalculation, final zero
  residue, and exact preservation of an independent favorite participant.

#### Validation Notes

- Passed: fresh disposable Supabase reset applying every migration and seed.
- Passed: executable SQL/RLS/RPC suite on the first run, including multi-invitation
  revoke ordering and independent participant restoration.
- Passed: generated Supabase types and Node 22 typecheck.
- Passed: focused one-worker Vitest, 6 files and 30 tests.
- Passed: returning-founder Playwright accept-then-revoke workflow and clean fixture
  cleanup; the aggregate remains intentionally incomplete only for the existing
  operator-distribution expected-pending checkpoint.
- Passed: Node 22 lint and full `CI=1 pnpm check` with 125 files/563 tests plus
  production build.
- Passed: `git diff --check`.

#### Reflections

- Per-invitation provenance cannot decide final ownership because revoke order may
  end on an invitation that observed access as unchanged. The resource-level
  aggregate must outlive each individual accepted invitation.
- Recalculating participant admin status on intermediate revoke avoids retaining an
  admin grant after only member invitations remain.

#### Suggested Next Steps

- Commit this narrow aggregate-provenance fix and attach the replay, SQL ordering,
  browser cleanup, and full-check evidence to #125.
- Keep #125 In Progress for independent revalidation; do not open a PR.

### session v16: Service-owned review-sharing reads (#125)

- Timestamp: 2026-08-09T00:16:00-04:00
- Agent: Codex
- Branch: codex/118-canada-review-drafts
- Head: 01947eae999f

#### Objective

Close the remaining Task #125 validation gap by denying browser-authenticated access
to the shared-profile RPC and routing local review reads through a production-gated,
service-owned Edge command.

#### Actions Taken

- Replaced the browser-callable shared-profile RPC with a service-role-only,
  actor-scoped function that independently verifies project membership.
- Added the typed `project-member-shared-profiles-read` Edge contract, command, and
  server invoker with an unconditional production fail-closed gate.
- Routed the project read model through the Edge command while retaining the app's
  existing preview gate and approved-field normalization.
- Deduplicated overlapping accepted invitations into one project-member row by
  selecting the latest accepted invitation per member.
- Extended migration, production-gate, command, executable SQL, and returning-founder
  browser coverage for direct-RPC denial and the allowed local Edge read path.

#### Validation Notes

- Passed: fresh disposable Supabase reset applying all migrations and seed.
- Passed: executable SQL/RLS/RPC suite, including authenticated direct-RPC denial,
  service-role actor scoping, pre-acceptance denial, accepted reads, and revoke cleanup.
- Passed: focused one-worker Vitest, 7 files and 34 tests; production and crafted-input
  command denial included.
- Passed: returning-founder Playwright workflow through accepted invitation, Edge-backed
  project discovery, visible member data, revoke cleanup, and clean fixture cleanup.
  The aggregate remains intentionally incomplete only for the existing
  operator-distribution expected-pending checkpoint.
- Passed: Node 22 lint, typecheck, and full `CI=1 pnpm check` with 126 files/567 tests
  plus production build.
- Passed: `git diff --check`.

#### Reflections

- RLS alone is insufficient for review sharing when a browser may call an executable
  RPC directly; the database permission boundary and Edge deployment gate must agree.
- Binding the actor identifier to the authenticated Edge user prevents crafted input
  from turning service-role execution into a cross-project read primitive.

#### Suggested Next Steps

- Commit this narrow read-boundary fix and attach replay, permission, Edge-command,
  browser, and full-check evidence to #125.
- Keep #125 In Progress for independent revalidation; stop local services and do not
  open a PR.

### session v17: Production-safe policy routes (#122)

- Timestamp: 2026-08-09T00:28:00-04:00
- Agent: Codex
- Branch: codex/118-canada-review-drafts
- Head: 73887f5458b8

#### Objective

Close the integrated Goal #122 route-level production leak by ensuring the public
Terms and Privacy routes expose no review draft content or metadata when the review
preview gate is closed.

#### Actions Taken

- Added early production-safe unavailable branches to the Terms and Privacy pages,
  before any draft document identifiers, hashes, versions, banners, or body render.
- Added production-safe route metadata while preserving the exact local/dev review
  banner, immutable document metadata, and non-effective draft content.
- Added executable route tests for production response and metadata absence, local/dev
  draft rendering, and unavailable Terms acknowledgement controls in production.

#### Validation Notes

- Passed: focused policy route and gate Vitest, 4 files and 11 tests.
- Passed: Node 22 lint and typecheck.
- Passed: Node 22 full `CI=1 pnpm check` with 127 files/570 tests plus production build.
- Passed: production HTTP smoke for `/en/terms` and `/en/privacy` with a hostile preview
  override; both returned the unavailable placeholder and none of the banner, document
  IDs, hashes, or representative draft body text.
- Passed: `git diff --check`.

#### Reflections

- Disabling acknowledgement commands is not enough when a public route can still leak
  the draft itself; content rendering and metadata generation need the same early gate.
- A neutral unavailable page keeps navigation intact without suggesting that review
  text is approved, effective, or published.

#### Suggested Next Steps

- Commit this narrow Goal #122 route fix and attach focused, full-check, and production
  HTTP evidence to the Goal.
- Leave Goal #122 Ready for independent integrated revalidation; do not open a PR.

### session v18: PR review privacy and invitation boundary fixes

- Timestamp: 2026-08-09T00:47:00-04:00
- Agent: Codex
- Branch: codex/118-canada-review-drafts
- Head: 4181d8860222

#### Objective

Address the three actionable automated review findings on PR #146 without widening
the review-only policy scope or enabling any production policy or value flow.

#### Actions Taken

- Restored the active-user join/filter before a participant can receive private or
  inactive project access and trigger member-sharing reads.
- Added a forward migration that returns the latest granted publication field set
  with each discoverable user and shaped directory/profile output to those exact
  fields. Full names, contribution details, creation timestamps, and Cubid status or
  score remain unavailable because they are outside the consent contract.
- Replaced stale-invitation decline behavior with an atomic locked decision that
  records expiry status and evidence when the deadline has already passed.
- Updated generated Supabase function types plus focused contract and executable SQL
  assertions for the corrected boundaries.

#### Validation Notes

- Passed: fresh local Supabase reset with all migrations and canonical seed.
- Passed: executable review-policy SQL, including exact consent-field propagation.
- Passed: executable invitation SQL, including direct stale decline producing expiry
  status/evidence and no decline evidence.
- Passed: focused Vitest, 3 files and 10 tests.
- Passed: Node 22 `CI=1 pnpm check` with 127 files/571 tests, lint, typecheck, and
  production build generating 162 pages.
- Passed: `git diff --check`.

#### Reflections

- A consent record must constrain every downstream read field, not merely authorize
  discovery of the row.
- Lifecycle commands must derive expiry under the same row lock as the requested
  transition so direct callers cannot change the audit result through call ordering.

#### Suggested Next Steps

- Commit and push the review fixes, reply to and resolve each addressed review thread,
  then wait for the remaining requested review and post-push CI without rerequesting.

### session v19: Copilot invitation boundary follow-up

- Timestamp: 2026-08-09T00:56:00-04:00
- Agent: Codex
- Branch: codex/118-canada-review-drafts
- Head: a294136

#### Objective

Address the remaining actionable Copilot review threads on PR #146 while keeping all
review-only invitation and sharing behavior unavailable in production.

#### Actions Taken

- Added the same unconditional production fail-closed runtime gate to invitation
  inspection before payload parsing, authentication, or service-role RPC execution.
- Tightened the forward member-sharing read model so inactive or soft-deleted subjects
  are excluded and inactive or soft-deleted viewers cannot retrieve shared profiles.
- Prevented zero-field invitation submission in the founder UI, deduplicated checkbox
  updates, and added an explicit field-selection message.
- Added focused UI/source-contract tests and executable SQL assertions for inactive
  shared-profile subjects and viewers.

#### Validation Notes

- Passed: fresh local Supabase reset applying all migrations and canonical seed.
- Passed: executable review-policy and invitation SQL suites, including inactive
  subject/viewer denial.
- Passed: focused one-worker Vitest, 4 files and 20 tests.
- Passed: Node 22 `CI=1 pnpm check` with 127 files/573 tests, lint, typecheck, and
  production build generating 162 pages.
- Passed: `git diff --check`; local Supabase stopped afterward.

#### Reflections

- Read-only review endpoints require the same deployment boundary as writes because
  policy metadata and selected profile fields are still protected review data.
- Enforcing a non-empty field set at both the UI and command contract gives founders
  immediate feedback without weakening the backend invariant.

#### Suggested Next Steps

- Commit and push this narrow follow-up, reply to and resolve all four Copilot threads,
  then wait for post-push CI and merge under the normal non-squash policy if green.

### session v20: Base stablecoin intake V2 (#132)

- Timestamp: 2026-08-09T01:02:03-04:00
- Agent: Codex
- Branch: codex/130-settlement-packages
- Head: f5b7e0a

#### Objective

Implement a versioned, non-production Base receipt boundary for the curated USDC,
USDT, and PYUSD slots with exact separated-treasury reconciliation.

#### Actions Taken

- Added `FundLoopBaseIntakeV2` with constructor-bound token slots, project fee
  snapshots, gross/fee/net conservation, separated platform and epoch transfers and
  events, owner-only configuration, pause control, and duplicate receipt protection.
- Added a guarded local/Base Sepolia deployment script and disabled tracked manifest;
  mainnet and every non-local/dev/test environment remain unavailable.
- Added forward Base deployment, asset, fee-version, receipt, and append-only
  reconciliation schema with service-only typed RPCs and Edge commands.
- Derived confirmation, exact, mismatch, reorg, and replacement states from trusted
  receipt/block/treasury evidence rather than caller status.
- Added local Hardhat, contract, RLS/RPC, deployment, and integrated ledger evidence,
  regenerated Supabase types, and documented the issuer-verification production gate.

#### Validation Notes

- Passed: guarded local chain deployment on 31337 and explicit production deployment
  refusal; Base Sepolia was skipped because no authorized RPC/private key is present.
- Passed: Hardhat 8/8 tests, including four V2 local wallet/adversarial cases.
- Passed: fresh local Supabase reset plus neutral ledger, epoch shadow, external shadow
  reconciliation, and Base V2 SQL suites.
- Passed: focused Vitest with 3 files/23 tests and full Node 22 `CI=1 pnpm check`
  with 134 files/614 tests, lint, typecheck, and production build.
- Passed: `git diff --check`; no browser surface changed, so browser evidence is N/A.
- Attempted standalone Deno type-checking; it remains unavailable because the existing
  shared command runtime is untyped under strict Deno checking. The new functions follow
  the established runtime pattern and are covered by source-contract and app type tests.

#### Reflections

- A symbol allowlist is insufficient without constructor-bound addresses, deployment
  matching, and a disabled tracked manifest.
- Reorg and replacement evidence must remain append-only while the latest read model
  is derived, and exact treasury amounts must be independently observed.

#### Suggested Next Steps

- Commit #132 and attach local-chain, migration, SQL/RLS/RPC, focused, and full-check
  evidence for independent validation.
- Keep #131 blocked on Stripe sandbox authorization and leave #133 untouched/Ready.

### session v21: Base provider and trusted observation integrity (#132)

- Timestamp: 2026-08-09T01:23:42-04:00
- Agent: Codex
- Branch: codex/130-settlement-packages
- Head: 07b7316

#### Objective

Close the #132 validation gaps in provider-address activation, Base Sepolia execution,
deployment audit state, and independently observed reconciliation.

#### Actions Taken

- Required explicit local fixture mode and labelled local mock tokens accordingly; bound
  Base Sepolia USDC to Circle evidence while leaving unverified USDT/PYUSD disabled.
- Added contract and forward database invariants preventing an unverified token from
  becoming active, plus paused/enabled/provider-evidence deployment audit inputs.
- Added executable Hardhat Base Sepolia configuration with clear missing test credential
  errors and retained unconditional production deployment refusal.
- Reduced the Edge request to `receiptId` only. A trusted viem observer now reads the
  transaction receipt/current block, validates the V2 event, and totals exact ERC-20
  transfers to both treasuries before service-only reconciliation.
- Added trusted replacement resolver configuration and append-only observation-source/
  event-match evidence; caller-crafted hashes and amounts cannot cross the Edge contract.

#### Validation Notes

- Passed: Hardhat 9/9, including real local receipt to trusted viem transfer-log evidence
  and unverified-provider activation denial.
- Passed: guarded local fixture deploy; missing Base Sepolia credentials fail clearly;
  production deployment remains denied.
- Passed: fresh local replay and all four integrated SQL suites, including adversarial
  provider evidence and authenticated crafted reconciliation denial.
- Passed: focused Vitest 3 files/23 tests and full Node 22 check with 134 files/614 tests,
  lint, typecheck, and production build.
- Passed: `git diff --check`; UI unchanged, browser N/A.

#### Suggested Next Steps

- Commit the narrow validation follow-up, update #132 evidence, and return for independent
  revalidation without changing #131/#133 or opening a PR.

### session v22: Local fixture chain binding (#132)

- Timestamp: 2026-08-09T01:32:13-04:00
- Agent: Codex
- Branch: codex/130-settlement-packages
- Head: 2df1cfa

#### Objective

Ensure local mock-provider evidence can activate assets only on the disposable Hardhat
chain and never on Base Sepolia or Base mainnet chain IDs.

#### Actions Taken

- Added a forward replacement of the asset-activation trigger requiring the exact
  `(deployment_environment='local', chain_id=31337)` tuple for `local_fixture_only`.
- Added adversarial local+84532 and local+8453 asset activation probes.
- Added deferred deployment activation/unpause probes proving a fixture-less deployment
  on either Base chain ID cannot bypass the asset invariant.

#### Validation Notes

- Passed: fresh local Supabase reset with the forward migration.
- Passed: all four integrated SQL suites, including both new Base chain adversarial cases.
- Passed: focused Base Vitest (1 file/12 tests), typecheck, lint, and `git diff --check`.
- Passed: full Node 22 `CI=1 pnpm check` with 134 files/614 tests and production build.

#### Suggested Next Steps

- Commit the narrow forward-only fix and return #132 for independent revalidation.

### session v23: Base intake review input integrity (#132)

- Timestamp: 2026-08-09T01:53:11-04:00
- Agent: Codex
- Branch: codex/130-settlement-packages
- Head: 7e680ab

#### Objective

Address the actionable PR #148 review findings without changing the approved Base intake
scope or weakening its trusted-observation boundary.

#### Actions Taken

- Accepted checksum-style uppercase hexadecimal characters in EVM addresses and hashes;
  the database command continues to persist canonical lowercase values.
- Compared platform and epoch treasury addresses case-insensitively so capitalization
  cannot alias the same treasury.
- Added a forward-only reconciliation wrapper whose `IS DISTINCT FROM` guard rejects
  missing, null, and incorrect observation sources before invoking the prior trusted
  implementation.
- Added focused TypeScript and executable SQL adversarial coverage for the review cases.

#### Validation Notes

- Passed: fresh local Supabase replay through the new forward migration.
- Passed: all four integrated SQL suites, including missing/null/wrong source denial and
  the existing `trusted_viem_v1` reconciliation lifecycle.
- Passed: focused Base intake Vitest (1 file/13 tests).
- Passed: lint, typecheck, and `git diff --check`.
- Passed: full Node 22 `CI=1 pnpm check` with 134 files/615 tests and the 162-route
  production build.

#### Suggested Next Steps

- Commit and push this single review-fix checkpoint, then let the coordinating agent
  reply to and resolve the already-inspected PR threads without requesting rereview.

### session v24: Base receipt identity and fee history review fixes (#132)

- Timestamp: 2026-08-09T02:08:47-04:00
- Agent: Codex
- Branch: codex/130-settlement-packages
- Head: 45f5e7e

#### Objective

Close the four unprompted Codex review findings on PR #148 while preserving the local-only,
fail-closed settlement-package boundary.

#### Actions Taken

- Locked deployment environment, chain, contract, and treasury identity coordinates while
  any asset remains enabled; pause and activation state remain independently operable.
- Added monotonic onchain project-fee versions to configuration and receipt events, then
  resolved the exact historical project/version/rate tuple in the receipt command.
- Persisted bytes32 receipt references and added per-deployment uniqueness alongside the
  existing transaction/log uniqueness boundary.
- Bound the trusted observer to the exact BaseReceipt contract log index and indexed receipt
  reference, returning explicit observed identity evidence rather than scanning any matching
  receipt event in the transaction.
- Persisted the authoritative transaction-receipt block number and derived confirmations from
  it; stored/observed block disagreement and wrong log/reference evidence now remain mismatch.
- Preserved provisional legacy rows as nullable, append-only records while the Edge command
  fails closed when their new identity evidence is absent.
- Regenerated Supabase types and documented the identity, fee-history, and coordinate-lock rules.

#### Validation Notes

- Passed: fresh local Supabase reset through the forward migration and all four integrated SQL
  suites, including coordinate mutation, duplicate log/reference, historical fee, and low-block
  adversarial probes.
- Passed: Hardhat 10/10, including a real local receipt observed at the exact log/reference and
  after a subsequent fee-version change.
- Passed: focused Base Vitest (1 file/13 tests), lint, typecheck, and `git diff --check`.
- Passed: full Node 22 `CI=1 pnpm check` with 134 files/615 tests and the 162-route production build.

#### Suggested Next Steps

- Commit and push the complete four-thread review batch, then let the coordinating agent reply
  to and resolve the threads without requesting another review.

### session v25: Stripe bank-transfer sandbox intake (#131)

- Timestamp: 2026-08-09T09:32:00-04:00
- Agent: Codex
- Branch: codex/130-settlement-packages
- Head: fe211a6

#### Objective

Implement the local/dev Stripe USD bank-transfer command, webhook, reconciliation, and founder
review surfaces for #131 while preserving production fail-closed behavior and documenting the
provider-blocked USD success path and unsupported CAD presentment truthfully.

#### Actions Taken

- Added the current Stripe SDK, a typed Customer Balance push-transfer adapter, authenticated
  intent/status Edge commands, and raw-body signed webhook verification with authoritative
  PaymentIntent, charge/dispute, and Stripe balance reads.
- Added forward-only intent, immutable webhook/evidence, balance snapshot, custody-route, and
  clearing-sweep schema; service-only commands enforce environment, Terms, project-admin,
  amount, account, ordering, replay, RLS, append-only, and production-denial boundaries.
- Bound exact USD availability to neutral-ledger posting, external funding application, and
  conserved shadow journal evidence; full refund or lost-dispute evidence reverses the linked
  transaction without mutating legacy payment state.
- Separated presentment and provider-balance settlement currencies. Cross-currency USD-to-CAD
  settlement evidence is retained but cannot unlock USD custody or shadow posting.
- Added founder UI for USD sandbox instructions, pending evidence, sweep state, and explicit CAD
  unavailability. Non-2xx typed Edge failures now preserve safe provider guidance for the UI.
- Documented Stripe's USD-only bank-transfer presentment support for this path, the Fundloop
  sandbox Bank Transfers activation blocker, credential handling, and validation workflow.

#### Validation Notes

- Passed: three fresh local Supabase migration/seed replays during development and the final
  executable Stripe SQL suite, including production/CAD/direct-write denial, availability,
  replay/conflict, ordering, mismatch, refund reversal, legacy non-mutation, and sweep pending.
- Passed: all five integrated neutral-ledger, epoch, external reconciliation, Base V2, and Stripe
  SQL suites.
- Passed: real Stripe CLI signed event delivery through the local Edge runtime with authoritative
  SDK re-fetch, normalized immutable evidence, and balance snapshot; invalid signature returned
  400. The real USD instruction call correctly remained blocked because Bank Transfers are not
  enabled in the Fundloop Stripe sandbox.
- Passed: focused Vitest (3 files/13 tests), lint, typecheck, and `git diff --check` after the final
  hardening. The final full Node 22 `CI=1 pnpm check` passed 136 files/624 tests plus the 162-route
  production build.
- Passed: final Supabase best-practices audit with least-privilege service access, transaction-level
  advisory locks, short database-only command transactions, and zero unindexed foreign-key columns
  across the new Stripe tables.
- Passed: authenticated founder browser smoke at 1440x900 and 390x844 with zero pre-action console
  errors, exact review-only/CAD disclosure, a pending $1,280 USD payment, and the Terms gate. Both
  captures were visually inspected under `output/playwright/issue-131/`.

#### Reflections

- Stripe bank-transfer presentment does not support CAD, and the Fundloop sandbox currently
  rejects USD funding instructions until Bank Transfers are enabled in Dashboard. Neither gap
  may be represented as a green provider success fixture.
- The Canadian sandbox converted a test USD card event into a CAD balance transaction. Treating
  provider settlement amounts as if they shared the presentment currency would violate monetary
  conservation; the model now fails closed on that boundary.

#### Suggested Next Steps

- Enable Bank Transfers for the Fundloop Stripe sandbox, rerun the real USD instruction and
  delayed-availability/reversal/mismatch lifecycle, then independently validate #131. Keep CAD
  bank transfer and every live/production path disabled pending an approved provider capability.

### session v26: versioned project settlement packages (#133)

- Timestamp: 2026-08-09T17:24:17-04:00
- Agent: Codex
- Branch: codex/130-settlement-packages
- Head: 7b4953a

#### Objective

Implement the local/dev project-package workflow for #133 while the remaining Stripe provider
activation proof is deferred, preserving a fail-closed production and no-value-flow boundary.

#### Actions Taken

- Added forward-only, append-only package, payment-pairing, funding-source, compliance, CUBID
  cohort, email-evidence, and founder-decision schema with service-only command boundaries.
- Added rerunnable pre-cutoff validation, immutable post-cutoff freeze, missing-pair rollover,
  delivery-relative business deadlines, approve/opt-out/silent-approval decisions, and source-
  preserving rollover that assesses the project fee once while deferring the base fee.
- Bound settled Stripe/Base sources, approved attribution datasets, explicit KYB/KYC/sanctions
  evidence, and the complete valid/whitelisted/greylisted/blacklisted/invalid/outage TTL matrix.
- Added project-scoped pseudonyms, a privacy-safe approved public report, and a shadow lock-
  candidate view that admits only fully approved packages while production remains disabled.
- Added typed browser/server/Edge commands, founder review, operator reconciliation controls,
  local Mailpit delivery, a public preliminary-report route, and project navigation.
- Kept compliance inputs pending by default; operators must explicitly record all three passed
  gates plus a SHA-256 evidence hash and validity time before validation can run.
- Updated the settlement architecture status and regenerated the canonical Supabase types.

#### Validation Notes

- Passed: multiple fresh local Supabase migration/seed replays and the executable #133 SQL suite,
  including production/authenticated/direct-write denial, missing-pair rollover, frozen mutation
  denial, complete CUBID decisions, pseudonym separation, email gating, opt-out provenance,
  silent approval, public privacy, and lock-candidate admission.
- Passed: all six integrated neutral-ledger, epoch-shadow, external-reconciliation, Base V2,
  Stripe intake, and project-package SQL suites.
- Passed: focused Vitest (3 files/11 tests), lint, typecheck, `git diff --check`, and final
  Supabase schema lint with no new warning (one pre-existing invitation parameter warning).
- Passed: full Node 22 `CI=1 pnpm check` with 139 files/635 tests and the 165-route production
  build.
- Passed: real local browser flow with Maya OTP auth, frozen founder package at $990, one payment,
  one settled source, three eligible and three held users; Mailpit accepted the finance recipient
  email, the accepted timestamp created the deadline, founder approval created one lock candidate,
  and the public report exposed only seven/three/three/one totals. Desktop 1440x900 and mobile
  390x844 captures were visually inspected with zero console errors.

#### Reflections

- The Supabase local Edge launcher requires an explicit ignored env file; ordinary parent-shell
  variables were not forwarded, and the first browser delivery correctly failed closed as
  production until the explicit local runtime was provided.
- Stripe provider activation remains separate from the package state machine. No sandbox fixture,
  production credential, canonical lock, allocation, payable, provider payout, or value flow was
  enabled by this session.

#### Suggested Next Steps

- Independently validate #133 and move it to In Review only after a passing report.
- Return to the real #131 Stripe bank-transfer provider lifecycle when the newly approved Stripe
  access can produce the required sandbox evidence; keep production activation deferred.
