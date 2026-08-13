#!/usr/bin/env bash
set -euo pipefail

database_url="${FUNDLOOP_LOCAL_DATABASE_URL:-${SUPABASE_REPLAY_DB_URL:-}}"
if [[ -z "$database_url" || ! "$database_url" =~ @(127\.0\.0\.1|localhost|\[::1\]) ]]; then
  echo "refusing non-local database target" >&2
  exit 2
fi

fixture="$(mktemp)"
cleanup() { rm -f "$fixture"; }
trap cleanup EXIT

# Reuse the real integrated EUR Pay by Bank allocation fixture, committing its
# deterministic local-only evidence so this lifecycle test starts from a
# certified close rather than hand-built award rows.
sed '$s/^ROLLBACK;$/COMMIT;/' supabase/tests/stripe_pay_by_bank_intake.sql >"$fixture"
psql "$database_url" -X -v ON_ERROR_STOP=1 -f "$fixture" >/dev/null
psql "$database_url" -X -v ON_ERROR_STOP=1 -f supabase/tests/epoch_allocation_v2_four_epoch_lifecycle.sql
