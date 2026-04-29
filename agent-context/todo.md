# FundLoop TODO

This file is the current execution roadmap for bringing FundLoop from the present semi-finished app shell to the target operational architecture described in `docs/engineering/current-state-architecture.md`, `docs/engineering/target-state-architecture.md`, and `docs/engineering/backgrounder-for-agents.md`.

Each item below is intentionally sized to one agentic coding session. The sequence matters. Later work should assume the earlier sessions are complete unless the backlog is deliberately re-planned.

## Execution Rules
- Always build on feature branches.
- When starting a task: update the status to "started", set the branch and timestamp started. Reference `docs/engineering/backgrounder-for-agents.md`, `docs/engineering/current-state-architecture.md`, and `docs/engineering/target-state-architecture.md` before starting to build.
- While building: Make underway commits if needed, always with an accompanying session-log entry. Build unit tests and smoke tests for new features as needed. Smoke test before reporting complete. Do not write in this doc what you actually did, instead write that in the session-log.
- At the end of each task: update relevant long-lived engineering docs in `docs/engineering/` whenever architecture, route decisions, workflows, or operating assumptions changed.
- If a todo needs to be split, or if any spillover actions were not completed, then remove those words from your todo and instead create new minor todo at the right place in the document, for example a new `12.1` immediately after todo 12.
- Once completed, set status to complete, update timestamp completed, ensure all relevant session logs are referenced. 

## Session 01: Replace the old backlog with a release-oriented execution map

- Status: Complete
- Timestamp started: 2026-04-14T21:54:22Z
- Timestamp completed: 2026-04-14T21:54:22Z
- Feature branch: codex/wallet-production-readiness
- Head: 0f81f15
- Session-log reference(s): session v34

Turn the architecture docs into a repo-grounded execution plan that the next several agents can follow without re-deriving priorities. This session should tighten `agent-context/` itself: normalize naming, cross-link the backgrounder/current-state/target-state docs, and add a short “how to use this backlog” note for future contributors. The goal is not product code yet. The goal is to make the repo operationally legible so subsequent sessions can work in sequence instead of starting from scratch every time.

## Session 02: Inventory every incomplete, stubbed, or placeholder route

- Status: Complete
- Timestamp started: 2026-04-14T21:55:18Z
- Timestamp completed: 2026-04-14T21:55:18Z
- Feature branch: codex/wallet-production-readiness
- Head: 889ab9d
- Session-log reference(s): session v35

Review the route tree and current UI to identify all pages that are unfinished, misleading, redundant, or only half-wired. Produce a route inventory with one disposition per page: finish, merge, redirect, or remove. This should include public pages, settings pages, admin pages, and any thin placeholders that still reflect an earlier website-first mindset. The output should drive the product information architecture so later UX sessions are completing real surfaces rather than polishing pages that should disappear.

## Session 03: Define the target information architecture for users, founders, and operators

- Status: Complete
- Timestamp started: 2026-04-14T21:57:19Z
- Timestamp completed: 2026-04-14T21:57:19Z
- Feature branch: codex/wallet-production-readiness
- Head: 9f88663
- Session-log reference(s): session v36

Restructure the app map around the three real personas: regular users, founders/project members, and internal operators. This session should decide the long-term navigation model, top-level route groupings, dashboard entry points, and what belongs under settings versus workspaces. The result should be a stable information architecture document plus initial route-level TODO annotations in the code. It should also identify which current pages remain public marketing content and which need to become production application surfaces.

## Session 04: Introduce a backend-contract layer for Supabase Edge Functions

- Status: Complete
- Timestamp started: 2026-04-14T23:28:41Z
- Timestamp completed: 2026-04-14T23:28:41Z
- Feature branch: codex/wallet-production-readiness
- Head: 56599f9a9eb72692bdbafaa2b3ddbc6b6ccbf558
- Session-log reference(s): session v38

