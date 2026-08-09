BEGIN;

DO $$
BEGIN
  SET LOCAL ROLE authenticated;
  BEGIN
    PERFORM public.validate_epoch_project_package('{}'::jsonb);
    RAISE EXCEPTION 'authenticated_package_rpc_was_not_denied';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    INSERT INTO public.epoch_project_packages(
      project_id,intended_cycle_id,version,status,list_status,funding_status,compliance_status,cubid_status,
      cutoff_at,manifest_hash,created_by_user_id
    ) VALUES (101,1,999,'draft','missing','missing','pending','missing',now(),repeat('0',64),'00000000-0000-4000-8000-000000000101');
    RAISE EXCEPTION 'authenticated_package_insert_was_not_denied';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END
$$;

RESET ROLE;

INSERT INTO public.monthly_cycles(cycle_key,year,month,period_start,period_end)
VALUES
  ('2026-08',2026,8,'2026-08-01','2026-08-31'),
  ('2026-09',2026,9,'2026-09-01','2026-09-30')
ON CONFLICT(cycle_key) DO NOTHING;

INSERT INTO auth.users(id,aud,role,email,created_at,updated_at) VALUES
  ('00000000-0000-4000-8000-000000000105','authenticated','authenticated','noor@fundloop.example.com',now(),now()),
  ('00000000-0000-4000-8000-000000000106','authenticated','authenticated','luis@fundloop.example.com',now(),now()),
  ('00000000-0000-4000-8000-000000000107','authenticated','authenticated','ria@fundloop.example.com',now(),now()),
  ('00000000-0000-4000-8000-000000000108','authenticated','authenticated','omar@fundloop.example.com',now(),now())
ON CONFLICT(id) DO NOTHING;

INSERT INTO public.users(user_id,full_name,email,cubid_id,cubid_identity_status,cubid_score,status)
VALUES
  ('00000000-0000-4000-8000-000000000105','Noor Test','noor@fundloop.example.com','00000000-0000-4000-8000-000000000105','verified',12,'active'),
  ('00000000-0000-4000-8000-000000000106','Luis Test','luis@fundloop.example.com','00000000-0000-4000-8000-000000000106','linked',8,'active'),
  ('00000000-0000-4000-8000-000000000107','Ria Test','ria@fundloop.example.com','00000000-0000-4000-8000-000000000107','verified',25,'active'),
  ('00000000-0000-4000-8000-000000000108','Omar Test','omar@fundloop.example.com','00000000-0000-4000-8000-000000000108','verified',7,'active')
ON CONFLICT(user_id) DO UPDATE SET cubid_identity_status=excluded.cubid_identity_status,cubid_score=excluded.cubid_score;

UPDATE public.users SET cubid_identity_status='verified',cubid_score=5,cubid_id='00000000-0000-4000-8000-000000000102' WHERE user_id='00000000-0000-4000-8000-000000000102';
UPDATE public.users SET cubid_identity_status='verified',cubid_score=10,cubid_id='00000000-0000-4000-8000-000000000103' WHERE user_id='00000000-0000-4000-8000-000000000103';
UPDATE public.users SET cubid_identity_status='verified',cubid_score=15,cubid_id='00000000-0000-4000-8000-000000000104' WHERE user_id='00000000-0000-4000-8000-000000000104';

INSERT INTO public.cubid_identity_snapshots(
  user_id,cubid_user_id,cubid_score,raw_identity,raw_stamps,last_synced_at,last_sync_error_code
) VALUES
  ('00000000-0000-4000-8000-000000000102','cubid-package-valid',5,'{"listStatus":"valid"}','[]','2026-08-31 06:00+00',NULL),
  ('00000000-0000-4000-8000-000000000103','cubid-package-whitelist',10,'{"listStatus":"whitelisted"}','[]','2026-08-31 06:00+00',NULL),
  ('00000000-0000-4000-8000-000000000104','cubid-package-greylist',15,'{"listStatus":"greylisted"}','[]','2026-08-31 06:00+00',NULL),
  ('00000000-0000-4000-8000-000000000105','cubid-package-blacklist',12,'{"listStatus":"blacklisted"}','[]','2026-08-31 06:00+00',NULL),
  ('00000000-0000-4000-8000-000000000106','cubid-package-outage',8,'{"listStatus":"valid"}','[]','2026-08-31 20:00+00','cubid_unavailable'),
  ('00000000-0000-4000-8000-000000000107','cubid-package-invalid',25,'{"listStatus":"valid"}','[]','2026-08-31 06:00+00',NULL),
  ('00000000-0000-4000-8000-000000000108','cubid-package-expired',7,'{"listStatus":"valid"}','[]','2026-08-29 06:00+00','cubid_unavailable')
