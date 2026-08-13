-- Permit a subject-erased report read model to retain its immutable evidence
-- hash after its private Storage object path has been removed. Live reports
-- retain the original artifact pair rules.

ALTER TABLE public.monthly_cycle_reports
  DROP CONSTRAINT monthly_cycle_reports_artifact_pair_check;

ALTER TABLE public.monthly_cycle_reports
  ADD CONSTRAINT monthly_cycle_reports_artifact_pair_check CHECK (
    artifact_path IS NOT NULL
    OR (
      artifact_path IS NULL
      AND artifact_hash IS NULL
      AND NOT coalesce((payload->>'tombstoned')::boolean, false)
    )
    OR (
      artifact_path IS NULL
      AND artifact_hash ~ '^[0-9a-f]{64}$'
      AND coalesce((payload->>'tombstoned')::boolean, false)
      AND report_artifact_id IS NOT NULL
    )
  );

