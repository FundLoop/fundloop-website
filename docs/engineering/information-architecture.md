# FundLoop Information Architecture

Last reviewed: 2026-04-14

Related planning docs:
- [Engineering Docs Index](./README.md)
- [Agent Context Index](../../agent-context/README.md)
- [Backgrounder for Agents](./backgrounder-for-agents.md)
- [Current-State Architecture](./current-state-architecture.md)
- [Target-State Architecture](./target-state-architecture.md)
- [Route Inventory](./route-inventory.md)
- [TODO Roadmap](../../agent-context/todo.md)

This document locks the target route model for FundLoop. It does not move routes yet. It defines which surfaces stay public, which authenticated surfaces converge into role-based workspaces, and where transitional current routes should land.

## IA Decisions

- Public marketing, discovery, legal, and support routes stay public.
- Authenticated product surfaces converge toward role-based workspaces, not a mixed set of profile, settings, and project-specific leaves.
- The regular-user workspace is the canonical home for identity status, participation, earnings, payouts, and personal reporting.
- The founder/project workspace is the canonical home for project operations, monthly contributions, attribution submission, and founder-facing reporting.
- `/admin` remains the internal operator namespace.
- Settings become supporting surfaces under the workspaces, not the main location for product work.

## Target Route Model

### 1. Public surfaces

Canonical public paths:

- `/`
  Marketing home and top-level entry point.
- `/founders`
  Founder acquisition funnel and commercial entry path.
- `/participation`
  User discovery and participation explainer.
- `/projects`
- `/projects/[slug]`
  Public project discovery and detail.
- `/users`
- `/users/[id]`
  Public participant discovery and credibility surfaces.
- `/blog`
- `/blog/[slug]`
- `/documentation`
  Product, protocol, MCP, and integration docs.
- `/reports`
  Public reporting and transparency hub.
- `/ecosystem`
- `/faq`
- `/support`
- `/terms`
- `/privacy`
- `/cookies`

Planned public merges/removals:

- `/about` merges into `/` and `/documentation`
- `/pledge` merges into `/founders`
- `/pricing` merges into `/founders`
- `/api` merges into `/documentation`
- `/analytics` becomes part of `/reports`
- `/invitations/[token]` redirects into `/join`

### 2. User workspace

Canonical user paths:

- `/workspace`
  User home, identity status, next actions, and summary state.
- `/workspace/earnings`
  Earnings, pending distributions, payout history.
- `/workspace/reporting`
  User-facing monthly explanations and published results.
- `/workspace/account`
  Identity-linked account settings, payout preferences, local preferences.

Rules:

- `/my-profile` is transitional and should merge into `/workspace` plus `/workspace/account`.
- `/settings` should eventually redirect to `/workspace/account` or the relevant founder/account destination based on context.
- User-facing zkAS result views should live under `/workspace/reporting`, not under generic settings.

### 3. Founder and project workspace

Canonical founder paths:

- `/founder`
  Founder home and project operations landing page.
- `/founder/projects`
  Founder project list and organization-level navigation.
- `/founder/projects/[slug]`
  Founder project home.
- `/founder/projects/[slug]/contributions`
  Monthly obligations, payment routes, submissions, and contribution operations.
- `/founder/projects/[slug]/attribution`
  Project contribution-data and attribution submission workflow.
- `/founder/projects/[slug]/reporting`
  Founder reporting, monthly summaries, and growth views.
- `/founder/account`
  Founder/member account settings.

Rules:

- Public project detail remains at `/projects/[slug]`.
- Founder-only project operations move out of the public `projects` tree over time.
- `/projects/[slug]/payments` maps to `/founder/projects/[slug]/contributions`.
- Project-side zkAS leaves map into founder reporting or attribution flows rather than staying as standalone project subproducts.
- Mock organization routes should be replaced by real founder workspace organization navigation rather than repaired in place.

### 4. Internal operator workspace

Canonical operator paths:

- `/admin`
  Operator home and control-plane entry point.
- `/admin/payments`
- `/admin/payments/reconciliation`
- `/admin/payments/observability`
- `/admin/payments/deployments`
- `/admin/cycles`
  Monthly cadence operations and exception review.
- `/admin/zkas`
- `/admin/zkas/runs`
- `/admin/zkas/uploads`
- `/admin/reporting`
  Operator reporting, exports, and publication control.

Rules:

- Superadmin-only behavior remains under `/admin` but should feel like role-gated sections of one operator workspace rather than a parallel app.
- Broken admin links should be removed or replaced with real operator destinations as the IA is implemented.

## Route Mapping

| Current route | Target canonical home | Notes |
| --- | --- | --- |
| `/my-profile` | `/workspace` and `/workspace/account` | Split mixed profile/dashboard behavior into user home plus account settings. |
| `/settings` | `/workspace/account` or `/founder/account` | Keep as a supporting surface, not the main product home. |
| `/settings/account` | `/workspace/account` or `/founder/account` | Survives as a settings leaf under role workspaces. |
| `/settings/zkas` | `/workspace/reporting` | Personal results belong with reporting and earnings context. |
| `/projects/[slug]` | `/projects/[slug]` | Keep public detail here; link into founder workspace when the viewer has access. |
| `/projects/[slug]/payments` | `/founder/projects/[slug]/contributions` | Canonical founder contribution and route-management surface. |
| `/projects/[slug]/zkas` | `/founder/projects/[slug]/reporting` | Project-side zkAS detail becomes reporting-oriented. |
| `/projects/[slug]/zkas/uploads/[id]` | `/founder/projects/[slug]/attribution` | Upload details live with attribution/data submission history. |
| `/admin` | `/admin` | Remains the operator namespace root, but with real workspace structure. |
| `/admin/superadmin` | `/admin` | Superadmin gates should be expressed inside the operator workspace. |
| `/admin/superadmin/zkas` | `/admin/zkas` | Keep role-gated views inside the same operator domain. |
| `/analytics` | `/reports` | Public analytics preview becomes a real transparency/reporting hub. |
| `/api` | `/documentation` | Developer preview content merges into docs and protocol reference. |
| `/users` | `/users` | Stays public as participant discovery. |
| `/users/[id]` | `/users/[id]` | Stays public as participant detail. |
| `/participation` | `/participation` | Stays public as the user discovery funnel. |
| `/join` | `/join` | Remains the invite-aware onboarding entry route. |
| `/pledge` | `/founders` | Founder pledge content folds into the founder acquisition path. |
| `/pricing` | `/founders` | Founder pricing and packaging should not stay standalone. |
| `/about` | `/` and `/documentation` | Narrative content merges into stronger public surfaces. |
| `/invitations/[token]` | `/join` | Token demo flow should be retired in favor of the real invite entry path. |
| `/organizations/[id]` | `/founder/projects` | Replace mock org detail with real founder workspace navigation. |

## Navigation Model

Top-level public navigation should emphasize:

- Product home
- Founder path
- Participation path
- Project discovery
- Documentation
- Blog
- Support

Authenticated navigation should emphasize:

- user workspace when the primary actor is a regular user
- founder workspace when the primary actor is operating a project
- admin workspace for internal operators only

Settings should be reachable, but not promoted as a top-level destination that competes with the workspaces.