ON CONFLICT(user_id) DO UPDATE SET
  cubid_score=excluded.cubid_score,raw_identity=excluded.raw_identity,raw_stamps=excluded.raw_stamps,
  last_synced_at=excluded.last_synced_at,last_sync_error_code=excluded.last_sync_error_code;

WITH cycle AS (SELECT id FROM public.monthly_cycles WHERE cycle_key='2026-08')
INSERT INTO public.project_attribution_datasets(
  project_id,monthly_cycle_id,status,row_count,total_attribution_points,submitted_by_user_id,submitted_at,
  approved_by_user_id,approved_at
) SELECT 101,cycle.id,'approved',7,100,'00000000-0000-4000-8000-000000000101','2026-08-30 12:00+00',
  '00000000-0000-4000-8000-000000000101','2026-08-30 13:00+00' FROM cycle;

WITH dataset AS (
  SELECT id,monthly_cycle_id FROM public.project_attribution_datasets WHERE project_id=101
    AND monthly_cycle_id=(SELECT id FROM public.monthly_cycles WHERE cycle_key='2026-08') ORDER BY id DESC LIMIT 1
), cohort(row_index,user_id,email,scoped_id,points) AS (VALUES
  (1,'00000000-0000-4000-8000-000000000102'::uuid,'eli@fundloop.example.com','package-eli',30::numeric),
  (2,'00000000-0000-4000-8000-000000000103'::uuid,'safiya@fundloop.example.com','package-safiya',25::numeric),
  (3,'00000000-0000-4000-8000-000000000104'::uuid,'jonah@fundloop.example.com','package-jonah',20::numeric),
  (4,'00000000-0000-4000-8000-000000000105'::uuid,'noor@fundloop.example.com','package-noor',15::numeric),
  (5,'00000000-0000-4000-8000-000000000106'::uuid,'luis@fundloop.example.com','package-luis',5::numeric),
  (6,'00000000-0000-4000-8000-000000000107'::uuid,'ria@fundloop.example.com','package-ria',3::numeric),
  (7,'00000000-0000-4000-8000-000000000108'::uuid,'omar@fundloop.example.com','package-omar',2::numeric)
)
INSERT INTO public.project_attribution_rows(
  dataset_id,project_id,monthly_cycle_id,row_index,scoped_cubid_id,user_id,user_email,attribution_points,resolution_status
)
SELECT dataset.id,101,dataset.monthly_cycle_id,cohort.row_index,cohort.scoped_id,cohort.user_id,cohort.email,cohort.points,'resolved'
FROM dataset CROSS JOIN cohort;

WITH cycle AS (SELECT id FROM public.monthly_cycles WHERE cycle_key='2026-08')
INSERT INTO public.payments(project_id,period_start,period_end,revenue,payment_amount,payment_percentage,monthly_cycle_id,status)
SELECT 101,'2026-08-01','2026-08-31',100000,1000,1,cycle.id,'active' FROM cycle;

INSERT INTO public.base_project_fee_versions(project_id,version,fee_bps,evidence_hash,is_current)
VALUES(101,1,100,repeat('1',64),true) RETURNING id \gset fee_

INSERT INTO public.base_intake_v2_receipts(
  deployment_id,project_id,accounting_period_id,fee_version_id,provider_event_id,tx_hash,log_index,block_number,
  block_hash,sender_address,token_symbol,token_address,gross_native_amount,project_fee_bps,
  platform_fee_native_amount,net_epoch_native_amount,platform_treasury_address,epoch_treasury_address,
  evidence_hash,observed_at,receipt_reference,project_fee_version
) VALUES(
  1,101,1,:fee_id,'package-base-event',('0x'||repeat('1',64)),0,100,('0x'||repeat('2',64)),
  ('0x'||repeat('3',40)),'USDC',('0x'||repeat('4',40)),1000000000,100,10000000,990000000,
  ('0x'||repeat('5',40)),('0x'||repeat('6',40)),repeat('7',64),'2026-08-31 05:00+00',('0x'||repeat('8',64)),1
) RETURNING id \gset receipt_

