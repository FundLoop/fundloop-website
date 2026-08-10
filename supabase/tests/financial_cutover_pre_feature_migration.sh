#!/usr/bin/env bash
set -euo pipefail

repo_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
db=(env PGPASSWORD=postgres psql -h 127.0.0.1 -p 55322 -U postgres -d postgres -v ON_ERROR_STOP=1)

resolve_supabase_raw_binary() {
  if [[ -n "${SUPABASE_RAW_BINARY:-}" && -x "${SUPABASE_RAW_BINARY}" ]]; then
    printf '%s\n' "${SUPABASE_RAW_BINARY}"
    return
  fi

  local launcher launcher_real candidate
  launcher="$(command -v supabase)"
  launcher_real="$(realpath "$launcher")"
  if [[ "$(head -c 2 "$launcher_real")" != '#!' ]]; then
    printf '%s\n' "$launcher_real"
    return
  fi

  candidate="$(find "$(dirname "$launcher_real")/.." -type f \
    \( -path '*/@supabase/cli-*/bin/supabase-go' -o -path '*/@supabase/cli-*/bin/supabase' \) \
    -perm -u+x -print -quit)"
  if [[ -z "$candidate" ]]; then
    echo "Unable to resolve the raw Supabase CLI binary; set SUPABASE_RAW_BINARY." >&2
    exit 1
  fi
  printf '%s\n' "$candidate"
}

supabase_raw="$(resolve_supabase_raw_binary)"

restore_current() {
  (cd "$repo_dir" && supabase db reset --local >/dev/null) || true
}
trap restore_current EXIT

cd "$repo_dir"
# The Node launcher in CLI 2.101.0 confuses this command-local flag with its
# global boolean --version flag. Invoking the bundled binary preserves the
# documented reset-to-version behavior.
"$supabase_raw" db reset --local --version 20260810150000

"${db[@]}" <<'SQL'
DO $$
DECLARE
  actor uuid:='00000000-0000-4000-8000-000000000101';
  cycle_id bigint;
  run_id bigint;
  result_id bigint;
BEGIN
  SELECT id INTO cycle_id FROM public.monthly_cycles WHERE cycle_key='2026-05';
  INSERT INTO public.zkas_runs(month,status,usd_pool,monthly_cycle_id,created_by_user_id)
  VALUES('2026-05','draft',42.00,cycle_id,actor) RETURNING id INTO run_id;
  INSERT INTO public.zkas_run_results(run_id,zkas_user_id,eligibility,aggregate_score,allocation_usd,
    app_count,project_count,output_row_hash,monthly_cycle_id)
  VALUES(run_id,'pre-cutover-user',true,1,42.00,1,1,repeat('9',64),cycle_id) RETURNING id INTO result_id;
  INSERT INTO public.monthly_cycle_bookkeeping_credits(monthly_cycle_id,run_id,source_result_id,user_id,
    usd_equivalent_amount,idempotency_key,credited_by_user_id)
  VALUES(cycle_id,run_id,result_id,actor,42.00,'pre-cutover-credit-fixture',actor);
END $$;
SQL

supabase migration up --local

"${db[@]}" <<'SQL'
DO $$
DECLARE
  result jsonb;
BEGIN
  result:=public.prepare_financial_cutover('00000000-0000-4000-8000-000000000101',jsonb_build_object(
    'contractVersion','financial_cutover_prepare.v1','deploymentEnvironment','local',
    'idempotencyKey','pre-feature-upgrade-proof','evidenceHash',repeat('8',64),'approvedOpeningBalances','[]'::jsonb));
  IF (result->>'blockerCount')::integer<1 OR NOT EXISTS(
    SELECT 1 FROM public.financial_cutover_source_records record
    WHERE record.run_id=(result->>'runId')::bigint AND record.source_type='bookkeeping_credit'
      AND record.classification='legacy_unverified' AND record.legacy_minor=4200
  ) THEN RAISE EXCEPTION 'pre-feature legacy credit was not preserved and classified'; END IF;
END $$;
SELECT 'financial_cutover_pre_feature_migration_passed' AS result;
SQL
