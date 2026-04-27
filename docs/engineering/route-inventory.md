# FundLoop Route Inventory

Last reviewed: 2026-04-20

Related planning docs:
- [Engineering Docs Index](./README.md)
- [Agent Context Index](../../agent-context/README.md)
- [Current-State Architecture](./current-state-architecture.md)
- [Target-State Architecture](./target-state-architecture.md)
- [Information Architecture](./information-architecture.md)
- [TODO Roadmap](../../agent-context/todo.md)

This inventory covers every current `page.tsx` and `route.ts` surface under `app/`. Each entry records who the surface is for, its current state, the evidence that matters for planning, the intended disposition, the canonical future destination, and the roadmap session that should absorb the work.

## Cross-Cutting Findings

- `/admin` currently links to missing routes: `/admin/projects`, `/admin/users`, and `/admin/analytics`.
- `/settings` currently links to missing routes: `/settings/notifications` and `/settings/security`.
- `/my-profile` currently links to missing `/organizations`.
- `/invitations/[token]` is a legacy invitation redirect, and `/organizations/[id]` is now a founder-workspace redirect instead of a mock organization page.
- `/about`, `/api`, and `/analytics` are now legacy public entry points and should remain redirects only.

## Public Site and Discovery Surfaces

| Path | Audience | Current state | Evidence / notes | Disposition | Canonical target | Follow-up session |
| --- | --- | --- | --- | --- | --- | --- |
| `/` | Public visitors | Marketing home is real but still pre-IA. | Strong visual design, but still the top of a mixed public/app nav. | finish | Public home and entry funnel | 08, 09, 10, 45 |
| `/about` | Public visitors | Redirect-only legacy narrative route. | Session 11 merged the public “about” story into the documentation hub. | redirect | `/documentation#about-fundloop` | 11 |
| `/api` | Developers, partners, agents | Redirect-only legacy developer preview route. | Session 11 folded the old API preview into the documentation hub’s integrations section. | redirect | `/documentation#protocol-and-integrations` | 11 |
| `/analytics` | Public visitors, transparency readers | Redirect-only legacy preview route. | Session 11 retired the dummy analytics page in favor of the truthful public reports hub. | redirect | `/reports` | 11 |
| `/blog` | Public visitors | Localized server-rendered content listing. | Session 11 moved the page onto the modern public shell and retired the old browser-only fetch pattern. | finish | Public blog | 11 |
| `/blog/[slug]` | Public visitors | Localized server-rendered content detail route. | Session 11 replaced the old client-only article page with the current public-shell article experience. | finish | Public blog article detail | 11 |
| `/cookies` | Public visitors | Real legal/compliance page on the current public shell. | Session 11 rebuilt the page visually and added localized metadata/chrome while keeping the body copy truthful. | finish | Public legal surface | 11 |
| `/documentation` | Developers, partners, operators | Canonical public docs hub. | Session 11 merged the about/integrations narrative and support-article browsing into one public documentation surface. | finish | Public docs hub | 11, 44 |
| `/ecosystem` | Public visitors | Real supporting public page on the current public shell. | Session 11 localized the shell and metadata and aligned the route with the modern marketing system. | finish | Public ecosystem/discovery surface | 11 |
| `/faq` | Public visitors | Real supporting public page on the current public shell. | Session 11 moved FAQ onto the current shell and localized the surrounding chrome/CTA behavior. | finish | Public FAQ | 11 |
| `/founders` | Prospective founders | Real founder acquisition funnel. | Session 09 consolidated the founder story here and made it the single public founder path. | finish | Public founder acquisition entry | 09 |
| `/join` | Invited users | Real invite-code entry route. | Validates invite codes and hands off to onboarding. | finish | Public invitation and onboarding entry | 10, 12 |
| `/invitations/[token]` | Invited users | Redirect-only legacy invitation route. | Session 11 retired the old mock invitation flow and now preserves the token into the real `/join?invite=...` path. | redirect | `/join` and the real invitation entry flow | 11 |
| `/participation` | Prospective users | Real public user funnel. | Session 10 made this the canonical public user acquisition and explanation path, with explicit onboarding, CUBID, project discovery, and results-visibility handoff. | finish | Public user discovery and participation explainer | 10 |
| `/pledge` | Prospective founders | Redirect-only legacy founder page. | Session 09 merged pledge content into `/founders#commitment`. | redirect | `/founders#commitment` | 09 |
| `/pricing` | Prospective founders | Redirect-only legacy founder page. | Session 09 merged support-model content into `/founders#support-model`. | redirect | `/founders#support-model` | 09 |
| `/privacy` | Public visitors | Real legal page on the current public shell. | Session 11 rebuilt the page visually and added localized metadata/chrome while keeping the body copy truthful. | finish | Public legal surface | 11 |
| `/support` | Public visitors, users, founders | Real support/contact page. | Should remain part of public/help system. | finish | Public support surface | 11, 44 |
| `/terms` | Public visitors | Real legal page on the current public shell. | Session 11 rebuilt the page visually and added localized metadata/chrome while keeping the body copy truthful. | finish | Public legal surface | 11 |
| `/use-cases/[slug]` | Public visitors, founders | Real public explainer detail route. | Supports founder narrative and ecosystem education. | finish | Public use-case detail surface | 09, 11 |
| `/projects` | Public visitors, users | Real server-rendered project discovery page. | Session 10 rebuilt the page around the user funnel, localized metadata, server-side filters, and onboarding/workspace CTA handoff. | finish | Public project discovery directory | 10 |
| `/projects/[slug]` | Public visitors, project members | Real public project profile with founder-aware access. | Session 10 modernized the route into a public discovery/profile surface and kept founder controls secondary for project admins only. | finish | Public project detail with links into founder workspace | 10, 18 |
| `/users` | Public visitors, users | Real server-rendered participant discovery page. | Session 10 reframed the route as a participation-oriented public credibility surface with auth-aware CTA handoff. | finish | Public participant directory | 10 |
| `/users/[id]` | Public visitors, users | Real public participant profile. | Session 10 modernized the route into a public profile that links back into projects and the participation path instead of feeling like a utility record. | finish | Public participant profile | 10 |

