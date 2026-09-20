# Session Log: fix/schema-parity-rls-flags

### session v1: Make service-only RLS flags explicit so Production matches a replay

- **Timestamp:** 2026-09-20T21:00:00Z
- **Agent:** Claude Code (Claude Opus 5)
- **Branch:** `fix/schema-parity-rls-flags`
- **Head before commit:** `b0b9237`

---

#### Objective

Production's first deploy (run 35495711335, attempt 3) applied all 115 migrations, then failed the public-schema parity check: `Effective public schema drift: expected=cdca4021… observed=fb9eec61…`. Edge Functions and deployment evidence never ran as a result.

---

#### Diagnosis

Newer Supabase projects ship an `ensure_rls` event trigger that enables RLS on every table created in `public`. FundLoop Prod has it; Dev and local images do not. `pg_dump --schema-only` emits `ENABLE ROW LEVEL SECURITY`, and the parity check only strips comments and whitespace, so the flags drift. Comparing Prod against a local replay showed exactly 7 tables: six created by migrations, plus `supabase_deploy_context`, which the deploy workflow creates outside them.

---

#### Actions Taken

- `20260920100000_enable_rls_on_service_only_tables.sql` enables RLS on the six migration-created service-only tables (runtime controls, `epoch_close_root_approvals`, both deploy-evidence tables). They have no client grants; the service role and owner bypass RLS, so access is unchanged. No policies are added deliberately.
- The deploy workflow now enables RLS on `supabase_deploy_context` right after creating it, and `verify-supabase-schema-parity.mjs` does the same in both local baselines.
- Pinned the workflow statement in `tests/supabase-delivery-parity.test.ts`.

---

#### Validation Notes

- Fresh local reset: the RLS set now matches Production exactly except `supabase_deploy_context`, which only exists where the workflow or parity baseline creates it (both now enable it).
- Delivery-parity and deployment-audit tests: 28/28.

---

#### Reflections

Production is the stricter environment here, so the fix makes its state explicit everywhere rather than relaxing it. Platform defaults that differ by project age will keep producing drift like this; the parity check is doing its job.

---

#### Suggested Next Steps

- Merge, promote to `main`, and re-run the Production deploy so Edge Functions and evidence complete.
- Production's `/en/reports` still returns 500: the loader uses the service-role client, so check `SUPABASE_SERVICE_ROLE_KEY` in the Vercel Production project.