Create the application-side foundation for the future read/write model. The web app should gain a consistent client for calling Supabase Edge Functions, typed request and response envelopes, shared auth/error handling, and a clear place to put function-specific adapters. Do not migrate all behavior yet. The goal is to remove the current ambiguity where writes happen in server actions and reads often happen straight from the browser. This session creates the transport contract every later migration will depend on.

## Session 05: Stand up the first real Edge Function domain boundary

- Status: Complete
- Timestamp started: 2026-04-14T23:36:10Z
- Timestamp completed: 2026-04-14T23:36:10Z
- Feature branch: codex/wallet-production-readiness
- Head: f2bd1b5f6d9876b48a579efb45d0f8f2eb8c38e2
- Session-log reference(s): session v39

Pick one narrow but meaningful domain, likely onboarding drafts or project payment draft creation, and implement the first production-style Supabase Edge Function with schema validation, auth checks, and a typed web adapter. This session proves the new backend pattern in a real workflow. It should include local development ergonomics, shared error shapes, and a small test harness. The goal is to establish a repeatable template so later sessions can migrate more domains without inventing a new style each time.

## Session 06: Add multilingual infrastructure to the app shell

- Status: Complete
- Timestamp started: 2026-04-14 19:58:00 EDT
- Timestamp completed: 2026-04-14 20:07:56 EDT
- Feature branch: codex/wallet-production-readiness
- Head: TBD
- Session-log reference(s): session v20

Introduce the core i18n architecture for Next.js App Router: locale routing strategy, translation file organization, server/client helpers, and a fallback policy. The initial target is infrastructure, not full translation coverage. Make sure layouts, navigation, metadata, and a small set of public surfaces can render from language packs. This session should explicitly avoid string-by-string ad hoc translation. It should produce a clean system the later UX and product sessions can expand across user, founder, and operator experiences.

## Session 07: Build a durable design token system for light and dark mode

- Status: Complete
- Timestamp started: 2026-04-14 20:47:18 EDT
- Timestamp completed: 2026-04-14 20:53:37 EDT
- Feature branch: codex/wallet-production-readiness
- Head: TBD
- Session-log reference(s): session v40

Refactor the current styling layer into a stable token-driven theme system with strong light/dark parity. This session should centralize color, typography, spacing, and state tokens in a way that supports both public marketing pages and dense operational screens. Audit the current surfaces for broken contrast, inconsistent backgrounds, and one-off styling drift. The goal is not a full redesign in one session. The goal is to create a visually coherent base so later “stunning but simple” UX work does not require re-theming every page twice.

## Session 08: Refactor shared navigation and layout around the new IA

- Status: Complete
- Timestamp started: 2026-04-14T21:58:00-0400
- Timestamp completed: 2026-04-14T22:10:57-0400
- Feature branch: codex/wallet-production-readiness
- Head: TBD
- Session-log reference(s): session v41

Update the app shell, navigation, account menus, and dashboard entry points to match the new information architecture. This should include clear paths for regular users, founders/project members, and internal operators, while keeping the public site lightweight and understandable. Remove or neutralize confusing dead ends and old route assumptions. This session should focus on skeleton and movement, not final page content. The outcome should be that users can tell where they are in the product and what the app is for before the remaining pages are fully rebuilt.

## Session 09: Rebuild the founder acquisition funnel and public founder pages

- Status: Complete
- Timestamp started: 2026-04-14T22:11:00-0400
- Timestamp completed: 2026-04-14T22:26:48-0400
- Feature branch: codex/wallet-production-readiness
- Head: TBD
- Session-log reference(s): session v42

Turn the current founder-facing public messaging into a real production funnel. The session should unify any scattered founder pitch surfaces into a clean path that explains revenue commitment, onboarding expectations, monthly cadence, identity requirements, and what founders can manage once inside. This is the point where “visually stunning” needs to show up in a focused way: excellent typography, strong hierarchy, clear calls to action, and no vague placeholder marketing copy. The output should hand off naturally into founder onboarding, not just a contact-page dead end.

## Session 10: Rebuild the user discovery and participation funnel