## Authenticated User and Founder Surfaces

| Path | Audience | Current state | Evidence / notes | Disposition | Canonical target | Follow-up session |
| --- | --- | --- | --- | --- | --- | --- |
| `/workspace` | Signed-in users | Real regular-user workspace home. | Session 17 rebuilt the route around identity readiness, profile completion, participation footprint, discovery next actions, and current published result visibility. | finish | User workspace home | 17 |
| `/workspace/account` | Signed-in users | Workspace account hub with explicit identity ownership split. | Sessions 15 and 16 made CUBID-managed identity read-only here and separated it from FundLoop-managed profile/preferences. | finish | User workspace account settings | 16, 42 |
| `/founder` | Founders, project members | Real founder workspace home. | Session 18 summarizes managed projects, setup readiness, contribution/payment status, attribution readiness, identity reminders, and next actions while keeping deep operations in their current routes. | finish | Founder workspace home | 18 |
| `/founder/projects` | Founders, project members | Real founder project index. | Session 18 added per-project setup, payment, attribution, reporting, and team badges with links to canonical founder project homes and existing operations. | finish | Founder workspace projects | 18 |
| `/founder/projects/[slug]` | Founders, project members | Thin canonical per-project founder home. | Session 18 added the route and gates it to slugs in `getNavigationContext().managedProjects`; payment and zkAS actions still link to existing `/projects/[slug]/*` operations. | finish | Founder workspace project home | 18, 33, 36 |
| `/founder/account` | Founders, project members | Founder account shell with the same read-only CUBID identity summary. | Sessions 15 and 16 aligned founder account with the shared identity authority model. | finish | Founder workspace account settings | 16, 18, 42 |
| `/my-profile` | Signed-in users | Redirect-only legacy entry. | Session 08 retired the old mixed profile/dashboard entry in favor of `/workspace`. | redirect | `/workspace` | 16, 17, 42 |
| `/organizations/[id]` | Founder/org members | Redirect-only legacy organization route. | Session 18 retired the mock organization detail surface and points users to the founder project index instead. | redirect | `/founder/projects` | 18 |
| `/projects/[slug]/payments` | Project admins | Real founder operations surface. | Session 19 moved founder payment-route writes and onchain receipt recording behind typed Edge Function commands while keeping the deep operation URL in place. | finish | Founder workspace project contributions | 18, 19, 33 |
| `/projects/[slug]/zkas` | Project admins, operators | Transitional project-side zkAS page. | Belongs to monthly cycle and reporting rather than standalone project leaf. | merge | Founder workspace cycle and reporting area | 33, 36 |
| `/projects/[slug]/zkas/uploads/[id]` | Project admins, operators | Transitional upload-detail leaf. | Should live under project contribution-data submission and audit flow. | merge | Founder workspace attribution/data submission history | 34 |
| `/settings` | Signed-in users | Redirect-only legacy entry. | Session 08 collapsed the old settings hub into `/workspace/account` to remove dead-end settings navigation. | redirect | `/workspace/account` | 42 |
| `/settings/account` | Signed-in users | Redirect-only legacy account leaf. | Session 08 redirected the old account route to the new workspace account surface. | redirect | `/workspace/account` | 16, 42 |
| `/settings/zkas` | Signed-in users | Transitional personal zkAS results detail page. | Session 17 summarizes published results from `/workspace`, but keeps this route as the truthful interim detailed history until reporting/earnings routes are built. | merge | User workspace reporting and results | 35, 36 |

