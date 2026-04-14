# FundLoop Route Inventory

Last reviewed: 2026-04-14

Related planning docs:
- [Agent Context Index](/Users/botmaster/src/fundloop/agent-context/README.md)
- [Current-State Architecture](/Users/botmaster/src/fundloop/agent-context/current-state-architecture.md)
- [Target-State Architecture](/Users/botmaster/src/fundloop/agent-context/target-state-architecture.md)
- [Information Architecture](/Users/botmaster/src/fundloop/agent-context/information-architecture.md)
- [TODO Roadmap](/Users/botmaster/src/fundloop/agent-context/todo.md)

This inventory covers every current `page.tsx` and `route.ts` surface under `app/`. Each entry records who the surface is for, its current state, the evidence that matters for planning, the intended disposition, the canonical future destination, and the roadmap session that should absorb the work.

## Cross-Cutting Findings

- `/admin` currently links to missing routes: `/admin/projects`, `/admin/users`, and `/admin/analytics`.
- `/settings` currently links to missing routes: `/settings/notifications` and `/settings/security`.
- `/my-profile` currently links to missing `/organizations`.
- `/invitations/[token]` and `/organizations/[id]` are demo/mock surfaces and should not be treated as production-ready flows.
- `/api` and `/analytics` are intentionally transitional public pages and should remain visible only with an explicit plan to finish or merge them.

## Public Site and Discovery Surfaces

| Path | Audience | Current state | Evidence / notes | Disposition | Canonical target | Follow-up session |
| --- | --- | --- | --- | --- | --- | --- |
| `/` | Public visitors | Marketing home is real but still pre-IA. | Strong visual design, but still the top of a mixed public/app nav. | finish | Public home and entry funnel | 08, 09, 10, 45 |
| `/about` | Public visitors | Standalone narrative page likely overlaps home/docs. | Duplicate “what is FundLoop” storytelling risk. | merge | Public home plus docs/about content block | 11 |
| `/api` | Developers, partners, agents | Transitional preview page. | Explicitly says API is in progress. | finish | Public docs and protocol overview surface | 38, 41 |
| `/analytics` | Public visitors, transparency readers | Transitional public analytics page. | Explicit dummy-data note in UI. | finish | Public reporting and transparency surface | 36 |
| `/blog` | Public visitors | Real content listing. | Supports public education and founder/user funnel support. | finish | Public blog | 11 |
| `/blog/[slug]` | Public visitors | Real content detail route. | Belongs with blog program. | finish | Public blog article detail | 11 |
| `/cookies` | Public visitors | Standard legal/compliance page. | No major structural issue. | finish | Public legal surface | 11 |
| `/documentation` | Developers, partners, operators | Real but broad docs stub. | Should anchor product, protocol, and ops docs over time. | finish | Public docs hub | 11, 44 |
| `/ecosystem` | Public visitors | Real supporting public page. | Fits ecosystem story and aligned network narrative. | finish | Public ecosystem/discovery surface | 11 |
| `/faq` | Public visitors | Real supporting public page. | Useful public support/discovery content. | finish | Public FAQ | 11 |
| `/join` | Invited users | Real invite-code entry route. | Validates invite codes and hands off to onboarding. | finish | Public invitation and onboarding entry | 10, 12 |
| `/invitations/[token]` | Invited users | Demo-only invitation flow. | Contains explicit demo/mock assumptions. | redirect | `/join` and the real invitation entry flow | 11 |
| `/participation` | Prospective users | Real public explainer. | Good user-side narrative, but belongs in broader discovery funnel. | finish | Public user discovery and participation explainer | 10 |
| `/pledge` | Prospective founders | Legacy standalone pledge page. | Older website-style founder pitch and static pledge content. | merge | Founder acquisition funnel and docs | 09 |
| `/pricing` | Prospective founders | Public pricing/offer page. | Should either become real founder packaging or merge into funnel. | merge | Founder acquisition funnel | 09 |
| `/privacy` | Public visitors | Standard legal page. | No major structural issue. | finish | Public legal surface | 11 |
| `/support` | Public visitors, users, founders | Real support/contact page. | Should remain part of public/help system. | finish | Public support surface | 11, 44 |
| `/terms` | Public visitors | Standard legal page. | No major structural issue. | finish | Public legal surface | 11 |
| `/use-cases/[slug]` | Public visitors, founders | Real public explainer detail route. | Supports founder narrative and ecosystem education. | finish | Public use-case detail surface | 09, 11 |
| `/projects` | Public visitors, users | Real project directory. | Already useful as discovery surface. | finish | Public project discovery directory | 10 |
| `/projects/[slug]` | Public visitors, project members | Mixed public detail and member-aware page. | Public project detail route with some member-aware access. | finish | Public project detail with links into founder workspace | 10, 18 |
| `/users` | Public visitors, users | Real public member directory. | Discovery/trust surface for the network. | finish | Public participant directory | 10 |
| `/users/[id]` | Public visitors, users | Real public member profile. | Supports person-level discovery and credibility. | finish | Public participant profile | 10 |

## Authenticated User and Founder Surfaces

| Path | Audience | Current state | Evidence / notes | Disposition | Canonical target | Follow-up session |
| --- | --- | --- | --- | --- | --- | --- |
| `/my-profile` | Signed-in users | Large mixed account/profile/dashboard page. | Links to missing `/organizations`; mixes identity, invitations, and participation context. | merge | User workspace home plus account settings | 16, 17, 42 |
| `/organizations/[id]` | Founder/org members | Mock organization detail page. | Uses explicit mock data and placeholder logos. | remove | Founder workspace organization view once real | 18 |
| `/projects/[slug]/payments` | Project admins | Real founder operations surface. | Production payment and route management now lives here. | finish | Founder workspace project contributions | 18, 33 |
| `/projects/[slug]/zkas` | Project admins, operators | Transitional project-side zkAS page. | Belongs to monthly cycle and reporting rather than standalone project leaf. | merge | Founder workspace cycle and reporting area | 33, 36 |
| `/projects/[slug]/zkas/uploads/[id]` | Project admins, operators | Transitional upload-detail leaf. | Should live under project contribution-data submission and audit flow. | merge | Founder workspace attribution/data submission history | 34 |
| `/settings` | Signed-in users | Transitional settings hub. | Links to missing `/settings/notifications` and `/settings/security`; currently acts as a catch-all. | merge | Supporting settings surface under role workspaces | 42 |
| `/settings/account` | Signed-in users | Real account-management leaf. | Useful, but should be subordinate to workspace/account IA. | finish | Account settings under user/founder workspace | 16, 42 |
| `/settings/zkas` | Signed-in users | Transitional personal zkAS results page. | Better treated as part of earnings/reporting than general settings. | merge | User workspace reporting and results | 35, 36 |

## Internal Operator and Admin Surfaces

| Path | Audience | Current state | Evidence / notes | Disposition | Canonical target | Follow-up session |
| --- | --- | --- | --- | --- | --- | --- |
| `/admin` | Internal operators | Transitional admin landing page. | Links to missing `/admin/projects`, `/admin/users`, and `/admin/analytics`. | finish | Internal operator workspace home | 03, 08, 44 |
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