- Status: Complete
- Timestamp started: 2026-04-14T23:55:00-0400
- Timestamp completed: 2026-04-15T01:05:00-0400
- Feature branch: codex/wallet-production-readiness
- Head: TBD
- Session-log reference(s): session v43

Create the public and semi-public journey for regular users who want to understand FundLoop, discover projects, and see how participation turns into earnings. This should refine or replace current placeholder explainer surfaces with a path that leads toward sign-up, identity verification, project discovery, and earnings visibility. The design should stay simple and data-clear, not overly promotional. The key outcome is that the user side of the product becomes a first-class experience instead of feeling secondary to project payment operations.

## Session 11: Complete or retire all current stubbed public pages

- Status: Complete
- Timestamp started: 2026-04-15T00:00:00-0400
- Timestamp completed: 2026-04-15T00:16:00-0400
- Feature branch: codex/wallet-production-readiness
- Head: TBD
- Session-log reference(s): session v46

Use the route inventory from Session 02 to finish, merge, redirect, or remove the remaining placeholder public pages. This includes pages that are technically present but not product-complete, pages that duplicate narrative content, and pages that still reflect an early website draft instead of the operating product. The goal is to eliminate dead weight before deeper application work continues. By the end of this session, the public site should feel intentional and cohesive, even if some deeper authenticated flows are still under active development.

## Session 12: Move onboarding draft save and publish flows to Edge Functions

- Status: Complete
- Timestamp started: 2026-04-15T00:46:52-0400
- Timestamp completed: 2026-04-15T01:08:08-0400
- Feature branch: codex/wallet-production-readiness
- Head: TBD
- Session-log reference(s): session v47

Migrate resumable onboarding away from direct server-action orchestration and into Edge Function commands. This session should cover user onboarding drafts, project onboarding drafts, and the publish steps that materialize real records. Preserve resumability, validation, and authorization. The web app should call typed Edge Function adapters rather than writing directly through server actions. This is a key transition step because onboarding is one of the most application-like parts of the repo and sets the pattern for founder and user lifecycle management.

## Session 13: Reshape onboarding around CUBID-first identity requirements

- Status: Complete
- Timestamp started: 2026-04-15T08:20:00-0400
- Timestamp completed: 2026-04-15T08:57:52-0400
- Feature branch: codex/wallet-production-readiness
- Head: TBD
- Session-log reference(s): session v48

Update onboarding so proof-of-personhood and KYC are no longer abstract concepts in the UX. The flow should clearly require a CUBID.me account and establish the first direct API-backed identity resolution path without pulling in the full SDK. This session should add the right intermediate states and persistence hooks so the product can distinguish “signed in,” “CUBID linked,” and “identity verified,” then enforce linkage before user or project publish. The goal is to make the UI and workflow architecture identity-first instead of bolting KYC on at the end.

## Session 14: Add the CUBID account-linking and identity snapshot model

- Status: Complete
- Timestamp started: 2026-04-15T13:55:00-0400
- Timestamp completed: 2026-04-15T14:49:45-0400
- Feature branch: codex/wallet-production-readiness
- Head: TBD
- Session-log reference(s): session v49

Introduce the database and application model that links a FundLoop user to a CUBID identity. This should include a canonical external identity reference, a synchronized identity snapshot, verification state, sync timestamps, and room for future monthly locking of identity state. Do not over-model every possible CUBID field yet. The focus is creating the right durable contract so the app can consume CUBID as the source of socials, phone, email, and personhood status without making the local profile tables the real authority.

## Session 15: Implement the first real CUBID Edge Function integration

- Status: Complete
- Timestamp started: 2026-04-15T15:00:00-0400
- Timestamp completed: 2026-04-15T15:22:50-0400
- Feature branch: codex/wallet-production-readiness
- Head: TBD
- Session-log reference(s): session v50

