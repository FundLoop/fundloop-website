# Session Log: feat/production-parity-migrations

### session v1: Close the Dev/Production data and trigger gaps found by rehearsal

- **Timestamp:** 2026-09-20T06:30:00Z
- **Agent:** Claude Code (Claude Opus 5)
- **Branch:** `feat/production-parity-migrations`
- **Head before commit:** `d20c518`

---

#### Objective

A local rehearsal of FundLoop Prod's first pipeline deploy (#173) found two launch blockers and one schema obstacle. Prod's database has no migration history, so it gets exactly what the migrations provide.

---

#### Findings and Actions

1. **Reference data existed only in `supabase/seed.sql`**, which never runs on hosted databases. A freshly migrated database had 12 empty tables: dropdowns, payment statuses, taxonomies, blog and roles. Dev only has them because it was copied from an older live database.
   - Added `20260920090000_production_reference_data.sql`: 189 rows across 10 `ref_*` tables, taken from Dev without Dev-specific usage counts, timestamps or actor references.
   - Added `20260920092000_production_site_content.sql`: 19 blog posts (9 support articles) and 14 team roles, per the product owner's decision to copy both.
2. **The `on_auth_user_created` trigger was never created by a migration.** `create_user_profile()` is defined, but the trigger lives on `auth.users`, which `initial_remote.sql` (a public-schema dump) could not contain. Dev has it out of band, so on Prod **no new sign-up would get a `public.users` row**.
   - Added `20260920091000_auth_user_profile_trigger.sql`: creates the trigger idempotently and backfills profiles for accounts that predate it (the rehearsal goes from 0/5 to 5/5).
3. **`blog_posts.author_id` was NOT NULL, defaulting to user id 1, with an FK to `users(id)`.** No application code reads it, and it made content impossible to seed in a fresh database. The content migration drops the default and the NOT NULL.
4. **`seed.sql` reference/content inserts are now `ON CONFLICT DO NOTHING`**, because the migrations own that data. The first patch attempt spliced the clause into a blog post body (blog content contains semicolons inside string literals); the statement scanner now tracks quoting.
5. **SQL fixtures that insert `auth.users` and then `public.users`** collided with the new trigger. Five suites now upsert.

---

#### Validation Notes

- `pnpm test:db`: **26/26**, including the new `auth_user_profile_trigger.sql`.
- Production first-deploy rehearsal: **PASS**. 115 migrations apply after the cron_logs handover; `cron_logs` 148/148 rows and all 5 `auth.users` preserved; profiles 5/5; all reference and content tables populated; no client-writable table without RLS; the three security suites pass on the Prod replica.
- Vitest 202/202 files, 1166/1166 tests; `tsc --noEmit` clean.
- The rehearsal records 6 expected differences: Prod's `ensure_rls` trigger enables RLS on six service-only tables (runtime controls and deploy evidence) that a plain replay leaves off. They have no client grants, and the service role and owners bypass RLS, so Prod is simply stricter.

---

#### Reflections

Dev's advantage over a fresh database is invisible until something replays from zero. Anything a hosted environment needs must come from a migration; `seed.sql` is local-only demo data.

---

#### Suggested Next Steps

- Merge, then confirm the Dev deploy is a no-op for data (all inserts are conflict-safe).
- Production sequence: reject the stale run, handover-pre, merge #240, approve the deploy, handover-post, cleanup, verify.
