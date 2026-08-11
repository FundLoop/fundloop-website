### session v1: Public monthly coordination story and capability review

- Timestamp: 2026-08-11T15:49:00-04:00
- Agent: Codex
- Branch: codex/public-monthly-coordination-story
- Head: 2b87b9c

#### Objective

Make FundLoop's unauthenticated home and durable documentation accurately describe
the monthly economic coordination target, then compare that target with the current
`dev` branch and Supabase Dev environment without overstating local, sandbox, hosted,
or production capability.

#### Actions Taken

- Rebuilt the public home around one dominant monthly-epoch visual and a seven-step
  revenue-to-claim story rather than the prior generic network-state/use-case page.
- Added clear paths for regular users, project teams, researchers/public readers,
  and internal operators/agents, plus explicit private-by-default and opt-in
  publication language.
- Added complete English, French, and Spanish copy for the new home hierarchy and
  strengthened home metadata around revenue pooling, verification, participation,
  and monthly distribution.
- Updated the repository and target/current architecture docs to define FundLoop as
  a multilingual app shell plus Supabase workflow engine and MCP interface.
- Added an evidence-classed capability review comparing `origin/dev` at `2b87b9c`
  with Supabase Dev project `kyxtqnfnksvcaugxwzuj`.
- Verified that app CI is green while the matching Supabase deploy is blocked at
  `20260809020000_neutral_ledger_foundations.sql` with SQLSTATE `42601`.
- Compared 62 local Edge Function directories with 38 active remote functions and
  documented the missing settlement, ledger, multi-rail, payout, and cutover paths.

#### Validation Notes

- Passed `PATH=/opt/homebrew/opt/node@22/bin:$PATH CI=1 pnpm check`:
  lint, 169 test files / 757 tests, typecheck, and a 165-page production build.
- Passed focused i18n validation before adding the final seven-stage/four-audience
  regression assertion; that assertion was re-run separately afterward.
- Passed `git diff --check` before the final session-log update.
- Browser-reviewed `/en` at 1440x900 and 390x844 with the real Next.js dev server.
  The hero fits the desktop and mobile first viewport, reduced-motion-safe loop
  animation remains legible, and mobile has no horizontal overflow.
- The local browser used a non-secret placeholder Supabase configuration solely to
  let the unauthenticated shell render; no remote Supabase mutation occurred.

#### Reflections

- The frontend skill pushed the page toward one memorable economic-loop visual,
  cardless stage and audience layouts, sparse copy, and motion that communicates
  cadence rather than decoration.
- The largest delivery risk is no longer absence of workflow code; it is the split
  between CI-green app code and a stale Supabase Dev backend.
- Public reporting remains a metadata/read-model scaffold until generation,
  publication, retention, and hosted audience-specific verification are complete.

#### Suggested Next Steps

- Review and publish this branch through the normal PR-to-`dev` flow.
- Repair the prepared-statement migration failure, replay Supabase Dev migrations,
  deploy the missing current functions, and quarantine the retired remote payout
  function before claiming shared-dev parity.
- Run one hosted founder/user/operator acceptance flow and complete deterministic
  report generation plus three-month claim lifecycle proof.

### session v2: Correct allocation policy documentation

- Timestamp: 2026-08-11T17:35:00-04:00
- Agent: Codex
- Branch: codex/public-monthly-coordination-story
- Head: 1d5b0ad

#### Objective

Correct the durable allocation contract so the selected monthly multiple limits
redistribution top-ups only, while full score-adjusted initial claims remain intact
and E−3 unclaimed awards become a redistribution source.

#### Actions Taken

- Replaced the current allocation specification with
  `settled_cubid_redistribution_v2` terminology, equations, conservation rules,
  immutable cap-selection inputs, and audience-specific reporting requirements.
- Corrected the operational MVP and settlement-backed treasury documents to remove
  initial-claim clipping and ceiling-derived pool value.
- Updated the epoch accounting sprint definition and issue tree to define the pool
  as score discounts, exactly E−3 harvested awards, and prior carry-in residue.
- Documented three complete payout months, newest-lot-first partial harvest, released
  claim handling, deterministic residue carry-forward, and the production boundary.

#### Validation Notes

- Confirmed the active engineering and issue-tree documents no longer describe
  initial-claim clipping or overlap-cap overflow as current policy.
- Passed `git diff --check` for the documentation package.

#### Reflections

- “Redistribution top-up ceiling” is materially different from “final cap”: a final
  award may exceed the ceiling when the preserved initial total already exceeds it.
- The selected multiple and aggregate E−3 harvest belong in every monthly report
  scope and root hash, not only in an operator-side calculation note.

#### Suggested Next Steps

- Review the policy commit before the implementation commit so schema and runtime
  fields can be checked against the equations and conservation rules directly.