Build the backend integration that talks to CUBID.me, fetches the current account data, validates the response, and stores a normalized snapshot in FundLoop. The function should be safe, explicit, and auditable. It should not blindly mirror arbitrary payloads into the database. This session should also define failure semantics and operator visibility for identity sync issues. The result should be the first real external-system dependency in the target architecture, implemented in a way that later monthly cycle locking and payout eligibility can trust.

## Session 16: Refactor user profile and account views around CUBID-backed identity

- Status: Complete
- Timestamp started: 2026-04-15T15:00:00-0400
- Timestamp completed: 2026-04-15T15:22:50-0400
- Feature branch: codex/wallet-production-readiness
- Head: TBD
- Session-log reference(s): session v50

Update profile and account surfaces so they stop behaving like FundLoop is the canonical editor of identity details. The UI should show which fields come from CUBID, which are local preferences, and what the current verification state is. If some current profile fields should remain local, make that distinction explicit. This session should simplify the mental model for users and reduce duplicate identity entry. It should also prepare the product for payout and eligibility surfaces that depend on proof-of-personhood rather than ad hoc local profile completeness.

## Session 17: Create a real regular-user workspace home

- Status: Complete
- Timestamp started: 2026-04-20T03:20:34-04:00
- Timestamp completed: 2026-04-20T03:24:45-04:00
- Feature branch: codex/session-17-user-workspace
- Head: 13c9fa3
- Session-log reference(s): session v60

Build a coherent signed-in home for users. It should combine identity status, project discovery, participation context, and earnings visibility into one clear workspace instead of scattering that experience across unrelated pages. This is not the full payout product yet, but it should establish the long-term structure: current status, next actions, participation opportunities, and money-related visibility. The session should prioritize clarity and reduction of friction so regular users can understand where they stand in the system without reading multiple explainer pages.

## Session 18: Create a real founder and project workspace home

- Status: Complete
- Timestamp started: 2026-04-20T13:45:09-04:00
- Timestamp completed: 2026-04-20T13:53:17-04:00
- Feature branch: codex/session-18-founder-workspace
- Head: 0e9890c
- Session-log reference(s): session v63, session v64, session v65

Build the founder-facing home that ties together project setup, payment obligations, routes, team management, and growth reporting. Today those capabilities are spread across onboarding remnants, settings fragments, and payment-specific screens. This session should unify them into a stable project workspace entry point. The goal is to make the founder side of FundLoop feel like an operational tool, not a collection of special-case pages. This will become the main jumping-off point for later contribution cadence, attribution submission, and reporting work.

## Session 19: Move project payment and route write paths to Edge Functions

- Status: Complete
- Timestamp started: 2026-04-20T17:17:29-04:00
- Timestamp completed: 2026-04-20T17:27:41-04:00
- Feature branch: codex/session-19-payment-edge-functions
- Head: pending final commit
- Session-log reference(s): session v66

Migrate the current payment command layer out of `app/actions/project-payment-actions.ts` and into Edge Functions, starting with payment draft creation, route create/update/reorder/disable, and receipt recording. Keep the existing UI intact where possible, but change its backend contract. This session should start decomposing the current hotspot without requiring a huge UI rewrite. The outcome should be a cleaner boundary: the web app invokes typed backend commands, and the payment domain is no longer anchored primarily in one giant server-action file.

## Session 20: Move admin payment and reconciliation commands to Edge Functions

- Status: Complete
- Timestamp started: 2026-04-26T18:11:00-04:00
- Timestamp completed: 2026-04-26T18:17:29-04:00
- Feature branch: codex/session-20-admin-edge-functions
- Head: pending final commit
- Session-log reference(s): session v82

Continue the backend migration by moving internal admin payment actions behind Edge Functions as well. This includes reconciliation replay, manual non-onchain confirmation, and later monthly-cycle operator commands. The main benefit is consistency: the same backend contract pattern should apply to project and internal workflows. This session should also establish stronger internal operator request logging, since these commands affect money and workflow state. By the end, the app should be materially closer to the target rule that all writes go through Supabase Edge Functions.

## Session 21: Introduce a first-class monthly cycle domain model

