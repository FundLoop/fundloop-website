#!/usr/bin/env bash
set -euo pipefail

database_url="${FUNDLOOP_LOCAL_DATABASE_URL:-${SUPABASE_REPLAY_DB_URL:-}}"
if [[ -z "$database_url" || ! "$database_url" =~ @(127\.0\.0\.1|localhost|\[::1\]) ]]; then
  echo "refusing non-local database target" >&2
  exit 2
fi

tmp_dir="$(mktemp -d)"
cleanup() { rm -rf "$tmp_dir"; }
trap cleanup EXIT
db=(psql "$database_url" -X -v ON_ERROR_STOP=1)

sed '$s/^ROLLBACK;$/COMMIT;/' supabase/tests/stripe_pay_by_bank_intake.sql >"$tmp_dir/integrated.sql"
"${db[@]}" -f "$tmp_dir/integrated.sql" >/dev/null
"${db[@]}" -f supabase/tests/epoch_allocation_v2_four_epoch_setup.sql >/dev/null

stale_preview_hash="$("${db[@]}" -Atc "select public.epoch_allocation_v2_preview_input('2026-06',1.50,'local')->>'inputHash'")"

# Hold the exact obligation row used by the harvest guard, then turn the
# released fixture claim active. The lock session must block behind this row
# and reject its stale preview after the claim transaction commits.
"${db[@]}" >"$tmp_dir/claim.out" 2>"$tmp_dir/claim.err" <<'SQL' &
BEGIN;
SELECT obligation.id FROM public.user_withdrawal_obligations obligation
WHERE obligation.monthly_cycle_id=(SELECT id FROM public.monthly_cycles WHERE cycle_key='2026-03')
ORDER BY obligation.id LIMIT 1 FOR UPDATE;
SELECT pg_advisory_xact_lock(hashtextextended('four-epoch-claim-ready',0));
UPDATE public.user_withdrawal_obligation_claims claim SET status='queued',updated_at=clock_timestamp()
FROM public.user_withdrawal_requests request WHERE request.id=claim.withdrawal_request_id
  AND request.idempotency_key='four-epoch-race-release' AND claim.status='released';
SELECT pg_sleep(2);
COMMIT;
SQL
claim_pid=$!

claim_ready=false
for _attempt in {1..40}; do
  if [[ "$("${db[@]}" -Atc "select pg_try_advisory_lock(hashtextextended('four-epoch-claim-ready',0))")" == "f" ]]; then
    claim_ready=true
    break
  fi
  sleep 0.05
done
if [[ "$claim_ready" != true ]]; then
  wait "$claim_pid" || true
  echo "claim transaction did not reach the serialization boundary" >&2
  exit 1
fi

set +e
"${db[@]}" -v preview_hash="$stale_preview_hash" >"$tmp_dir/harvest.out" 2>"$tmp_dir/harvest.err" <<'SQL'
select public.lock_funded_epoch_allocation_v2(jsonb_build_object(
  'contractVersion','epoch_funded_allocation_lock.v2','deploymentEnvironment','local',
  'actorUserId','290eb647-f25f-43f3-bf6b-1e2b2cf25e69','cycleKey','2026-06','capMultiple','1.50',
  'selectedPreviewHash',:'preview_hash'));
SQL
harvest_status=$?
set -e
wait "$claim_pid"
if [[ "$harvest_status" -eq 0 ]] || ! grep -Eq 'epoch_allocation_v2_(harvest_balance_changed|preview_stale)' "$tmp_dir/harvest.err"; then
  echo "claim-versus-harvest serialization did not reject the stale selection" >&2
  cat "$tmp_dir/harvest.out" "$tmp_dir/harvest.err" >&2
  exit 1
fi

"${db[@]}" -c "update public.user_withdrawal_obligation_claims claim set status='released',updated_at=clock_timestamp()
  from public.user_withdrawal_requests request where request.id=claim.withdrawal_request_id
    and request.idempotency_key='four-epoch-race-release' and claim.status='queued';" >/dev/null

fresh_preview_hash="$("${db[@]}" -Atc "select public.epoch_allocation_v2_preview_input('2026-06',1.50,'local')->>'inputHash'")"
lock_result="$("${db[@]}" -v preview_hash="$fresh_preview_hash" -At <<'SQL'
select public.lock_funded_epoch_allocation_v2(jsonb_build_object(
  'contractVersion','epoch_funded_allocation_lock.v2','deploymentEnvironment','local',
  'actorUserId','290eb647-f25f-43f3-bf6b-1e2b2cf25e69','cycleKey','2026-06','capMultiple','1.50',
  'selectedPreviewHash',:'preview_hash'));
SQL
)"
manifest_id="$(node -e 'process.stdout.write(String(JSON.parse(process.argv[1]).manifestId))' "$lock_result")"

"${db[@]}" -v manifest_id="$manifest_id" -At >"$tmp_dir/calculator-input.json" <<'SQL'
select jsonb_build_object(
  'cycleKey',cycle.cycle_key,'manifestHash',manifest.manifest_hash,'selectedPreviewHash',manifest.selected_preview_hash,
  'minorUnitScale',manifest.minor_unit_scale,'capMultiple',to_char(manifest.cap_multiple,'FM90.00'),
  'projectSources',manifest.manifest->'projectSources','redistributionSources',manifest.manifest->'redistributionSources',
  'cohort',manifest.manifest->'cohort')
from public.epoch_allocation_manifests manifest join public.monthly_cycles cycle on cycle.id=manifest.monthly_cycle_id
where manifest.id=:'manifest_id';
SQL

PATH="/opt/homebrew/opt/node@22/bin:$PATH" node --no-warnings --experimental-strip-types \
  scripts/calculate-four-epoch-allocation.mjs "$tmp_dir/calculator-input.json" >"$tmp_dir/artifact.json"
artifact="$(<"$tmp_dir/artifact.json")"
result_hash="$(node -e 'process.stdout.write(JSON.parse(process.argv[1]).resultHash)' "$artifact")"
run_id="$("${db[@]}" -v manifest_id="$manifest_id" -v result_hash="$result_hash" -v artifact="$artifact" -At <<'SQL'
select public.record_funded_epoch_allocation_v2_once(jsonb_build_object(
  'contractVersion','epoch_funded_allocation_result.v2','deploymentEnvironment','local',
  'actorUserId','290eb647-f25f-43f3-bf6b-1e2b2cf25e69','manifestId',:'manifest_id','resultHash',:'result_hash','artifact',:'artifact'::jsonb));
SQL
)"

"${db[@]}" -v manifest_id="$manifest_id" -v run_id="$run_id" -f supabase/tests/epoch_allocation_v2_four_epoch_lifecycle.sql
echo "four-epoch lifecycle passed: real claim/harvest serialization, deterministic calculation, close, reports, and conservation"
