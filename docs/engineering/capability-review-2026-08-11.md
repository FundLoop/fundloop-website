# FundLoop capability review — 2026-08-11

Assessment timestamp: 2026-08-11, America/Toronto

Compared environments:

- application source: `origin/dev` at `2b87b9cfeee52f897e0909a995fe7ff42b531cbc`;
- Supabase Dev: project `kyxtqnfnksvcaugxwzuj`;
- local operational evidence: the Feature #118 capability matrix and repo-owned tests at the same `dev` commit.

This is a capability review, not a launch claim. “In code” means a typed surface and tests exist on `dev`. “On Supabase Dev” means the required schema and Edge Functions were verified remotely. “Local-real” and “sandbox-real” retain the exact meanings in the Feature #118 validation record; neither means production-ready.

## Executive conclusion

FundLoop has moved well beyond a marketing site or CRUD prototype. The branch contains a credible application shell, identity integration, founder and operator workspaces, deterministic monthly-cycle machinery, financial control-plane foundations, payout orchestration, privacy controls, and MCP contracts.

It is not yet a usable end-to-end monthly economy on Supabase Dev. The application and backend are out of sync. App CI is green, but the remote Supabase deployment is blocked before the newer ledger and epoch migrations, 25 current Edge Function directories are absent remotely, provider capabilities are mixed, report publication is incomplete, and production value flow is intentionally disabled.

The honest short version is: **the workflow design and local control plane are substantially present; the shared dev environment and production operating system are not yet caught up.**

## Evidence snapshot

- `dev` CI run `31521550946` passed for commit `2b87b9c`.
- The matching Supabase Deploy run `31521550923` failed in migration `20260809020000_neutral_ledger_foundations.sql` with PostgreSQL error `cannot insert multiple commands into a prepared statement` (`SQLSTATE 42601`).
- The last observed successful Supabase Dev deploy was run `31287337962` on 2026-08-09.
- The repo contains 62 deployable Edge Function directories; Supabase Dev reported 38 active functions.
- Supabase Dev still exposes the retired `monthly-cycle-payout-intents-create` function while lacking 25 current functions, including the settlement-backed epoch, neutral-ledger, multi-rail intake, payout-operator, and financial-cutover surfaces.
- The Feature #118 matrix classifies 14 capabilities as `local-real`, one as `sandbox-real`, two as `stubbed`, and three as `pending`. Production value flow is `false`.

## Target comparison