## Internal Operator and Admin Surfaces

| Path | Audience | Current state | Evidence / notes | Disposition | Canonical target | Follow-up session |
| --- | --- | --- | --- | --- | --- | --- |
| `/admin` | Internal operators | Operator workspace landing page. | Session 08 removed the broken child links and now points only to real operator destinations. | finish | Internal operator workspace home | 44 |
| `/admin/identity` | Internal operators | Read-only operator identity-health surface. | Sessions 15 and 16 added stale-snapshot, sync-error, and linkage visibility without cross-user identity writes. | finish | Internal operator identity health | 15, 16, 44 |
| `/admin/payments` | Internal operators | Real payments operations hub. | Already meaningful and linked to observability, reconciliation, deployments. | finish | Operator payments workspace | 20, 37 |
| `/admin/payments/deployments` | Internal operators | Real wallet-deployment audit page. | Supports runtime drift and env validation. | finish | Operator payments deployment audit | 44 |
| `/admin/payments/observability` | Internal operators | Real payment observability surface. | Part of the operator control plane. | finish | Operator payments observability | 37 |
| `/admin/payments/reconciliation` | Internal operators | Real onchain reconciliation page. | Fits the operator payments domain cleanly. | finish | Operator payments reconciliation | 20, 37 |
| `/admin/superadmin` | Superadmins | Transitional superadmin entry point. | Role split is valid, but IA should absorb it into the operator workspace rather than a parallel top-level mental model. | merge | Operator workspace with superadmin-gated sections | 03, 44 |
| `/admin/superadmin/zkas` | Superadmins | Real but specialized superadmin queue. | Should remain role-gated but feel like part of one operator workspace. | merge | Operator zkAS superadmin area | 24, 44 |
| `/admin/superadmin/zkas/runs/[id]` | Superadmins | Real specialized run-review page. | Belongs inside the operator zkAS hierarchy. | merge | Operator zkAS run review | 24, 26 |
| `/admin/zkas` | Internal operators | Real zkAS workspace entry. | Already acts like a domain home. | finish | Operator zkAS workspace | 24 |
| `/admin/zkas/runs` | Internal operators | Real zkAS runs list. | Should remain inside operator zkAS. | finish | Operator zkAS runs | 24, 26 |
| `/admin/zkas/runs/[id]` | Internal operators | Real zkAS run detail. | Supports run inspection and status handling. | finish | Operator zkAS run detail | 24, 26 |
| `/admin/zkas/uploads` | Internal operators | Real upload queue/list. | Supports operator prep and triage. | finish | Operator zkAS uploads | 23, 24 |
| `/admin/zkas/uploads/[id]` | Internal operators | Real upload detail. | Supports operator review of submitted artifacts. | finish | Operator zkAS upload detail | 23, 24 |

## Machine and Internal Endpoint Surfaces

| Path | Audience | Current state | Evidence / notes | Disposition | Canonical target | Follow-up session |
| --- | --- | --- | --- | --- | --- | --- |
| `/admin/superadmin/zkas/runs/[id]/artifacts/[kind]` | Superadmins, internal tooling | Real internal artifact route handler. | Supports artifact retrieval in zkAS review flow. | finish | Operator zkAS artifact delivery endpoint | 24, 43 |
| `/api/internal/e2e/login` | Playwright, non-production automation | Purpose-built internal test helper. | Guarded, non-production auth bootstrap for browser tests. | finish | Internal test-only auth helper | 44 |
| `/api/internal/observability/payment-events` | Authenticated browser clients | Real internal ingestion endpoint. | Captures client-originated payment-flow observability events. | finish | Internal observability ingestion API | 37 |
| `/api/internal/payments/reconcile-onchain` | Cron, internal operators | Real internal worker endpoint. | Protected reconciliation trigger for scheduled and manual runs. | finish | Internal payment reconciliation endpoint | 20, 37 |
| `/reports` | Public visitors, transparency readers | Canonical public reporting hub. | Session 11 introduced the truthful transparency surface that explains what reporting exists now and what the public reporting model will cover later. | finish | Public reporting and transparency hub | 11, 36 |
