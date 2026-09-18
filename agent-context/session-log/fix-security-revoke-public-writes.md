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

### session v2: Handle workflow-created supabase_deploy_context

- **Timestamp:** 2026-09-18T22:45:00Z
- **Agent:** Claude Code (Claude Opus 5)
- **Branch:** `fix/security-revoke-public-writes`
- **Head before commit:** `b1ea883`

---

#### Objective

Fix the CI fresh-schema replay failure: `relation "public.supabase_deploy_context" does not exist`.

---

#### Actions Taken

- The table list was taken from Dev, but `supabase_deploy_context` is created by the deploy workflow, not by migrations, so it doesn't exist in a fresh schema. The other 43 tables are all created by migrations.
- The migration now revokes client access to `supabase_deploy_context` only when it exists.
- The deploy workflow now runs `REVOKE ALL ON TABLE public.supabase_deploy_context FROM anon, authenticated` right after creating it. Previously only the migration-evidence table was revoked, leaving the target-environment record that migrations read anon-writable on Dev.
- Added a workflow assertion to `tests/supabase-delivery-parity.test.ts`.

---

#### Validation Notes

- Delivery-parity, deployment-audit and environment-manifest tests: 43/43.
- The schema-parity script dumps with `--no-privileges` and creates the context table before replay, so it needs no change.

---

#### Reflections

Out-of-band tables are a trap for Dev-derived allowlists: cross-check every name against migrations before hard-coding it.

---

#### Suggested Next Steps

- Confirm the CI fresh-schema replay passes, including `public_client_write_grants.sql`.

### session v3: Make the read-grant check environment-independent

- **Timestamp:** 2026-09-18T23:00:00Z
- **Agent:** Claude Code (Claude Opus 5)
- **Branch:** `fix/security-revoke-public-writes`
- **Head before commit:** `4a460a1`

---

#### Objective

The CI replay now applies the migration and passes the write-allowlist check, but failed the SQL suite's "reads unchanged" assertion.

---

#### Actions Taken

- No migration grants or revokes SELECT on these tables, so client read grants come from each environment's default privileges. Read-only checks of `pg_default_acl` show that FundLoop Prod and Dev both grant ALL on new public tables to anon/authenticated (Prod also includes Postgres 17 MAINTAIN). The CI replay's local image evidently differs.
- The SQL suite now reports the read grants as a NOTICE instead of asserting them, and keeps the write-surface and function checks strict.
- Added `tests/public-client-write-stopgap-migration.test.ts`, which pins that the migration never revokes or grants SELECT and revokes both soft-delete functions.

---

#### Validation Notes

- New Vitest file: 2/2. `tsc --noEmit` and ESLint pass.

---

#### Reflections

The local replay image's default privileges differ from the hosted projects'. The planned Prod rehearsal must reproduce Prod's `pg_default_acl` explicitly, not rely on local defaults.

---

#### Suggested Next Steps

- Read the CI NOTICE to record the replay image's read grants, then merge once green.