INSERT INTO public.base_intake_v2_reconciliation_events(
  receipt_id,status,current_block_number,observed_block_hash,observed_tx_hash,confirmation_count,
  platform_observed_native_amount,epoch_observed_native_amount,evidence_hash,observed_at,observation_source,
  receipt_event_matched,observed_receipt_block_number,observed_log_index,observed_receipt_reference
) VALUES(
  :receipt_id,'exact',112,('0x'||repeat('2',64)),('0x'||repeat('1',64)),13,10000000,990000000,
  repeat('9',64),'2026-08-31 06:00+00','trusted_viem_v1',true,100,0,('0x'||repeat('8',64))
);

SET LOCAL ROLE service_role;

DO $$
BEGIN
  BEGIN
    PERFORM public.validate_epoch_project_package(jsonb_build_object(
      'deploymentEnvironment','production','actorRole','internal_admin','actorUserId','00000000-0000-4000-8000-000000000101',
      'projectSlug','civic-mesh','cycleKey','2026-08','maximumCubidScore','20','complianceEvidenceHash',repeat('a',64)
    ));
    RAISE EXCEPTION 'production_package_validation_was_not_denied';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'epoch_project_package_runtime_disabled' THEN RAISE; END IF;
  END;
END
$$;

SELECT public.validate_epoch_project_package(jsonb_build_object(
  'deploymentEnvironment','local','actorRole','internal_admin','actorUserId','00000000-0000-4000-8000-000000000101',
  'projectSlug','ecostream','cycleKey','2026-08','observedAt','2026-08-15T12:00:00Z','maximumCubidScore','20',
  'kybStatus','passed','kycStatus','passed','sanctionsStatus','passed','complianceEvidenceHash',repeat('b',64),
  'complianceValidUntil','2026-12-01T00:00:00Z'
)) AS missing_package_id \gset missing_

DO $$
DECLARE p public.epoch_project_packages%ROWTYPE;
BEGIN
  SELECT * INTO p FROM public.epoch_project_packages WHERE project_id=1
    AND intended_cycle_id=(SELECT id FROM public.monthly_cycles WHERE cycle_key='2026-08') ORDER BY version DESC LIMIT 1;
  IF p.status <> 'rolled_forward' OR p.list_status <> 'missing' OR p.funding_status <> 'missing'
    OR p.canonical_cycle_id <> (SELECT id FROM public.monthly_cycles WHERE cycle_key='2026-09') THEN
    RAISE EXCEPTION 'missing_pair_did_not_roll_forward';
  END IF;
  IF EXISTS(SELECT 1 FROM public.epoch_project_package_lock_candidates WHERE package_id=p.id) THEN
    RAISE EXCEPTION 'missing_pair_reached_lock_candidates';
  END IF;
END
$$;

SELECT public.validate_epoch_project_package(jsonb_build_object(
  'deploymentEnvironment','local','actorRole','internal_admin','actorUserId','00000000-0000-4000-8000-000000000101',
  'projectSlug','civic-mesh','cycleKey','2026-08','observedAt','2026-08-31T21:00:00Z','maximumCubidScore','20','cubidTtlHours','24',
  'kybStatus','passed','kycStatus','passed','sanctionsStatus','passed','complianceEvidenceHash',repeat('c',64),
  'complianceValidUntil','2026-12-01T00:00:00Z'
)) AS preview_package_id \gset preview_

