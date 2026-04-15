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
- the truthful interim “earnings/results” destination remains `/[locale]/settings/zkas`, framed publicly as current results visibility rather than a finished payout workspace

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

## Canonical Entry Routes

Session 08 introduced the first IA-aligned entry routes:

- `/[locale]/workspace`
- `/[locale]/workspace/account`
- `/[locale]/founder`
- `/[locale]/founder/projects`
- `/[locale]/founder/account`
- `/[locale]/founders`

These are intentionally thin entry shells, not the final content-heavy homes from later sessions.

## Transitional Redirects

Session 08 neutralized the most confusing legacy entry points:

- `/[locale]/my-profile` -> `/[locale]/workspace`
- `/[locale]/settings` -> `/[locale]/workspace/account`
- `/[locale]/settings/account` -> `/[locale]/workspace/account`

Deep operational routes stay live for now:

- `/[locale]/projects/[slug]/payments`
- `/[locale]/projects/[slug]/zkas`
- `/[locale]/admin/*`
- `/[locale]/admin/superadmin/*`

Those routes are now reached from the new workspace shells rather than being promoted as the main mental model.