| Target capability | On `dev` branch | On Supabase Dev | Honest assessment |
| --- | --- | --- | --- |
| Multilingual public explanation of the monthly loop and four audiences | Public i18n shell and routes exist. The 2026-08-11 public-home redesign is on a feature branch pending review, not yet on `dev`. | Public content depends primarily on the app deployment, not Supabase. | **Partial.** The product shell is multilingual; the clearest articulation is not deployed yet. |
| User onboarding and CUBID identity | Resumable onboarding, CUBID email resolution/profile sync, snapshots, score reads, private-by-default publication choice, and remediation UI exist. | Core CUBID and publication-choice functions are active. New epoch score-lock/remediation gates depend on missing financial-prep deployment. | **Useful but incomplete.** Identity linkage is real; full uniqueness/KYC assurance and monthly locked eligibility are not proven end to end remotely. |
| Project onboarding, membership, and recurring revenue commitment | Founder onboarding, project publication, invitations, payment routes, contribution percentage/default currency, and founder workspaces exist. | Core onboarding, invitation, crypto route, draft payment, contribution, and attribution functions are active. | **Strongest shared-dev area.** Project setup and the older contribution workflow are materially available. |
| Monthly contribution and attribution submission | Typed contribution and attribution commands, review events, cycle linkage, project package workflows, and operator review surfaces exist. | Older contribution and attribution functions are active; settlement-backed project-package workflow is absent. | **Partial.** Declared monthly data can flow; a reconciled “data plus settled funds” package cannot complete on shared dev. |
| Settlement-backed multi-rail funding | Code includes Base v2 intake, Stripe bank transfer, Canadian PAD, EUR/GBP Pay by Bank, external-event reconciliation, fee/FX prep, and custody-aware source lots. | All newer intake/reconciliation functions are absent. The remote deploy stopped before their migrations. | **Local-only.** Base USDC is local-real; bank transfer is provider-pending; PAD and Pay by Bank are local-real with hosted capability gates. |
| Monthly lock, calculation, verification, and approval | Both the legacy MVP calculator and newer funded redistribution path exist, with deterministic artifacts, integrity checks, shadow stages, close packages, and operator review. | Legacy lock/calculation/verification/approval functions are active. New shadow scheduler, funded allocation, financial prep, and allocation close functions are absent. | **Two generations coexist.** The old promise-derived cycle can run; the settlement-backed target cannot run remotely. |
| Uniqueness-weighted distribution | The funded calculator consumes locked CUBID uniqueness scores within settled source cohorts; legacy capped equalization remains in code for transitional cycles. | Required new epoch functions are absent. | **Implemented and tested locally, not usable on shared dev.** Product copy and reports must name which model produced a result. |
| User earnings, three-month retroactive claims, and partial withdrawal | Earnings workspace, asset preferences, project-scoped withdrawal requests, exact inventory reservation, partial requests, fee conservation, queueing, and expiry/carryover contracts exist. | Core asset-preference and initial withdrawal-request functions are active, but the newer obligation control plane and `withdrawal-operator` are absent. | **Not end-to-end on shared dev.** A user cannot rely on the target three-month claim and payout lifecycle there. |
| Actual payouts | Base Safe control plane and Stripe Connect payout orchestration/reconciliation exist with local/sandbox tests. | Base Safe, Stripe Connect account/payout/webhook, and withdrawal-operator functions are absent. | **Not available on shared dev.** Stripe Connect is sandbox-real; Base USDC is local-real; production activation remains prohibited. |
| Transparent reporting | Public/user/founder/operator report routes, report metadata, audience scoping, artifact conventions, and MCP coverage reads exist. Funded close privacy thresholds are tested. | Older report tables may support read surfaces, but no current report-generation/publication command was verified remotely. | **Read-model scaffold, not a complete reporting system.** Automatic generation, publication, retention, and polished explanatory reports remain gaps. |
| Privacy and opt-in public visibility | Explicit policy acknowledgement, publication consent, RLS/read boundaries, redacted MCP shapes, and privacy tests exist. | Policy and profile-publication functions are active. | **Good foundation.** Requires hosted role-specific verification and retention/legal approval before production claims. |
| Operator control plane | Admin workspaces cover cycles, identity, payments, reconciliation, settlement packages, observability, verification, reporting, and payout review. | Older cycle/payment operations are active; the new 12-stage epoch and payout functions are absent. | **Broad UI, split backend.** Operators can inspect more than they can safely execute on shared dev. |
| MCP parity | Stdio and Edge MCP servers expose typed user, founder, project-member, and operator reads plus allowlisted founder writes, resources, and prompts. | `mcp` and `mcp-workflow-read` are active, but new financial commands they would call are absent. | **Real but bounded.** Read-oriented agent workflows are credible; the full monthly economy is not agent-operable remotely. |
| Double-entry accounting and financial cutover | Neutral ledger, append-only reversals, shadow financial events/journals, opening-balance cutover, and local control tests exist. Production posting policy remains disabled by design. | Deployment is blocked at the first neutral-ledger migration. | **Not on shared dev.** This is the immediate infrastructure blocker and still requires professional accounting/legal approval for production policy. |

## What can be demonstrated honestly today

Against a clean local Supabase environment, the repo can demonstrate a multi-persona monthly workflow with deterministic fixtures: onboarding and consent, project invitations, CUBID remediation, project package review, funded allocation, partial withdrawal reservation, Base USDC intake/Safe payout controls, Stripe Connect sandbox payout controls, and operator stage review. The evidence is strong for software behavior under those bounded conditions.

On the shared Supabase Dev environment, the honest demo boundary is narrower: onboarding, project/member setup, CUBID sync, contribution and attribution submission, legacy monthly-cycle operations, publication choice, and MCP read workflows. The settlement-backed epoch, newer rails, actual payout execution, neutral ledger, and cutover must not be presented as working there.

## Highest-priority gaps

1. **Repair and replay the Supabase Dev deployment.** Fix the prepared-statement migration failure, prove migration history and schema convergence, deploy the missing current functions, and remove or explicitly quarantine retired remote functions.
2. **Run hosted role-specific acceptance.** Exercise one founder, one verified user, and one operator against the same Preview/Supabase Dev pair. Include privacy-negative checks and no-value/sandbox-only guardrails.
3. **Close reporting as a product capability.** Add deterministic generation and publication commands, audience-specific explanations, retention rules, and hosted verification. A metadata table and empty report hub are not transparency.
4. **Prove the three-month claim lifecycle end to end.** Verify open-month eligibility, oldest-first consumption, partial claims, expiry, rollover provenance, destination readiness, and operator reconciliation in the shared dev environment.
5. **Resolve provider reality.** Confirm exact Stripe account/currency capabilities and reviewed Base token addresses. Keep unsupported rails visibly pending or stubbed.
6. **Complete governance before production value.** Obtain legal, accounting, tax, privacy/retention, sanctions/KYC/KYB, unclaimed-property, and custody conclusions; then authorize a separate production activation and rollback plan.

## Review rule going forward

Every capability statement should name its environment and evidence class: `in code`, `local-real`, `sandbox-real`, `on Supabase Dev`, `hosted-verified`, or `production-enabled`. Passing application CI, a generated artifact, or an active Edge Function is narrower evidence than a completed role-specific economic workflow.
