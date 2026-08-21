-- Scope zkas_identity_artifacts uniqueness to (month, artifact_hash) and (month, object_path)
-- so identical artifacts can be reused across different monthly cycles without mutating prior cycle history.

ALTER TABLE public.zkas_identity_artifacts
  DROP CONSTRAINT IF EXISTS zkas_identity_artifacts_artifact_hash_key,
  DROP CONSTRAINT IF EXISTS zkas_identity_artifacts_object_path_key;

ALTER TABLE public.zkas_identity_artifacts
  ADD CONSTRAINT zkas_identity_artifacts_month_artifact_hash_key UNIQUE (month, artifact_hash),
  ADD CONSTRAINT zkas_identity_artifacts_month_object_path_key UNIQUE (month, object_path);
