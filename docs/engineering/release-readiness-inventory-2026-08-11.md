# Feature #118 release-readiness inventory — 2026-08-11

Snapshot time: 2026-08-11T20:06:15-04:00 (America/Toronto)

Candidate Git SHA: `7eacafe7d1003a7f9e529d4887423d158e017732`

Scope: evidence capture for [Sprint #155](https://github.com/FundLoop/fundloop-website/issues/155), Task [#156](https://github.com/FundLoop/fundloop-website/issues/156), and Feature [#118](https://github.com/FundLoop/fundloop-website/issues/118)

This inventory is a point-in-time release record, not architecture approval, deployment authority, professional approval, or go-live authority. It deliberately keeps six different evidence states separate:

| State | Meaning |
| --- | --- |
| `in-code` | The reviewed candidate contains the surface. This says nothing about replay or deployment. |
| `local-real` | The repo-owned local environment exercised real code and local infrastructure. This is not shared Dev or provider proof. |
| `ci-deployed-dev` | GitHub Actions successfully applied the exact candidate to Supabase Dev. A dry-run or an attempted deploy does not qualify. |
| `hosted-verified` | A role-specific flow passed against the same hosted application and Supabase Dev deployment, with an evidence timestamp. |
| `production-deployed` | The exact candidate and manifest were deployed to Production and read back. This is not cutover or go-live. |
| `value-flow-enabled` | A separately approved runtime gate permits real receipt, posting, or payout. Deployment never implies this state. |

An unproven state is `not established`, even when a weaker state is green.

## Candidate and branch evidence

- PR [#185](https://github.com/FundLoop/fundloop-website/pull/185) merged to `dev` on 2026-08-11 as `7eacafe7d1003a7f9e529d4887423d158e017732`. Its PR head was `0306b1adf5fb2df0daf059f271ab9f2f50b9fee9`, and its recorded base was `2b87b9cfeee52f897e0909a995fe7ff42b531cbc`.
- The successful push CI run is [31542120641](https://github.com/FundLoop/fundloop-website/actions/runs/31542120641). It ran lint, tests, typecheck, build, and contract tests for the merge SHA. This establishes application CI only.
- The paired Supabase push run [31542120571](https://github.com/FundLoop/fundloop-website/actions/runs/31542120571) failed. Therefore the merge SHA is **not** `ci-deployed-dev` for Supabase.
- At snapshot time `origin/dev` was the merge SHA, while `origin/main` was `2d644f90c30e4377e56057d5830eded3d538a048`; `git rev-list --left-right --count origin/main...origin/dev` returned `0 403`. Main had no unique commits and Dev was 403 commits ahead. This divergence must be refreshed before promotion.

## Actions, rules, and environment controls

The checked-in [Supabase Deploy workflow](../../.github/workflows/supabase-deploy.yml) routes PRs to migration dry-run and pushes to migration plus function deployment. Main-target deploys select the GitHub `Production` environment. The workflow currently has two important evidence limitations:

1. A PR dry-run only asks the Supabase CLI to plan the unapplied migrations; the PR #185 dry-run [31541774540](https://github.com/FundLoop/fundloop-website/actions/runs/31541774540) passed even though the push execution failed on SQL.
2. Functions deploy only after every migration succeeds, so a migration failure leaves the remote function inventory unchanged.

Live GitHub API read-back on 2026-08-11 returned:

- no repository rulesets;
- `Branch not protected` for both `dev` and `main`;
- six environments: `copilot`, `Preview`, two Vercel Preview environments, `Production`, and `Production – fundloop-website-dev`;
- no protection rules on any of those environments; and
- `can_admins_bypass=true` for each environment.

Consequently, the checked-in workflow expresses an intended gate, but GitHub does not currently enforce branch review or a required Production reviewer. This is a configuration blocker owned by a GitHub repository administrator; changing it is outside this evidence Task.

## Supabase inventory and deploy failure

The local candidate contains 93 forward migration files. Run 31542120571 reported 41 migrations pending on Supabase Dev, from `20260809020000_neutral_ledger_foundations.sql` through `20260811120000_epoch_allocation_policy_v2.sql`. It attempted the first and failed at statement 3 with `cannot insert multiple commands into a prepared statement` (`SQLSTATE 42601`). No later migration was attempted and the function deployment step was skipped.

The candidate contains 62 deployable function directories. Read-only `supabase functions list` returned:

| Target | Active remote functions | Comparison with candidate |
| --- | ---: | --- |
| FundLoop Dev (`kyxtqnfnksvcaugxwzuj`) | 38 | 37 names match, 25 candidate functions are missing, and retired `monthly-cycle-payout-intents-create` remains remote-only. |
| FundLoop Prod (`tpouimiyfmvucrerfhfc`) | 0 | No tracked function is deployed. This does not establish an empty schema or a production release; it establishes only the management-API function inventory. |

Candidate functions missing from Dev are:

```text
base-intake-v2-receipt-record
base-intake-v2-reconcile
base-safe-payout-operator
epoch-allocation-close
epoch-financial-prep
epoch-financial-prep-scheduler
epoch-funded-allocation
epoch-project-package-workflow
epoch-shadow-scheduler
financial-cutover
shadow-financial-event-ingest
shadow-financial-journal-post
stripe-acss-debit-checkout-create
stripe-acss-debit-status-read
stripe-acss-debit-webhook
stripe-bank-transfer-intent-create
stripe-bank-transfer-status-read
stripe-bank-transfer-webhook
stripe-connect-account
stripe-connect-payout-operator
stripe-connect-webhook
stripe-pay-by-bank-checkout-create
stripe-pay-by-bank-status-read
stripe-pay-by-bank-webhook
withdrawal-operator
```

The management API proves function names, versions, status, and update times. It does not expose source digests, migration history, schema fingerprints, runtime secret values, or hosted workflow correctness. The 41-name pending migration plan from the failed deploy is the current non-mutating remote migration evidence; exact applied history and schema parity still require the immutable contract and read-back work in #157 and Goal #158.

## Capability state

The canonical local capability classifications remain in [the Feature #118 operational validation record](./feature-118-operational-validation.md) and its [machine-readable matrix](../../tests/e2e/operational/feature-118-capability-matrix.json). The [2026-08-20 Dev capability review](./capability-review-2026-08-20.md) records the later promoted baseline and its still-open hosted and professional blockers; it does not certify Production or value flow.

| Capability | Strongest state supported at this snapshot | Evidence and boundary |
| --- | --- | --- |
| Allocation policy v2 (`settled_cubid_redistribution_v2`) | `in-code`; local evidence exists | PR #185 contains migration `20260811120000` and `epoch-funded-allocation`. Neither is on Supabase Dev. |
| Base USDC intake and Safe payout | `local-real` | Repo-owned Hardhat/local evidence exists. The three required new functions are missing from Dev; reviewed token/provider and hosted evidence remain pending. |
| Base USDT and PYUSD | stubbed, below `local-real` | Local mock routes are not reviewed issuer-address or hosted provider evidence. |
| Stripe Connect USD/CAD payout | sandbox-real, separate from the six release states | Retained sandbox evidence exists; its current functions are absent from Dev and no production enablement is claimed. |
| Stripe USD/CAD bank-transfer intake | pending | The capability matrix records provider capability absence; all three functions are absent from Dev. |
| Canadian PAD | `local-real` | Local signed-event/refetch/reconciliation behavior exists; the ACSS functions are absent from Dev and hosted account/capability proof is outstanding. |
| EUR/GBP Pay by Bank | `local-real` | Local behavior exists; all Pay by Bank functions are absent from Dev and hosted/canonical-account proof is outstanding. |
| Five personas, privacy, and reports | local evidence only | Earlier remote-safe payment smoke is narrower than same-environment founder/member/operator acceptance. Deterministic report generation/publication/retention and hosted privacy-negative proof remain open. |
| Three-month claims and exactly E-3 harvesting | `in-code`; focused local evidence required | The policy is merged but is neither Dev-deployed nor hosted-verified. Issue #186 owns the four-epoch local proof before #182. |
| Production policy, accounting, cutover, and value flow | not established; disabled by design | Production functions are absent; professional conclusions, exact opening balances, cutover evidence, promotion, and a separate activation decision remain outstanding. |

## Professional and cutover artifacts

The repository contains five prominent `DRAFT - NOT APPROVED - NOT EFFECTIVE` artifacts under [`docs/legal/review-drafts/`](../legal/review-drafts/README.md): the packet checklist, Terms draft, Privacy Notice draft, data-flow inventory, and accounting-recognition memo. They were prepared for Fundloop Canada Inc. and require qualified counsel/accountant review. PR #185 adds concrete E-3 expiry/harvest questions but does not turn any draft into an approval.

The [financial cutover runbook](./financial-cutover-runbook.md) is also local/dev/test review material. It does not authorize Production mutation, definitive bookkeeping, opening balances, canonical cutover, or a provider/value movement.

## Blocker and owner map

| Blocker | Evidence owner | Resolution evidence required |
| --- | --- | --- |
| SQL execution fails at migration `20260809020000` | Goal #158 / Tasks #159-#160 | Executable fresh replay, reviewed forward repair, green push deploy, exact migration/function read-back. |
| PR dry-run does not execute migration SQL | Task #159 | CI gate that executes every migration and fails the PR on SQL errors. |
| Dev is missing 25 functions and has one retired extra | Tasks #160-#162 | Immutable expected inventory and source digests matching read-back, with explicit retirement/quarantine decision. |
| No branch ruleset/protection | GitHub repository administrator; Task #162 verifies | Live rules read-back requiring PRs/checks, or an explicit stop if unavailable. |
| Production environment has no required reviewer and permits admin bypass | GitHub repository administrator; Tasks #162/#173 verify | Live environment protection read-back and recorded approval path before Production deploy. |
| Hosted CAD PAD and EUR/GBP Pay by Bank reality unproven | Task #166, Stripe account owner | Same hosted Dev/app pair, exact canonical test account/capabilities, signed events/refetch/reconciliation, truthful unavailable states. |
| Base issuer/provider reality incomplete | Task #166, Base/provider owner | Reviewed addresses/provider topology and same-environment hosted evidence; unsupported assets remain disabled. |
| Persona/privacy evidence not same-environment current | Tasks #164/#165/#183 | Founder, verified user, project member, and operator acceptance against one immutable Dev deployment, including negative privacy checks. |
| Reporting/publication/retention incomplete | Task #181, product/privacy owners | Deterministic generation, audience transformations, immutable publication/read-back, approved retention classification. |
| Three-month claims not proven end to end | Tasks #186/#182 | Four-epoch local proof followed by hosted same-deployment claims, expiry, E-3 harvest, rollover, and reconciliation evidence. |
| Legal/accounting/tax/privacy/custody/sanctions decisions are drafts | Tasks #168/#169/#184, qualified counsel and accountant | Signed, scoped professional conclusions bound to exact versions and runtime assumptions. |
| Opening balances and cutover not approved | Tasks #170/#172, finance/operator approvers | Reconciled immutable opening-balance manifest, non-bypassable cutover gates, rollback evidence, and explicit human approval. |
| `dev` to `main` promotion and Production parity absent | Task #173, human merger and Production approver | Reviewed PR, green required checks, human merge, exact SHA/deployment/migration/function/schema parity read-back. |
| Real value flow | separate post-Sprint authority | Explicit go-live approval plus independently validated activation/rollback. It is not authorized by #155 completion. |

## Required refreshes

This snapshot expires whenever the candidate SHA, migration/function inventory, provider account capability, GitHub rules/environment configuration, Supabase deploy state, professional packet, or runtime controls change. Tasks that consume it must record a new observation time and source digests rather than editing the historical claims in place.

## Capability trace smoke

Claim traced: `settled_cubid_redistribution_v2` allocation.

1. Reviewed merge: PR #185 merged as `7eacafe7`; application CI run 31542120641 passed.
2. Candidate migration: `supabase/migrations/20260811120000_epoch_allocation_policy_v2.sql`, SHA-256 `74e5f46f6dd370d2d9ea64ac1efbce3df70dfad3374781bf3fd1a5b21a124418`.
3. Candidate function: `supabase/functions/epoch-funded-allocation/index.ts`, SHA-256 `b6c079d018f13d90baeca74be0b7a709cd8e03b34aee08761993ed4d82459adc`.
4. Deploy evidence: run 31542120571 stopped at `20260809020000`, before the v2 migration; function deployment was skipped.
5. Read-back: `supabase functions list --project-ref kyxtqnfnksvcaugxwzuj` did not contain `epoch-funded-allocation`.
6. Truthful state: `in-code` with local evidence; not `ci-deployed-dev`, not `hosted-verified`, not `production-deployed`, and not `value-flow-enabled`.

The merge and green app CI cannot be substituted for the missing states.