- Status: Complete
- Timestamp started: 2026-04-27T20:04:59-0400
- Timestamp completed: 2026-04-27T20:13:22-0400
- Feature branch: codex/session-21-monthly-cycles
- Head: pending final commit
- Session-log reference(s): session v93

Add the core schema and application model for monthly economic cycles. Today month-based behavior is implicit across payments, reconciliation, and zkAS logic. This session should create explicit cycle records with lifecycle states, timestamps, and references to locked inputs and outputs. The goal is to stop treating “the current month” as a loose concept and instead introduce a real operational object that later steps can build on for locking, prep, calculation, verification, payout, and reporting.

## Session 22: Build the end-of-month lock workflow

- Status: Complete
- Timestamp started: 2026-04-28T04:39:34-0400
- Timestamp completed: 2026-04-28T04:42:45-0400
- Feature branch: codex/session-22-monthly-cycle-lock
- Head: pending final commit
- Session-log reference(s): session v95

Implement the first monthly cycle command: lock the cycle. This should freeze the eligible contribution inputs, identity snapshot references, and relevant payment/reconciliation state needed for deterministic downstream computation. The lock step should be explicit, repeat-safe, and auditable. This is where the product starts to become a true monthly coordination engine rather than just a payment collection app. The output of this session should be that operators can close a month intentionally instead of relying on a shifting combination of live rows and mental bookkeeping.

## Session 23: Build the cycle prep and exception review workspace

- Status: Complete
- Timestamp started: 2026-04-29T12:52:10-0400
- Timestamp completed: 2026-04-29T12:58:12-0400
- Feature branch: codex/session-23-cycle-prep-review
- Head: pending final commit
- Session-log reference(s): session v97

After lock comes prep. Create the operator-facing prep surface that validates whether a cycle is ready for calculation. It should surface missing project submissions, identity sync problems, reconciliation gaps, and other exceptions that would make the month unsafe to compute. This session should focus on exception visibility and operational triage, not on final distribution math yet. The system needs a clear “ready / blocked / needs review” posture before any zk or payout work can be trusted.

## Session 24: Refactor zkAS around the monthly cycle contract

- Status: Complete
- Timestamp started: 2026-04-29T13:14:00-0400
- Timestamp completed: 2026-04-29T13:22:19-0400
- Feature branch: codex/session-23-cycle-prep-review
- Head: pending final commit
- Session-log reference(s): session v98

Bring the current zkAS subsystem into alignment with the explicit monthly cycle model. Instead of feeling like a parallel control plane, its datasets, run manifests, and publication outputs should anchor to a cycle record and a stable preparation state. This session should reduce conceptual duplication between payment operations and zk operations. The result should make it obvious that zkAS is one stage of the monthly cadence, not a separate product hidden inside the repo.

## Session 25: Build the deterministic calculation package and artifact flow

- Status: Complete
- Timestamp started: 2026-04-29T13:51:56-0400
- Timestamp completed: 2026-04-29T13:54:51-0400
- Feature branch: codex/session-23-cycle-prep-review
- Head: pending final commit
- Session-log reference(s): session v99

Create the cycle calculation packaging step that produces deterministic inputs, manifests, and stored artifacts for zk-calculation or its equivalent. This session should emphasize replayability and auditability: same locked cycle inputs should always yield the same packaged calculation input set. Use Supabase Storage intentionally for these artifacts. This becomes the contract between operational prep and the computation stage, and it is critical for future verification, publication, and agent-driven audit retrieval.

## Session 26: Add cleanup, verification, and approval stages for calculated results

- Status: Complete
- Timestamp started: 2026-04-29T13:58:38-0400
- Timestamp completed: 2026-04-29T14:05:47-0400
- Feature branch: codex/session-23-cycle-prep-review
- Head: pending final commit
- Session-log reference(s): session v100

