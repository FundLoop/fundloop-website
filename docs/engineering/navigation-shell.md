# Navigation and Shell Architecture

Session 08 split the localized App Router tree into two shell families:

- `app/[locale]/(public)`
- `app/[locale]/(app)`

The URL structure stays the same because route-group names are not part of the pathname. The split is architectural:

- the **public shell** keeps the marketing navigation and footer
- the **app shell** is the authenticated product frame for user, founder, and operator work

## Navigation Context

Shared shell behavior now runs through `lib/navigation-context.ts`.

`getNavigationContext()` is the single source for:

- authenticated user summary
- onboarding status via `users.status`
- `hasWorkspaceAccess`
- `hasFounderAccess`
- `hasAdminAccess`
- `managedProjects`

The helper intentionally uses only existing repo truth:

- SSR auth user from `createServerSupabaseClient()`
- founder/project access from `participants.is_admin`
- org-admin founder access from `organization_members` using the existing `Founder` and `Admin` role names
- internal operator access from the existing internal-admin email allowlist helper

Session 08 did **not** add a new role system.

## Shell Responsibilities

### Public shell

The public shell lives in `app/[locale]/(public)/layout.tsx` and is responsible for:

- top-level public navigation
- the public footer
- exposing quick authenticated shortcuts back into product workspaces when a session exists

Primary public navigation is now:

- `/founders`
- `/participation`
- `/projects`
- `/documentation`
- `/blog`
- `/support`

Session 09 completed the public founder acquisition path under `/[locale]/founders`.

- `/[locale]/founders` is now the canonical founder funnel
- `/[locale]/pledge` permanently redirects to `/[locale]/founders#commitment`
- `/[locale]/pricing` permanently redirects to `/[locale]/founders#support-model`

Shared public shell links should point founders to `/founders` first. The direct conversion into the existing project onboarding modal remains an explicit call to action inside the founder funnel itself.

Session 10 completed the parallel public user acquisition and discovery path.

- `/[locale]/participation` is now the canonical public user funnel
- `/[locale]/projects` and `/[locale]/users` are server-rendered public discovery surfaces, not browser-fetched utility directories
- `/[locale]/projects/[slug]` and `/[locale]/users/[id]` are public profile/detail surfaces designed to feed participation and workspace handoff
- generic public user CTAs still use `/?onboarding=user`
- `/[locale]/join` remains invite-aware only and is not the generic signup route
- when a session exists, public user CTAs are role-aware:
  - signed-out users: `/?onboarding=user`
  - signed-in inactive users: continue onboarding
  - signed-in active users: `/workspace`
- the truthful “earnings/results” destinations now live under `/[locale]/workspace/earnings` and `/[locale]/workspace/reporting`; `/settings/zkas` is redirect-only

Session 11 completed the remaining public-route consolidation pass.

- `/[locale]/about` now permanently redirects to `/[locale]/documentation#about-fundloop`
- `/[locale]/api` now permanently redirects to `/[locale]/documentation#protocol-and-integrations`
- `/[locale]/analytics` now permanently redirects to `/[locale]/reports`
- `/[locale]/invitations/[token]` now redirects into the real invite-aware join flow using `/[locale]/join?invite=...`
- `/[locale]/documentation` is now the canonical public docs hub for product overview, integration direction, and support articles
- `/[locale]/reports` is now the truthful public transparency/reporting entry surface
- `/[locale]/blog`, `/[locale]/blog/[slug]`, `/[locale]/ecosystem`, `/[locale]/faq`, and the legal pages now use the current public shell instead of the older pre-i18n page style

### App shell

The app shell lives in `app/[locale]/(app)/layout.tsx` and:

- requires an authenticated session
- redirects unauthenticated access to `/${locale}/join`
- renders the product-style top bar and contextual subnav

Current app-shell primary sections are:

- `/workspace`
- `/founder` when founder access exists
- `/admin` when internal-admin access exists

Current contextual subnav rules are path-based:

- `/workspace`, `/settings`, and legacy user entry routes map to the user workspace section
- `/founder`, `/projects/*`, and legacy founder/mock organization routes map to the founder section
- `/admin/*` maps to the operator section

Session 13 made identity state a first-class part of the authenticated shell.

- `getNavigationContext()` now carries:
  - `cubidIdentityStatus`
  - `cubidId`
  - `primaryEmailIdentity`
  - `cubidScore`
- `/[locale]/workspace` now surfaces a lightweight identity-status card that tells the user whether FundLoop only has their app session, has a linked CUBID identity, or has a stronger verified state available
- `/[locale]/workspace/account` now includes a dedicated identity panel that points users to `passport.cubid.me` as the source-of-truth identity authority
- user and project onboarding now begin with an explicit CUBID prerequisite step, and both publish paths require a linked identity before completion

Session 17 turned `/[locale]/workspace` into the real regular-user workspace home.

- `/[locale]/workspace` now summarizes identity readiness, hybrid profile completion, participation footprint, project discovery, and current published zkAS result visibility.
- `/[locale]/workspace/earnings` is now the user money workspace for credited-but-not-paid MVP earnings. Issue #83 makes `monthly_cycle_bookkeeping_credits` the primary user-visible earnings source, with published results, payout intents, payout route readiness, batch status, and reconciliation cues retained as future-settlement context.
- `/[locale]/workspace/reporting` is the Session 36 user reporting workspace for monthly explanations and stored report artifacts.
- Session 42 redirects the legacy raw personal result history from `/[locale]/settings/zkas` to `/[locale]/workspace/reporting`; settings is no longer the mental model for result or earnings visibility.
- Workspace data is read server-side and should degrade to safe empty/warning states rather than crashing the signed-in home when one non-critical read fails.

Session 18 turned the founder entry routes into operational workspace homes.

