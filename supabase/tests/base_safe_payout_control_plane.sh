#!/usr/bin/env bash
set -euo pipefail

database_url="${FUNDLOOP_LOCAL_DATABASE_URL:-postgresql://postgres:postgres@127.0.0.1:55322/postgres}"
tmp_dir="$(mktemp -d)"
trap 'rm -rf "$tmp_dir"' EXIT

sed 's/^ROLLBACK;$/COMMIT;/' supabase/tests/withdrawal_obligation_control_plane.sql > "$tmp_dir/withdrawal-setup.sql"
psql "$database_url" -v ON_ERROR_STOP=1 -f "$tmp_dir/withdrawal-setup.sql" >/dev/null
psql "$database_url" -v ON_ERROR_STOP=1 -f supabase/tests/base_safe_payout_control_plane.sql