Build the post-calculation review phase where operators verify totals, compare expected versus actual outputs, resolve cleanup issues, and approve a cycle for distribution. This should include structured statuses, review notes, and explicit approval actions. Avoid a hidden “looks good, ship it” pattern. The system needs durable operator intent and a clear checkpoint before money moves outward. This session is where the monthly cadence starts feeling complete enough to trust with production bookkeeping.

## Session 27: Create the outbound payout domain model

- Status: Complete
- Timestamp started: 2026-04-29T14:07:04-0400
- Timestamp completed: 2026-04-29T15:27:56-0400
- Feature branch: codex/session-23-cycle-prep-review
- Head: pending final commit
- Session-log reference(s): session v101

Introduce payout intents, payout batches, payout route preferences, lifecycle states, and reconciliation placeholders. Even if execution is still partially stubbed, this domain needs to exist independently of payments collected from founders. This session lays the foundation for user earnings management and future rail adapters. It should also establish how monthly approved distribution results become concrete payout work items rather than staying as abstract calculation outputs.

## Session 28: Build the chain-abstracted execution interface

- Status: Not started
- Timestamp started: TBD
- Timestamp completed: TBD
- Feature branch: TBD
- Head: TBD
- Session-log reference(s): TBD

Create the stable execution boundary that later EVM, Solana, and fiat adapters will implement. It should cover deposit intent creation, deposit verification, payout batch creation, payout execution, and payout reconciliation. Keep the interface FundLoop-centric rather than chain-centric. This is a key target-state move because it prevents chain logic from leaking into pages and workflow code. The output should be backend-facing TypeScript contracts and the first set of adapter scaffolds, not a fully finished multi-chain implementation.

## Session 29: Refactor the existing EVM inbound flow behind the new execution interface

- Status: Not started
- Timestamp started: TBD
- Timestamp completed: TBD
- Feature branch: TBD
- Head: TBD
- Session-log reference(s): TBD

Take the current EVM-based intake and reconciliation flow and move it behind the newly created chain abstraction. The web app and cycle workflows should talk to the abstract interface, while the EVM adapter preserves the current functionality. This session should reduce direct coupling to viem-specific logic in product code and prepare the system to add Solana without cloning the entire payment subsystem. It is an architectural cleanup session that protects the multi-rail future from becoming a second copy of the current EVM path.

## Session 30: Add the Solana inbound contribution adapter

- Status: Not started
- Timestamp started: TBD
- Timestamp completed: TBD
- Feature branch: TBD
- Head: TBD
- Session-log reference(s): TBD

Implement the first Solana contribution adapter behind the shared execution interface. Keep the first pass narrow: route representation, intent creation, receipt verification scaffolding, and storage model alignment with the existing inbound payment lifecycle. The goal is not to ship every Solana edge case at once. The goal is to prove the architecture can support a second chain family without contorting the app or schema. This session should also surface any abstractions that were still secretly EVM-shaped and fix them while the scope is still controlled.

## Session 31: Add Solana payout adapter scaffolding

- Status: Not started
- Timestamp started: TBD
- Timestamp completed: TBD
- Feature branch: TBD
- Head: TBD
- Session-log reference(s): TBD

Extend the payout side of the execution layer to support Solana as well. This should mirror the inbound multi-chain work but focus on batch payout intent modeling, execution hooks, and status reconciliation. Even if the first version is not fully production-live, the architecture should show that outbound distribution is not locked to EVM assumptions. This session is primarily about finishing the multi-chain shape so later user earnings and operator payout workflows can treat EVM and Solana as peers.

## Session 32: Add fiat inbound and outbound stubs behind the same abstraction

- Status: Not started
- Timestamp started: TBD
- Timestamp completed: TBD
- Feature branch: TBD
- Head: TBD
- Session-log reference(s): TBD

Introduce intentionally stubbed fiat adapters for inbound project funding and outbound user payouts. The product should be able to present fiat rails as planned, controlled options without implying they are already fully live. This session should define the right contracts, placeholder statuses, and UI affordances so the rest of the product can be multi-rail even before a real fiat provider is chosen. The value here is architectural completeness and future readiness, not pretending fiat is done.

