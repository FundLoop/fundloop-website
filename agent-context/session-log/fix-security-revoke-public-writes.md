# Session Log: fix/security-revoke-public-writes

### session v1: Stopgap — remove public client write access to legacy RLS-off tables

- **Timestamp:** 2026-09-18T22:30:00Z
- **Agent:** Claude Code (Claude Opus 5)
- **Branch:** `fix/security-revoke-public-writes`
- **Head before commit:** `d27ee13`

---

#### Objective

Close the write/delete exposure found while preparing the first Production database deploy. On FundLoop Dev, 44 public tables have RLS disabled while `anon` and `authenticated` hold INSERT/UPDATE/DELETE/TRUNCATE, and the public schema is API-exposed. Two `SECURITY DEFINER` functions (`soft_delete_users`, `soft_delete_organizations`) are executable by `anon` and perform no authorization check.

---

#### Actions Taken

- Audited every `.from(<table>)` call site by client type: browser, user-session server, admin/service-role, command modules, and Edge Functions. Command modules run through Edge Functions with `auth.adminClient`; `authClient` is only used for `getUser` and definer RPCs. All user-called RPCs are `SECURITY DEFINER`, so grants don't affect them.
- Added `20260918120000_revoke_public_client_writes_stopgap.sql`. It revokes INSERT/UPDATE/DELETE/TRUNCATE/REFERENCES/TRIGGER from `anon` and `authenticated` on the 44 tables, then grants back only the audited client writes:
  - newsletter/support INSERT (anon + authenticated)
  - organization_invitations INSERT/UPDATE, organization_members INSERT, projects INSERT, wallet_accounts INSERT/UPDATE, user_notifications UPDATE (authenticated)
- Revoked EXECUTE on `soft_delete_users(uuid)` and `soft_delete_organizations(bigint)` from PUBLIC/anon/authenticated.
- Added `supabase/tests/public_client_write_grants.sql`, which pins the exact remaining client write surface on RLS-off tables, checks that reads are unchanged, and checks that the functions are no longer client-executable. Added it to the CI fresh-schema replay suite list.

---

#### Validation Notes

- `tsc --noEmit`, ESLint: pass. Full Vitest: 1160/1161; the one failure is the known load-sensitive timeout in `payment-flow-observability-route` (passes alone).
- **Not run locally:** the migration replay and SQL suite. The local Colima VM (`codex-supabase`) is down after a host restart with a stale disk lock; clearing it needs the user. The CI "Supabase fresh-schema replay" job applies all migrations and now runs the new suite.

---

#### Reflections

The admin UI's delete-user and delete-organization buttons call the soft-delete RPCs from the browser, so they will return a permission error until admin deletion moves server-side behind `isInternalAdminEmail`. That is an intentional trade-off. Admin screens also read `payments` and `audit_log` via the browser client; this relies on the still-open SELECT grants, which the RLS follow-up must replace.

---

#### Suggested Next Steps

- Full RLS policy migration (reads): public reference/content reads, owner-scoped rows, server-only tables, and admin screens moved to server actions using the admin client.
- Then continue the Production launch plan (rehearsal, cron_logs handover, deploy).
