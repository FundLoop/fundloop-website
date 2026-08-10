#!/usr/bin/env bash
set -euo pipefail

database_url="${FUNDLOOP_LOCAL_DATABASE_URL:-postgresql://postgres:postgres@127.0.0.1:55322/postgres}"
tmp_dir="$(mktemp -d)"
trap 'rm -rf "$tmp_dir"' EXIT

# Reuse the executable fixture but retain it for the two independent sessions.
sed 's/^ROLLBACK;$/COMMIT;/' supabase/tests/withdrawal_obligation_control_plane.sql > "$tmp_dir/setup.sql"
psql "$database_url" -v ON_ERROR_STOP=1 -f "$tmp_dir/setup.sql" >/dev/null

actor_id="$(psql "$database_url" -Atc "select user_id from user_withdrawal_obligations order by id limit 1")"
route_id="$(psql "$database_url" -Atc "select id from user_payout_routes where user_id='$actor_id' and rail='evm' order by id limit 1")"

request_sql() {
  local key="$1"
  psql "$database_url" -v ON_ERROR_STOP=1 -Atc "select public.create_user_withdrawal_request_v2(
    '$actor_id'::uuid,jsonb_build_object('contractVersion','withdrawal_request.v2','deploymentEnvironment','local',
    'payoutRouteId',$route_id,'requestedMinor',30000,'assetKey','base_review_usdc','userFeeBps',0,'idempotencyKey','$key'));"
}

set +e
request_sql concurrent-request-a >"$tmp_dir/a.out" 2>"$tmp_dir/a.err" & pid_a=$!
request_sql concurrent-request-b >"$tmp_dir/b.out" 2>"$tmp_dir/b.err" & pid_b=$!
wait "$pid_a"; status_a=$?
wait "$pid_b"; status_b=$?
set -e

if [[ "$status_a" -eq 0 && "$status_b" -eq 0 ]]; then
  echo "both concurrent withdrawals succeeded" >&2
  exit 1
fi
if [[ "$status_a" -ne 0 && "$status_b" -ne 0 ]]; then
  echo "both concurrent withdrawals failed" >&2
  cat "$tmp_dir/a.err" "$tmp_dir/b.err" >&2
  exit 1
fi

successful_output="$tmp_dir/a.out"
failed_error="$tmp_dir/b.err"
if [[ "$status_a" -ne 0 ]]; then successful_output="$tmp_dir/b.out"; failed_error="$tmp_dir/a.err"; fi
if ! grep -q '"requestId"' "$successful_output"; then
  echo "successful request returned no request id" >&2
  exit 1
fi
if ! grep -Eq 'withdrawal_(available_amount_insufficient|concurrent_credit_reservation_failed)' "$failed_error"; then
  echo "losing request did not fail at the credit reservation boundary" >&2
  cat "$failed_error" >&2
  exit 1
fi

active_claimed="$(psql "$database_url" -Atc "select coalesce(sum(claimed_minor),0) from user_withdrawal_obligation_claims where status in('reserved','queued','held','paid','closed')")"
total_obligations="$(psql "$database_url" -Atc "select sum(total_minor) from user_withdrawal_obligations")"
if (( active_claimed > total_obligations )); then
  echo "concurrent claims exceeded obligations" >&2
  exit 1
fi

echo "withdrawal concurrency passed: one winner, one safe loser, claimed=$active_claimed total=$total_obligations"