- `/[locale]/founder` now summarizes managed project count, setup readiness, payment/contribution status, attribution readiness, founder identity reminders, and next actions.
- `/[locale]/founder/projects` is now the canonical founder project index with setup, payment, attribution, and team badges for each managed project.
- `/[locale]/founder/projects/[slug]` is the first thin per-project founder home and only resolves slugs already present in `getNavigationContext().managedProjects`.
- `/[locale]/founder/projects/[slug]/contributions` is the founder-facing monthly contribution workflow. It groups existing payment obligations by economic month, shows setup/payment-route/attribution readiness, and links into the current payment and zkAS operation routes.
- `/[locale]/founder/projects/[slug]/attribution` is the founder-facing contribution-data workflow. It exposes the structured zkAS dataset contract, recent validation/approval state, and links into the current dataset upload/detail routes.
- `/[locale]/founder/projects/[slug]/reporting` is the founder-facing monthly reporting workspace for project summaries and stored report artifacts.
- Existing deep operation routes remain in place for now: contribution/payment work stays at `/[locale]/projects/[slug]/payments`, and project zkAS work stays at `/[locale]/projects/[slug]/zkas`.
- `/[locale]/organizations/[id]` now redirects to `/[locale]/founder/projects` instead of rendering the old mock organization detail surface.

Session 19 hardened the payment operation path without moving URLs.

- Founder route-management writes and onchain receipt recording now go through Supabase Edge Function commands.
- Payment-route reads, payment table reads, and latest-submission reads still temporarily load from the existing app-side read path.
- `/[locale]/projects/[slug]/payments` remains the active deep operation route until the later monthly contribution workspace sessions relocate or redesign it.

Session 21 added the first-class monthly cycle operator surface.

- `/[locale]/admin/cycles` is now the operator overview for economic month records and exposes the audited lock action for open cycles.
- `/[locale]/admin/cycles/[cycleKey]/prep` is the read-only prep and exception review workspace for locked manifests.
- `/[locale]/admin/cycles/[cycleKey]/zkas` is the cycle-anchored zkAS stage view for linked datasets, identity artifacts, runs, and published outputs.
- `/[locale]/admin/cycles/[cycleKey]/verification` is the result cleanup, verification, and approval workspace for calculated outputs.
- `/[locale]/admin/cycles/[cycleKey]/payouts` is the outbound payout domain view for turning approved user results into payout intents.
- `/[locale]/admin/cycles/[cycleKey]/reporting` is the operator reporting publication view for role-specific report coverage and storage artifact metadata.
- Monthly cycles are the canonical anchor for payment totals, onchain reconciliation, zkAS datasets/runs, and later payout/reporting stages.
- The app-shell admin subnav now includes Monthly Cycles beside Payments and zkAS.
- Session 22 added `monthly-cycle-lock`; Session 23 added read-only prep review; Session 25 added `monthly-cycle-calculation-package`; Session 26 added verification and approval commands. Session 27's direct result-to-intent action is retired in favor of project-scoped user withdrawal reservations. Later transition commands should extend the same operator workspace instead of creating separate admin roots.
- Session 28 added the backend execution interface. Route work should keep operator pages FundLoop-centric and leave rail-specific EVM/Solana/fiat behavior behind `lib/execution/` adapters.
- Session 29 moved EVM inbound receipt recording behind that execution interface without changing the founder payment route.
- Session 33 added the founder monthly contribution workflow under `/founder/projects/[slug]/contributions` while keeping actual payment writes on the existing Edge Function-backed operations page.
- Session 37 added `/admin/cycles/observability` as the monthly-pipeline event drill-down. It complements payment-flow observability and is the operator-facing source future MCP tools should read for cycle-stage attempts, warnings, and failures.
- Session 34 added the founder attribution-data workflow under `/founder/projects/[slug]/attribution` while keeping dataset upload writes on the existing project zkAS surface.
- Session 44 added `/admin/operations` as the in-product operator runbook that links release, cycle, identity, payment/payout, and artifact checklists to the relevant admin surfaces and engineering docs.
- Session 50 moved the remaining high-value payment operations and reconciliation page reads into `lib/operator/payment-workspaces.ts`. Operator pages should consume reusable read-model workspaces with explicit partial-read warnings instead of shaping Supabase rows inside page components.

## Canonical Entry Routes

Session 08 introduced the first IA-aligned entry routes:

- `/[locale]/workspace`
- `/[locale]/workspace/earnings`
- `/[locale]/workspace/reporting`
- `/[locale]/workspace/account`
- `/[locale]/founder`
- `/[locale]/founder/projects`
- `/[locale]/founder/projects/[slug]`
- `/[locale]/founder/projects/[slug]/contributions`
- `/[locale]/founder/projects/[slug]/attribution`
- `/[locale]/founder/projects/[slug]/reporting`
- `/[locale]/founder/account`
- `/[locale]/founders`

`/workspace`, `/founder`, and `/founder/projects` are now real homes after Sessions 17 and 18. Deeper contribution, attribution, reporting, and payout work is still intentionally deferred to later sessions.

## Transitional Redirects

Session 08 neutralized the most confusing legacy entry points:

- `/[locale]/my-profile` -> `/[locale]/workspace`
- `/[locale]/settings` -> `/[locale]/workspace/account`
- `/[locale]/settings/account` -> `/[locale]/workspace/account`
- `/[locale]/organizations/[id]` -> `/[locale]/founder/projects`

Deep operational routes stay live for now:

- `/[locale]/projects/[slug]/payments`
- `/[locale]/projects/[slug]/zkas`
- `/[locale]/admin/*`
- `/[locale]/admin/superadmin/*`

Those routes are now reached from the new workspace shells rather than being promoted as the main mental model.
