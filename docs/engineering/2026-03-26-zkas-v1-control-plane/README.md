# zkAS v1 Control Plane Docs

This folder documents the current zkActivitySum v1 control plane as implemented in the FundLoop repo.

Documents:

- [Architecture Overview](./architecture-overview.md)
- [Implementation Reference](./implementation-reference.md)

Primary code entrypoints covered here:

- `app/actions/zkas-actions.ts`
- `app/admin/zkas/page.tsx`
- `app/projects/[slug]/zkas/page.tsx`
- `lib/zkas/validation.ts`
- `lib/supabase-admin.ts`
- `types/zkas.ts`
- `types/supabase.ts`
- `zkas/engine/zkas_engine/runner.py`

Primary schema artifacts covered here:

- `supabase/migrations/20260326001500_zkas_v1.sql`
- `supabase/migrations/20260326013000_zkas_admin_ui.sql`
