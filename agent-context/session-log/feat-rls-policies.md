# Session Log: feat/rls-policies

### session v1: Row-level security for legacy public tables

- **Timestamp:** 2026-09-19T02:30:00Z
- **Agent:** Claude Code (Claude Opus 5)
- **Branch:** `feat/rls-policies`
- **Head before commit:** `a29e78a`

---

#### Objective

Replace the write-only stopgap (#253) with least-privilege RLS on the 43 legacy public tables (plus the workflow-created `supabase_deploy_context`). This closes read exposure, makes Dev and Production behave the same whether or not a project has the `ensure_rls` event trigger, and unblocks the first Production database deploy (#173).

---

#### Decisions (from the user)

- Public profile fields are exposed only with consent (display name, headline, avatar, location); email is never public.
- Collaborator emails are visible only to fellow project admins. The onboarding "find your project" search shows project-level contact only.
- The migration and app changes ship as one PR.

---

#### Actions Taken

- Migration `20260919090000_rls_policies_for_legacy_public_tables.sql`:
  - Drops every legacy policy on these tables. Thirty dormant ones existed, including `public_payments_read_all USING (true)` for anon/authenticated; policies are OR'd, so they would otherwise activate.
  - Enables RLS, revokes all client privileges, then grants back explicitly. Hosted and local default privileges differ, so nothing is left to defaults.
  - Helpers `rls_is_public_project`, `rls_is_project_member`, `rls_is_project_admin` (SECURITY DEFINER, keyed to `auth.uid()`; admin reuses `is_project_financial_admin`).
  - Public read: ref_*, blog_posts, chain_intake_contracts, monthly_network_stats, project_categories, team_roles.
  - projects: public active projects or member projects. Project admins may update only `is_public`, `updated_by`, `updated_at`, which restores the visibility toggle broken by #253.
  - participants: public-project memberships, own rows, or member projects.
  - users, organization_members, user_interests/skills/social_platforms/notifications: own rows only (authenticated).
  - wallet_accounts: own select/insert, plus own update of `is_primary`, `is_removed`, `wallet_name`, `updated_*`.
  - payments, payment_methods, project_stats_monthly: project admins only.
  - support_requests: insert-only, with `user_id` null or self. newsletter_subscribers: insert-only.
  - Server-only: audit_log, debug_log, invitation_codes, onchain_payment_submissions, organization_invitations, organizations, project_stats_yearly, project_users, wallet_connections, supabase_deploy_context.
  - Views `public_user_profiles` (consent-filtered, mirroring `list_discoverable_public_user_ids`) and `project_active_members`.
  - RPCs `search_projects_for_team_member` (authenticated; project fields plus `projects.email` only) and `get_invitation_preview` (exact code match; inviter display name).
  - Explicit sequence USAGE for client inserts.
- App:
  - public discovery reads the views instead of `users` rows and joins.
  - onboarding search uses the RPC (no personal names or emails).
  - the join page uses the invitation RPC.
  - the superadmin page is now a server component gated by `requireInternalAdminActor()` (404 otherwise). Its four panels call allowlist-checked server actions using the admin client, and soft-deletes are direct admin updates recording the actor, which restores the delete buttons.
  - Hand-added types for the new views and RPCs.
- Tests:
  - `supabase/tests/legacy_public_rls_policies.sql` (added to the CI replay): behavioural checks as anon, as an outsider, and as a project admin.
  - `tests/rls-client-surfaces.test.ts`.
  - updated `tests/privacy-preview-surfaces.test.ts` for the view-based discovery.

---

#### Validation Notes

- `tsc --noEmit` and scoped ESLint pass. Vitest is green after the privacy-surface test update (full run below).
- The SQL suite runs only in the CI fresh-schema replay (the local Docker VM is unavailable).

---

#### Reflections

- The access inventory (a sub-agent sweep of every user-role call) was essential. It found the ungated superadmin page, the anonymous payments read, dead components holding stopgap grants, and the `db-utils` visibility-toggle path that my earlier grep missed.
- The dormant `USING (true)` policies were the biggest trap: enabling RLS naively would have exposed every payment to every signed-in user.
- Behaviour change: the people directory now shows only consent-granted profiles and fields. The previous code read `full_name`, `avatar_url` and location for every active user regardless of consent.

---

#### Suggested Next Steps

- Rebase onto `dev` after the audit-trigger hotfix (#255) merges; the wallet paths depend on it.
- After merge, verify on Dev: projects directory, project pages, workspace, wallets, payments page, superadmin dashboard, join page.
- Remove the unreferenced legacy components found by the audit (aligned-users, newsletter-signup, notification-center, invite-member-form, project-signup-step1, organization-members, aligned-projects, analytics, blog-preview).