## Session 33: Build the founder monthly contributions workflow

- Status: Not started
- Timestamp started: TBD
- Timestamp completed: TBD
- Feature branch: TBD
- Head: TBD
- Session-log reference(s): TBD

Create the founder-facing monthly flow that ties obligations, route selection, submission, verification, and reporting together under the monthly cycle model. This should evolve the current payments page into a cleaner founder operation rather than a mixed draft table plus crypto-specific utility screen. The goal is to make the economic cadence understandable and repeatable for project teams. By the end of this session, founders should have a coherent monthly contribution experience instead of a powerful but semi-internal-feeling payment tool.

## Session 34: Build the project attribution and contribution-data submission workflow

- Status: Not started
- Timestamp started: TBD
- Timestamp completed: TBD
- Feature branch: TBD
- Head: TBD
- Session-log reference(s): TBD

Add the founder/project-member tools for submitting participation and attribution data that feeds the monthly calculation. This is essential because FundLoop is not just collecting money; it is coordinating money with contribution data. This session should create explicit founder workflows, validations, and storage for that data, with auditability and replay in mind. It should also align with the MCP future by favoring structured, automatable payloads over UI-only forms that hide the real shape of the submission.

## Session 35: Build the user earnings and payout workspace

- Status: Not started
- Timestamp started: TBD
- Timestamp completed: TBD
- Feature branch: TBD
- Head: TBD
- Session-log reference(s): TBD

Turn the user side into a real money-management experience. Add views for pending distributions, locked monthly results, payout history, payout route preferences, and payout execution status. This session should connect the monthly cycle outputs to the user-facing experience in a way that is transparent and trust-building. Users should be able to understand what they are owed, why, and what stage their payout is in. This is where FundLoop starts looking like a real citizen-salary product instead of only a founder contribution product.

## Session 36: Build reporting publication for users, founders, and operators

- Status: Not started
- Timestamp started: TBD
- Timestamp completed: TBD
- Feature branch: TBD
- Head: TBD
- Session-log reference(s): TBD

Create the reporting layer that publishes the results of each monthly cycle in role-appropriate forms. Users need payout explanations, founders need contribution and growth reporting, and operators need complete audit and exception views. This session should use Supabase Storage for generated artifacts and create stable read models for web and agents. The goal is not decorative analytics. It is transparent reporting that explains the loop and proves the system is working.

## Session 37: Extend observability from payment flows to the whole monthly pipeline

- Status: Not started
- Timestamp started: TBD
- Timestamp completed: TBD
- Feature branch: TBD
- Head: TBD
- Session-log reference(s): TBD

The repo already has payment-flow observability. Expand that into a broader operational telemetry layer for cycle lock, prep, calculation packaging, verification, payout creation, payout execution, and publication failures. This session should keep the same internal DB-backed philosophy while broadening coverage to the monthly engine. The result should be that operators can inspect a full cycle end to end, not just wallet and payment events. This is important before adding more automation and agent-driven workflows.

## Session 38: Build the first MCP server skeleton

- Status: Not started
- Timestamp started: TBD
- Timestamp completed: TBD
- Feature branch: TBD
- Head: TBD
- Session-log reference(s): TBD

Create the MCP server foundation with authentication strategy, tool registration, typed request/response envelopes, and a backend adapter layer that calls the same Edge Function contracts as the web app. The server does not need every tool immediately. This session should focus on the protocol foundation and local development ergonomics so later agent workflows can build cleanly. The key architectural rule is that MCP should not invent a second backend or special-case business logic.

## Session 39: Add founder MCP workflows

- Status: Not started
- Timestamp started: TBD
- Timestamp completed: TBD
- Feature branch: TBD
- Head: TBD
- Session-log reference(s): TBD

Expose the first founder-facing protocol operations through the MCP server. This should include reading project obligation state, route state, monthly cycle status, and creating or updating the operational records founders actually need to manage their project. Keep the toolset intentionally small but real. The goal is to prove that an agent can participate meaningfully in FundLoop’s project workflows without depending on the UI. This session is central to the “agents are first-class users” principle in the backgrounder.

