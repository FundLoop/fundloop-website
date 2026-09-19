# Session Log: fix/audit-trigger-definer

### session v1: Run the audit trigger as its owner

- **Timestamp:** 2026-09-19T01:00:00Z
- **Agent:** Claude Code (Claude Opus 5)
- **Branch:** `fix/audit-trigger-definer`
- **Head before commit:** `a29e78a`

---

#### Objective

Fix a regression from the write-revoke stopgap (#253). `public.log_changes()`, the audit trigger on projects, wallet_accounts, users, payments, organizations and related tables, was `SECURITY INVOKER`, so every client write to those tables also needed INSERT on `audit_log`. The stopgap revoked that, so signed-in wallet add/rename/remove/make-primary failed inside the trigger on FundLoop Dev.

---

#### Actions Taken

- Added `20260919080000_audit_trigger_security_definer.sql`: `log_changes()` becomes `SECURITY DEFINER` with `search_path = ''`, and EXECUTE is revoked from clients. The body only inserts one row into `public.audit_log` from trigger data and `auth.uid()`, and references only schema-qualified objects.
- Added `supabase/tests/audit_trigger_definer.sql` (in the CI replay list). It checks definer mode, that clients still cannot write `audit_log` directly, and that a signed-in user's own wallet insert succeeds and is audited.

---

#### Validation Notes

- Full Vitest: 1163/1163.
- Database validation is via the CI fresh-schema replay (the local Docker VM is unavailable).

---

#### Reflections

The stopgap audit covered direct table calls but not triggers that write elsewhere as the caller. The full RLS work must check trigger functions on every client-written table.

---

#### Suggested Next Steps

- Merge, then confirm wallet changes work on Dev. The project visibility toggle stays broken until the RLS PR adds the admin-only column update policy.