DO $$
DECLARE p public.epoch_project_packages%ROWTYPE;
BEGIN
  SELECT * INTO p FROM public.epoch_project_packages WHERE project_id=101
    AND intended_cycle_id=(SELECT id FROM public.monthly_cycles WHERE cycle_key='2026-08') AND version=1;
  IF p.status <> 'review_ready' OR p.list_status <> 'valid' OR p.funding_status <> 'settled'
    OR p.compliance_status <> 'passed' OR p.cubid_status <> 'eligible' OR p.payment_count <> 1
    OR p.funding_source_count <> 1 OR p.cohort_count <> 7 OR p.eligible_user_count <> 3 OR p.held_user_count <> 3
    OR p.preliminary_usd <> 990 THEN RAISE EXCEPTION 'review_ready_package_incorrect:%',row_to_json(p); END IF;
  IF (SELECT count(DISTINCT cubid_decision) FROM public.epoch_project_package_cohort WHERE package_id=p.id) <> 7 THEN
    RAISE EXCEPTION 'cubid_matrix_not_snapshotted';
  END IF;
  IF NOT EXISTS(SELECT 1 FROM public.epoch_project_package_cohort WHERE package_id=p.id AND cubid_decision='invalid' AND eligibility_status='excluded')
    OR NOT EXISTS(SELECT 1 FROM public.epoch_project_package_cohort WHERE package_id=p.id AND cubid_decision='outage_expired' AND eligibility_status='held') THEN
    RAISE EXCEPTION 'cubid_invalid_or_expired_outage_boundary_missing';
  END IF;
  IF (SELECT count(*) FROM public.epoch_project_package_email_events WHERE package_id=p.id AND event_type IN('greylist_notice','blacklist_notice')) <> 2 THEN
    RAISE EXCEPTION 'held_identity_email_events_missing';
  END IF;
  IF EXISTS(SELECT 1 FROM public.epoch_project_package_lock_candidates WHERE package_id=p.id) THEN
    RAISE EXCEPTION 'unapproved_preview_reached_lock_candidates';
  END IF;
END
$$;

SELECT public.validate_epoch_project_package(jsonb_build_object(
  'deploymentEnvironment','local','actorRole','internal_admin','actorUserId','00000000-0000-4000-8000-000000000101',
  'projectSlug','civic-mesh','cycleKey','2026-08','observedAt','2026-09-01T08:00:00Z','maximumCubidScore','20','cubidTtlHours','24',
  'kybStatus','passed','kycStatus','passed','sanctionsStatus','passed','complianceEvidenceHash',repeat('d',64),
  'complianceValidUntil','2026-12-01T00:00:00Z'
)) AS frozen_package_id \gset

DO $$
DECLARE p public.epoch_project_packages%ROWTYPE;
BEGIN
  SELECT * INTO p FROM public.epoch_project_packages WHERE project_id=101
    AND intended_cycle_id=(SELECT id FROM public.monthly_cycles WHERE cycle_key='2026-08') AND version=2;
  IF p.status <> 'frozen' OR p.frozen_at IS NULL OR p.version <> 2 THEN RAISE EXCEPTION 'package_not_frozen_at_cutoff'; END IF;
  IF public.epoch_project_package_pseudonym(101,'00000000-0000-4000-8000-000000000102')
    = public.epoch_project_package_pseudonym(1,'00000000-0000-4000-8000-000000000102') THEN
    RAISE EXCEPTION 'project_pseudonyms_correlate';
  END IF;
  BEGIN
    PERFORM public.decide_epoch_project_package(jsonb_build_object(
      'deploymentEnvironment','local','packageId',p.id,'decision','approve','actorUserId','00000000-0000-4000-8000-000000000101','evidenceHash',repeat('e',64)
    ));
    RAISE EXCEPTION 'decision_without_delivery_was_not_denied';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'epoch_project_package_not_decidable' THEN RAISE; END IF;
  END;
END
$$;

SELECT public.record_epoch_project_package_email_delivery(jsonb_build_object(
  'deploymentEnvironment','local','packageId',:frozen_package_id,'attemptId','00000000-0000-4000-8000-000000000133',
  'providerKey','mailpit_local','providerMessageId','mailpit-package-133','recipientHash',repeat('1',64),
  'evidenceHash',repeat('2',64),'actorUserId','00000000-0000-4000-8000-000000000101','deliveredAt','2026-09-01T09:00:00Z'
));