## Session 40: Add project-member and operator MCP workflows

- Status: Not started
- Timestamp started: TBD
- Timestamp completed: TBD
- Feature branch: TBD
- Head: TBD
- Session-log reference(s): TBD

Expand the MCP layer to support project-member tasks and selected operator-safe reads such as cycle status, reporting access, reconciliation visibility, and observability lookup. This session should maintain strict role boundaries while proving that FundLoop’s operational model is programmatically accessible. Avoid exposing unsafe internal mutation tools too early. The emphasis is on trustworthy structured interaction, not maximum surface area. By the end, the MCP server should feel like a real control interface rather than a demo plugin.

## Session 41: Move remaining high-value reads behind Edge Functions

- Status: Not started
- Timestamp started: TBD
- Timestamp completed: TBD
- Feature branch: TBD
- Head: TBD
- Session-log reference(s): TBD

Finish the architectural shift by moving the remaining important web reads away from direct browser/table access and behind stable backend contracts. Prioritize founder workspace reads, user earnings reads, cycle status reads, and admin/operator dashboards. This session should reduce the remaining tight coupling between pages and raw Supabase tables. It is a key target-state milestone because the app and MCP server both need stable read models, not a growing set of page-specific queries and implicit authorization assumptions.

## Session 42: Finish the settings and account IA cleanup

- Status: Not started
- Timestamp started: TBD
- Timestamp completed: TBD
- Feature branch: TBD
- Head: TBD
- Session-log reference(s): TBD

By this point the major product surfaces should exist. Use this session to remove the remaining awkward settings leftovers, merge duplicated pages, and ensure every account or configuration action lives in the right place. The goal is a simple, clean UX where users and founders do not need to hunt across “settings,” “project,” and “admin” for related capabilities. This session is mostly IA and interaction cleanup, but it will likely involve real route and component changes to eliminate the last structural confusion.

## Session 43: Productionize Supabase Storage usage across artifacts and media

- Status: Not started
- Timestamp started: TBD
- Timestamp completed: TBD
- Feature branch: TBD
- Head: TBD
- Session-log reference(s): TBD

Audit all file and artifact handling and move the product to a consistent Supabase Storage model. This includes project assets, onboarding uploads, reporting artifacts, zk inputs/outputs, exported bookkeeping files, and any proof attachments needed for audit. The important outcome is consistency: files should have lifecycle, ownership, naming, and retention rules instead of being scattered across ad hoc storage logic. This session should also ensure that the web app, Edge Functions, and MCP workflows can all refer to stored artifacts predictably.

## Session 44: Build a deployment and operations runbook into the product and repo

- Status: Not started
- Timestamp started: TBD
- Timestamp completed: TBD
- Feature branch: TBD
- Head: TBD
- Session-log reference(s): TBD

Translate the architecture into operational reliability. This session should produce and wire the runbooks, admin affordances, and environment expectations needed to operate the system: cycle operations, chain deployment syncs, identity sync troubleshooting, payout incident handling, and release health checks. Some of this belongs in docs, but some belongs in the operator UI itself. The goal is to make FundLoop operable by a small team without hidden tribal knowledge. This is a prerequisite for calling the product truly out of mothballs.

## Session 45: Do the final UX polish and conversion pass across user and founder journeys

- Status: Not started
- Timestamp started: TBD
- Timestamp completed: TBD
- Feature branch: TBD
- Head: TBD
- Session-log reference(s): TBD

After the heavy architecture and workflow work is in place, do the intentional finish pass. This session should refine copy, empty states, motion, visual hierarchy, multilingual edge cases, and the most important conversion points for both users and founders. It should also tighten the balance between “visually stunning” and “simple, clean UX.” The goal is not random polish. It is aligning the product’s presentation with the fact that the underlying system is now real, operational, and trustworthy.