DO $$
DECLARE p public.epoch_project_packages%ROWTYPE;
BEGIN
  SELECT * INTO p FROM public.epoch_project_packages WHERE project_id=101
    AND intended_cycle_id=(SELECT id FROM public.monthly_cycles WHERE cycle_key='2026-08') AND version=2;
  IF p.reconciliation_deadline_at IS NULL OR p.reconciliation_deadline_at <= p.reconciliation_email_delivered_at THEN
    RAISE EXCEPTION 'delivery_relative_deadline_missing';
  END IF;
  BEGIN
    PERFORM public.decide_epoch_project_package(jsonb_build_object(
      'deploymentEnvironment','local','packageId',p.id,'decision','opt_out','reason','Founder elected to roll forward.',
      'actorUserId','00000000-0000-4000-8000-000000000101','evidenceHash',repeat('3',64),'decidedAt','2026-09-01T10:00:00Z'
    ));
    IF NOT EXISTS(
      SELECT 1 FROM public.epoch_project_packages rolled WHERE rolled.rolled_from_package_id=p.id
        AND rolled.status='rolled_forward' AND rolled.project_fee_assessed_once AND rolled.base_fee_deferred
        AND rolled.intended_cycle_id=(SELECT id FROM public.monthly_cycles WHERE cycle_key='2026-09')
    ) THEN RAISE EXCEPTION 'opt_out_rollover_missing'; END IF;
    IF (SELECT count(*) FROM public.epoch_project_package_funding_sources source
      JOIN public.epoch_project_packages rolled ON rolled.id=source.package_id WHERE rolled.rolled_from_package_id=p.id) <> p.funding_source_count THEN
      RAISE EXCEPTION 'opt_out_source_provenance_missing';
    END IF;
    RAISE EXCEPTION 'rollback_opt_out_probe';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'rollback_opt_out_probe' THEN RAISE; END IF;
  END;
END
$$;

SELECT public.finalize_silent_epoch_project_packages(
  'local',(SELECT reconciliation_deadline_at + interval '1 second' FROM public.epoch_project_packages WHERE id=:frozen_package_id)
) AS silent_count \gset silent_

DO $$
DECLARE p public.epoch_project_packages%ROWTYPE;
BEGIN
  SELECT * INTO p FROM public.epoch_project_packages WHERE project_id=101
    AND intended_cycle_id=(SELECT id FROM public.monthly_cycles WHERE cycle_key='2026-08') AND version=2;
  IF NOT EXISTS(SELECT 1 FROM public.epoch_project_package_decision_events WHERE package_id=p.id AND decision='silent_approve')
    OR p.status <> 'silent_approved' OR p.approved_by_user_id IS NOT NULL THEN
    RAISE EXCEPTION 'silent_approval_failed';
  END IF;
  IF NOT EXISTS(SELECT 1 FROM public.epoch_project_package_lock_candidates WHERE package_id=p.id) THEN
    RAISE EXCEPTION 'approved_settled_package_missing_from_lock_candidates';
  END IF;
  IF NOT EXISTS(SELECT 1 FROM public.epoch_project_package_public_preliminary WHERE project_slug='civic-mesh' AND cycle_key='2026-08' AND preliminary_usd=990) THEN
    RAISE EXCEPTION 'public_preliminary_report_missing';
  END IF;
  IF EXISTS(
    SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='epoch_project_package_public_preliminary'
      AND column_name IN('user_id','project_pseudonym','cubid_decision','locked_cubid_score')
  ) THEN RAISE EXCEPTION 'public_report_exposes_identity_fields'; END IF;
END
$$;

DO $$
BEGIN
  BEGIN
    PERFORM public.validate_epoch_project_package(jsonb_build_object(
      'deploymentEnvironment','local','actorRole','internal_admin','actorUserId','00000000-0000-4000-8000-000000000101',
      'projectSlug','civic-mesh','cycleKey','2026-08','observedAt','2026-09-02T00:00:00Z','maximumCubidScore','20',
      'kybStatus','passed','kycStatus','passed','sanctionsStatus','passed','complianceEvidenceHash',repeat('f',64)
    ));
    RAISE EXCEPTION 'frozen_package_was_revalidated';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'epoch_project_package_frozen' THEN RAISE; END IF;
  END;
END
$$;

RESET ROLE;
ROLLBACK;
