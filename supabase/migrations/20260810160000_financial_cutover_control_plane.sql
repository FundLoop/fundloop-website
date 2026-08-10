-- Local/non-production canonical financial cutover control plane for #143.
-- This migration classifies legacy projections, posts explicitly approved opening
-- liabilities, and disables legacy writes only after an atomic service-owned
-- activation. Production, provider calls, payables, and value flow remain disabled.

CREATE TABLE public.financial_cutover_runtime_controls (
  deployment_environment text PRIMARY KEY REFERENCES public.financial_runtime_controls(deployment_environment) ON UPDATE RESTRICT ON DELETE RESTRICT,
  prepare_enabled boolean NOT NULL DEFAULT false,
  activation_enabled boolean NOT NULL DEFAULT false,
  production_value_flow_enabled boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT financial_cutover_runtime_environment_check CHECK (
    deployment_environment IN ('local','development','dev','preview','test','production')
  ),
  CONSTRAINT financial_cutover_runtime_production_closed CHECK (
    deployment_environment <> 'production'
    OR (prepare_enabled=false AND activation_enabled=false AND production_value_flow_enabled=false)
  ),
  CONSTRAINT financial_cutover_runtime_no_value_flow CHECK (production_value_flow_enabled=false)
);

INSERT INTO public.financial_cutover_runtime_controls(deployment_environment,prepare_enabled,activation_enabled) VALUES
  ('local',true,true),('development',true,true),('dev',true,true),('preview',true,true),('test',true,true),
  ('production',false,false)
ON CONFLICT(deployment_environment) DO NOTHING;

CREATE TABLE public.financial_cutover_runs (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  deployment_environment text NOT NULL REFERENCES public.financial_cutover_runtime_controls(deployment_environment) ON UPDATE RESTRICT ON DELETE RESTRICT,
  contract_version text NOT NULL DEFAULT 'financial_cutover.v1',
  idempotency_key text NOT NULL,
  command_hash text NOT NULL,
  evidence_hash text NOT NULL,
  manifest_hash text,
  status text NOT NULL DEFAULT 'preparing',
  source_count integer NOT NULL DEFAULT 0,
  blocker_count integer NOT NULL DEFAULT 0,
  warning_count integer NOT NULL DEFAULT 0,
  legacy_minor_total numeric(78,0) NOT NULL DEFAULT 0,
  canonical_minor_total numeric(78,0) NOT NULL DEFAULT 0,
  actor_user_id uuid NOT NULL REFERENCES public.users(user_id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  prepared_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  activated_at timestamptz,
  rolled_back_at timestamptz,
  production_enabled boolean NOT NULL DEFAULT false,
  UNIQUE(deployment_environment,idempotency_key),
  CONSTRAINT financial_cutover_run_contract_check CHECK(contract_version='financial_cutover.v1'),
  CONSTRAINT financial_cutover_run_key_check CHECK(idempotency_key ~ '^[a-zA-Z0-9:_-]{8,160}$'),
  CONSTRAINT financial_cutover_run_hash_check CHECK(
    command_hash ~ '^[0-9a-f]{64}$' AND evidence_hash ~ '^[0-9a-f]{64}$'
    AND (manifest_hash IS NULL OR manifest_hash ~ '^[0-9a-f]{64}$')
  ),
  CONSTRAINT financial_cutover_run_status_check CHECK(status IN('preparing','prepared','active','rolled_back','superseded')),
  CONSTRAINT financial_cutover_run_counts_check CHECK(source_count>=0 AND blocker_count>=0 AND warning_count>=0),
  CONSTRAINT financial_cutover_run_amounts_check CHECK(legacy_minor_total>=0 AND canonical_minor_total>=0),
  CONSTRAINT financial_cutover_run_state_check CHECK(
    (status IN('preparing','prepared') AND activated_at IS NULL AND rolled_back_at IS NULL)
    OR (status='active' AND activated_at IS NOT NULL AND rolled_back_at IS NULL)
    OR (status='rolled_back' AND activated_at IS NOT NULL AND rolled_back_at IS NOT NULL)
    OR status='superseded'
  ),
  CONSTRAINT financial_cutover_run_production_disabled CHECK(production_enabled=false)
);
CREATE INDEX financial_cutover_runs_environment_status_idx
  ON public.financial_cutover_runs(deployment_environment,status,prepared_at DESC,id);
CREATE INDEX financial_cutover_runs_actor_idx ON public.financial_cutover_runs(actor_user_id,prepared_at DESC,id);

CREATE TABLE public.financial_cutover_source_records (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  run_id bigint NOT NULL REFERENCES public.financial_cutover_runs(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  source_type text NOT NULL,
  source_id text NOT NULL,
  classification text NOT NULL,
  source_hash text NOT NULL,
  classification_evidence_hash text NOT NULL,
  monthly_cycle_id bigint REFERENCES public.monthly_cycles(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  project_id bigint REFERENCES public.projects(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  user_id uuid REFERENCES public.users(user_id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  legacy_minor numeric(78,0),
  currency_code text,
  source_snapshot jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE(run_id,source_type,source_id),
  CONSTRAINT financial_cutover_source_type_check CHECK(source_type IN(
    'payment','monthly_cycle','bookkeeping_credit','withdrawal_request','payout_intent'
  )),
  CONSTRAINT financial_cutover_source_id_check CHECK(source_id ~ '^[A-Za-z0-9:_-]+$'),
  CONSTRAINT financial_cutover_source_classification_check CHECK(classification IN(
    'externally_verified','approved_opening_balance','legacy_unverified','reversed_voided'
  )),
  CONSTRAINT financial_cutover_source_hashes_check CHECK(
    source_hash ~ '^[0-9a-f]{64}$' AND classification_evidence_hash ~ '^[0-9a-f]{64}$'
  ),
  CONSTRAINT financial_cutover_source_amount_check CHECK(legacy_minor IS NULL OR legacy_minor>=0),
  CONSTRAINT financial_cutover_source_currency_check CHECK(currency_code IS NULL OR currency_code ~ '^[A-Z]{3,12}$'),
  CONSTRAINT financial_cutover_source_snapshot_check CHECK(jsonb_typeof(source_snapshot)='object')
);
CREATE INDEX financial_cutover_source_run_class_idx
  ON public.financial_cutover_source_records(run_id,classification,source_type,id);
CREATE INDEX financial_cutover_source_cycle_idx
  ON public.financial_cutover_source_records(monthly_cycle_id,source_type,id) WHERE monthly_cycle_id IS NOT NULL;
CREATE INDEX financial_cutover_source_project_idx
  ON public.financial_cutover_source_records(project_id,source_type,id) WHERE project_id IS NOT NULL;
CREATE INDEX financial_cutover_source_user_idx
  ON public.financial_cutover_source_records(user_id,source_type,id) WHERE user_id IS NOT NULL;

CREATE TABLE public.financial_cutover_differences (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  run_id bigint NOT NULL REFERENCES public.financial_cutover_runs(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  source_record_id bigint NOT NULL REFERENCES public.financial_cutover_source_records(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  severity text NOT NULL,
  difference_type text NOT NULL,
  legacy_minor numeric(78,0),
  canonical_minor numeric(78,0),
  difference_minor numeric(78,0),
  detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE(run_id,source_record_id,difference_type),
  CONSTRAINT financial_cutover_difference_severity_check CHECK(severity IN('warning','blocker')),
  CONSTRAINT financial_cutover_difference_type_check CHECK(difference_type ~ '^[a-z][a-z0-9:_-]*$'),
  CONSTRAINT financial_cutover_difference_amount_check CHECK(
    (legacy_minor IS NULL AND canonical_minor IS NULL AND difference_minor IS NULL)
    OR (legacy_minor IS NOT NULL AND canonical_minor IS NOT NULL AND difference_minor=legacy_minor-canonical_minor)
  ),
  CONSTRAINT financial_cutover_difference_detail_check CHECK(jsonb_typeof(detail)='object')
);
CREATE INDEX financial_cutover_differences_run_severity_idx
  ON public.financial_cutover_differences(run_id,severity,difference_type,id);
CREATE INDEX financial_cutover_differences_source_idx ON public.financial_cutover_differences(source_record_id);

CREATE TABLE public.financial_cutover_canonical_links (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  run_id bigint NOT NULL REFERENCES public.financial_cutover_runs(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  source_record_id bigint NOT NULL REFERENCES public.financial_cutover_source_records(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  canonical_type text NOT NULL,
  canonical_id text NOT NULL,
  ledger_transaction_id bigint REFERENCES public.ledger_transactions(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  withdrawal_obligation_id bigint REFERENCES public.user_withdrawal_obligations(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  evidence_hash text NOT NULL,
  linked_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE(run_id,source_record_id,canonical_type),
  CONSTRAINT financial_cutover_link_type_check CHECK(canonical_type IN(
    'epoch_project_package','epoch_close_package','withdrawal_obligation','withdrawal_request','payout_intent'
  )),
  CONSTRAINT financial_cutover_link_id_check CHECK(canonical_id ~ '^[A-Za-z0-9:_-]+$'),
  CONSTRAINT financial_cutover_link_hash_check CHECK(evidence_hash ~ '^[0-9a-f]{64}$'),
  CONSTRAINT financial_cutover_link_shape_check CHECK(
    (canonical_type='withdrawal_obligation' AND withdrawal_obligation_id IS NOT NULL)
    OR (canonical_type<>'withdrawal_obligation' AND withdrawal_obligation_id IS NULL)
  )
);
CREATE INDEX financial_cutover_links_run_type_idx ON public.financial_cutover_canonical_links(run_id,canonical_type,id);
CREATE INDEX financial_cutover_links_source_idx ON public.financial_cutover_canonical_links(source_record_id);
CREATE INDEX financial_cutover_links_ledger_idx ON public.financial_cutover_canonical_links(ledger_transaction_id) WHERE ledger_transaction_id IS NOT NULL;
CREATE INDEX financial_cutover_links_obligation_idx ON public.financial_cutover_canonical_links(withdrawal_obligation_id) WHERE withdrawal_obligation_id IS NOT NULL;

CREATE TABLE public.financial_cutover_state_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  run_id bigint NOT NULL REFERENCES public.financial_cutover_runs(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  event_type text NOT NULL,
  actor_user_id uuid NOT NULL REFERENCES public.users(user_id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  evidence_hash text NOT NULL,
  detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT financial_cutover_event_type_check CHECK(event_type IN('prepared','activated','rolled_back','superseded')),
  CONSTRAINT financial_cutover_event_hash_check CHECK(evidence_hash ~ '^[0-9a-f]{64}$'),
  CONSTRAINT financial_cutover_event_detail_check CHECK(jsonb_typeof(detail)='object')
);
CREATE INDEX financial_cutover_events_run_idx ON public.financial_cutover_state_events(run_id,recorded_at,id);
CREATE INDEX financial_cutover_events_actor_idx ON public.financial_cutover_state_events(actor_user_id,recorded_at DESC,id);

CREATE TABLE public.financial_cutover_instance_state (
  singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),
  active_run_id bigint REFERENCES public.financial_cutover_runs(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  deployment_environment text NOT NULL DEFAULT 'production' REFERENCES public.financial_cutover_runtime_controls(deployment_environment) ON UPDATE RESTRICT ON DELETE RESTRICT,
  canonical_reads_enabled boolean NOT NULL DEFAULT false,
  legacy_writes_enabled boolean NOT NULL DEFAULT true,
  production_value_flow_enabled boolean NOT NULL DEFAULT false,
  state_version bigint NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT financial_cutover_instance_shape_check CHECK(
    (active_run_id IS NULL AND canonical_reads_enabled=false AND legacy_writes_enabled=true)
    OR (active_run_id IS NOT NULL AND canonical_reads_enabled=true AND legacy_writes_enabled=false)
  ),
  CONSTRAINT financial_cutover_instance_production_closed CHECK(
    deployment_environment<>'production'
    OR (active_run_id IS NULL AND canonical_reads_enabled=false AND legacy_writes_enabled=true AND production_value_flow_enabled=false)
  ),
  CONSTRAINT financial_cutover_instance_no_value_flow CHECK(production_value_flow_enabled=false),
  CONSTRAINT financial_cutover_instance_version_check CHECK(state_version>=0)
);
INSERT INTO public.financial_cutover_instance_state(singleton) VALUES(true) ON CONFLICT(singleton) DO NOTHING;

INSERT INTO public.ledger_accounts(account_key,normal_balance,provisional_classification_key,required_dimensions)
VALUES
  ('legacy_opening_balance_control','debit','asset:legacy_opening_balance','[]'::jsonb),
  ('user_withdrawal_liability_control','credit','liability:user_withdrawal','["user"]'::jsonb)
ON CONFLICT(account_key) DO NOTHING;

CREATE FUNCTION public.financial_cutover_runtime_enabled(p_environment text,p_capability text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
  SELECT lower(coalesce(p_environment,''))<>'production' AND EXISTS(
    SELECT 1 FROM public.financial_cutover_runtime_controls control
    WHERE control.deployment_environment=lower(p_environment)
      AND NOT control.production_value_flow_enabled
      AND CASE p_capability WHEN 'prepare' THEN control.prepare_enabled WHEN 'activate' THEN control.activation_enabled ELSE false END
  );
$$;

CREATE FUNCTION public.prevent_cutover_audit_mutation()
RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN RAISE EXCEPTION 'financial_cutover_audit_append_only'; END; $$;

CREATE TRIGGER financial_cutover_source_append_only BEFORE UPDATE OR DELETE ON public.financial_cutover_source_records
FOR EACH ROW EXECUTE FUNCTION public.prevent_cutover_audit_mutation();
CREATE TRIGGER financial_cutover_difference_append_only BEFORE UPDATE OR DELETE ON public.financial_cutover_differences
FOR EACH ROW EXECUTE FUNCTION public.prevent_cutover_audit_mutation();
CREATE TRIGGER financial_cutover_link_append_only BEFORE UPDATE OR DELETE ON public.financial_cutover_canonical_links
FOR EACH ROW EXECUTE FUNCTION public.prevent_cutover_audit_mutation();
CREATE TRIGGER financial_cutover_event_append_only BEFORE UPDATE OR DELETE ON public.financial_cutover_state_events
FOR EACH ROW EXECUTE FUNCTION public.prevent_cutover_audit_mutation();

CREATE FUNCTION public.financial_cutover_current_source_hash(p_source_type text,p_source_id text)
RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE v_hash text;
BEGIN
  IF p_source_type='payment' THEN
    SELECT encode(extensions.digest(pg_catalog.convert_to(jsonb_build_object('id',payment.id,'projectId',payment.project_id,
      'cycleId',payment.monthly_cycle_id,'amount',payment.payment_amount::text,'status',payment.status::text,
      'statusId',payment.status_id,'deletedAt',payment.deleted_at)::text,'UTF8'),'sha256'),'hex') INTO v_hash
    FROM public.payments payment WHERE payment.id=p_source_id::bigint;
  ELSIF p_source_type='monthly_cycle' THEN
    SELECT encode(extensions.digest(pg_catalog.convert_to(jsonb_build_object('id',cycle.id,'cycleKey',cycle.cycle_key,
      'status',cycle.status::text,'periodStart',cycle.period_start,'periodEnd',cycle.period_end)::text,'UTF8'),'sha256'),'hex') INTO v_hash
    FROM public.monthly_cycles cycle WHERE cycle.id=p_source_id::bigint;
  ELSIF p_source_type='bookkeeping_credit' THEN
    SELECT encode(extensions.digest(pg_catalog.convert_to(jsonb_build_object('id',credit.id,'cycleId',credit.monthly_cycle_id,
      'userId',credit.user_id,'amount',credit.usd_equivalent_amount::text,'currency',credit.currency_code,
      'status',credit.status,'paymentStatus',credit.payment_status,'idempotencyKey',credit.idempotency_key)::text,'UTF8'),'sha256'),'hex') INTO v_hash
    FROM public.monthly_cycle_bookkeeping_credits credit WHERE credit.id=p_source_id::bigint;
  ELSIF p_source_type='withdrawal_request' THEN
    SELECT encode(extensions.digest(pg_catalog.convert_to(jsonb_build_object('id',request.id,'userId',request.user_id,
      'projectId',request.project_id,'status',request.status,'requestedMinor',request.requested_minor,
      'currency',request.currency_code,'requestHash',request.request_hash)::text,'UTF8'),'sha256'),'hex') INTO v_hash
    FROM public.user_withdrawal_requests request WHERE request.id=p_source_id::uuid;
  ELSIF p_source_type='payout_intent' THEN
    SELECT encode(extensions.digest(pg_catalog.convert_to(jsonb_build_object('id',intent.id,'cycleId',intent.monthly_cycle_id,
      'userId',intent.user_id,'status',intent.status::text,'amountUsd',intent.amount_usd::text,
      'withdrawalRequestId',intent.withdrawal_request_id,'sourceResultId',intent.source_result_id)::text,'UTF8'),'sha256'),'hex') INTO v_hash
    FROM public.payout_intents intent WHERE intent.id=p_source_id::bigint;
  ELSE RAISE EXCEPTION 'financial_cutover_source_type_invalid'; END IF;
  RETURN v_hash;
END; $$;

CREATE FUNCTION public.prepare_financial_cutover(p_actor_user_id uuid,p_command jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  v_environment text:=lower(trim(p_command->>'deploymentEnvironment'));
  v_key text:=btrim(p_command->>'idempotencyKey');
  v_evidence text:=p_command->>'evidenceHash';
  v_command_hash text:=encode(extensions.digest(pg_catalog.convert_to(p_command::text,'UTF8'),'sha256'),'hex');
  v_run public.financial_cutover_runs%ROWTYPE;
  v_manifest_hash text;
BEGIN
  IF p_command->>'contractVersion'<>'financial_cutover_prepare.v1'
    OR NOT public.financial_cutover_runtime_enabled(v_environment,'prepare')
    OR v_key IS NULL OR v_key !~ '^[a-zA-Z0-9:_-]{8,160}$'
    OR v_evidence !~ '^[0-9a-f]{64}$'
    OR jsonb_typeof(coalesce(p_command->'approvedOpeningBalances','[]'::jsonb))<>'array'
    OR jsonb_array_length(coalesce(p_command->'approvedOpeningBalances','[]'::jsonb))>500
  THEN RAISE EXCEPTION 'financial_cutover_contract_invalid'; END IF;
  IF EXISTS(
    SELECT 1 FROM jsonb_to_recordset(coalesce(p_command->'approvedOpeningBalances','[]'::jsonb))
      AS approval("sourceType" text,"sourceId" text,"evidenceHash" text)
    WHERE approval."sourceType"<>'bookkeeping_credit' OR approval."sourceId" !~ '^[0-9]+$'
      OR approval."evidenceHash" !~ '^[0-9a-f]{64}$'
  ) THEN RAISE EXCEPTION 'financial_cutover_opening_approval_invalid'; END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('financial-cutover:'||v_environment,0));
  SELECT * INTO v_run FROM public.financial_cutover_runs
    WHERE deployment_environment=v_environment AND idempotency_key=v_key;
  IF FOUND THEN
    IF v_run.command_hash<>v_command_hash THEN RAISE EXCEPTION 'financial_cutover_idempotency_conflict'; END IF;
    RETURN jsonb_build_object('runId',v_run.id,'status',v_run.status,'manifestHash',v_run.manifest_hash,
      'sourceCount',v_run.source_count,'blockerCount',v_run.blocker_count,'warningCount',v_run.warning_count,'noValueTransferred',true);
  END IF;

  INSERT INTO public.financial_cutover_runs(deployment_environment,idempotency_key,command_hash,evidence_hash,actor_user_id)
  VALUES(v_environment,v_key,v_command_hash,v_evidence,p_actor_user_id) RETURNING * INTO v_run;

  INSERT INTO public.financial_cutover_source_records(run_id,source_type,source_id,classification,source_hash,
    classification_evidence_hash,monthly_cycle_id,project_id,legacy_minor,currency_code,source_snapshot)
  SELECT v_run.id,'payment',payment.id::text,
    CASE WHEN payment.deleted_at IS NOT NULL OR payment.status::text<>'active' THEN 'reversed_voided'
      WHEN EXISTS(SELECT 1 FROM public.epoch_project_package_payments link JOIN public.epoch_project_packages package ON package.id=link.package_id
        WHERE link.payment_id=payment.id AND package.funding_status='settled' AND package.status IN('approved','silent_approved')) THEN 'externally_verified'
      ELSE 'legacy_unverified' END,
    encode(extensions.digest(pg_catalog.convert_to(jsonb_build_object('id',payment.id,'projectId',payment.project_id,
      'cycleId',payment.monthly_cycle_id,'amount',payment.payment_amount::text,'status',payment.status::text,
      'statusId',payment.status_id,'deletedAt',payment.deleted_at)::text,'UTF8'),'sha256'),'hex'),
    CASE WHEN payment.deleted_at IS NOT NULL OR payment.status::text<>'active' THEN v_evidence
      ELSE coalesce((SELECT package.manifest_hash FROM public.epoch_project_package_payments link
        JOIN public.epoch_project_packages package ON package.id=link.package_id
        WHERE link.payment_id=payment.id AND package.funding_status='settled' AND package.status IN('approved','silent_approved')
        ORDER BY package.version DESC,package.id DESC LIMIT 1),v_evidence) END,
    payment.monthly_cycle_id,payment.project_id,round(payment.payment_amount*100), 'USD',
    jsonb_build_object('status',payment.status::text,'statusId',payment.status_id,'deleted',payment.deleted_at IS NOT NULL)
  FROM public.payments payment;

  INSERT INTO public.financial_cutover_source_records(run_id,source_type,source_id,classification,source_hash,
    classification_evidence_hash,monthly_cycle_id,source_snapshot)
  SELECT v_run.id,'monthly_cycle',cycle.id::text,
    CASE WHEN EXISTS(SELECT 1 FROM public.epoch_close_packages package WHERE package.monthly_cycle_id=cycle.id)
      THEN 'externally_verified' ELSE 'legacy_unverified' END,
    encode(extensions.digest(pg_catalog.convert_to(jsonb_build_object('id',cycle.id,'cycleKey',cycle.cycle_key,
      'status',cycle.status::text,'periodStart',cycle.period_start,'periodEnd',cycle.period_end)::text,'UTF8'),'sha256'),'hex'),
    coalesce((SELECT package.root_hash FROM public.epoch_close_packages package WHERE package.monthly_cycle_id=cycle.id),v_evidence),
    cycle.id,jsonb_build_object('cycleKey',cycle.cycle_key,'status',cycle.status::text)
  FROM public.monthly_cycles cycle;

  INSERT INTO public.financial_cutover_source_records(run_id,source_type,source_id,classification,source_hash,
    classification_evidence_hash,monthly_cycle_id,user_id,legacy_minor,currency_code,source_snapshot)
  SELECT v_run.id,'bookkeeping_credit',credit.id::text,
    CASE WHEN credit.status='voided' THEN 'reversed_voided'
      WHEN EXISTS(SELECT 1 FROM public.user_withdrawal_obligations obligation WHERE obligation.source_bookkeeping_credit_id=credit.id)
        THEN 'externally_verified'
      WHEN approval."sourceId" IS NOT NULL THEN 'approved_opening_balance'
      ELSE 'legacy_unverified' END,
    encode(extensions.digest(pg_catalog.convert_to(jsonb_build_object('id',credit.id,'cycleId',credit.monthly_cycle_id,
      'userId',credit.user_id,'amount',credit.usd_equivalent_amount::text,'currency',credit.currency_code,
      'status',credit.status,'paymentStatus',credit.payment_status,'idempotencyKey',credit.idempotency_key)::text,'UTF8'),'sha256'),'hex'),
    coalesce(approval."evidenceHash",(SELECT obligation.evidence_hash FROM public.user_withdrawal_obligations obligation
      WHERE obligation.source_bookkeeping_credit_id=credit.id),v_evidence),credit.monthly_cycle_id,credit.user_id,
    round(credit.usd_equivalent_amount*100),credit.currency_code,
    jsonb_build_object('status',credit.status,'paymentStatus',credit.payment_status,'amountUsd',credit.usd_equivalent_amount::text)
  FROM public.monthly_cycle_bookkeeping_credits credit
  LEFT JOIN jsonb_to_recordset(coalesce(p_command->'approvedOpeningBalances','[]'::jsonb))
    AS approval("sourceType" text,"sourceId" text,"evidenceHash" text)
    ON approval."sourceType"='bookkeeping_credit' AND approval."sourceId"=credit.id::text;

  INSERT INTO public.financial_cutover_source_records(run_id,source_type,source_id,classification,source_hash,
    classification_evidence_hash,monthly_cycle_id,project_id,user_id,legacy_minor,currency_code,source_snapshot)
  SELECT v_run.id,'withdrawal_request',request.id::text,
    CASE WHEN request.status IN('cancelled','closed') THEN 'reversed_voided'
      WHEN request.request_hash IS NOT NULL AND request.project_id IS NOT NULL AND request.financial_asset_id IS NOT NULL
        AND EXISTS(SELECT 1 FROM public.user_withdrawal_obligation_claims claim WHERE claim.withdrawal_request_id=request.id)
        THEN 'externally_verified' ELSE 'legacy_unverified' END,
    encode(extensions.digest(pg_catalog.convert_to(jsonb_build_object('id',request.id,'userId',request.user_id,
      'projectId',request.project_id,'status',request.status,'requestedMinor',request.requested_minor,
      'currency',request.currency_code,'requestHash',request.request_hash)::text,'UTF8'),'sha256'),'hex'),
    coalesce(request.request_hash,v_evidence),
    coalesce(request.queue_for_cycle_id,(SELECT min(obligation.monthly_cycle_id) FROM public.user_withdrawal_obligation_claims claim
      JOIN public.user_withdrawal_obligations obligation ON obligation.id=claim.obligation_id WHERE claim.withdrawal_request_id=request.id)),
    request.project_id,request.user_id,coalesce(request.requested_minor,round(request.requested_usd_amount*100)),request.currency_code,
    jsonb_build_object('status',request.status,'railKey',request.rail_key,'requestHash',request.request_hash)
  FROM public.user_withdrawal_requests request;

  INSERT INTO public.financial_cutover_source_records(run_id,source_type,source_id,classification,source_hash,
    classification_evidence_hash,monthly_cycle_id,user_id,legacy_minor,currency_code,source_snapshot)
  SELECT v_run.id,'payout_intent',intent.id::text,
    CASE WHEN intent.status IN('cancelled','failed') THEN 'reversed_voided'
      WHEN intent.withdrawal_request_id IS NOT NULL AND intent.source_result_id IS NULL THEN 'externally_verified'
      ELSE 'legacy_unverified' END,
    encode(extensions.digest(pg_catalog.convert_to(jsonb_build_object('id',intent.id,'cycleId',intent.monthly_cycle_id,
      'userId',intent.user_id,'status',intent.status::text,'amountUsd',intent.amount_usd::text,
      'withdrawalRequestId',intent.withdrawal_request_id,'sourceResultId',intent.source_result_id)::text,'UTF8'),'sha256'),'hex'),
    coalesce((SELECT request.request_hash FROM public.user_withdrawal_requests request WHERE request.id=intent.withdrawal_request_id),v_evidence),
    intent.monthly_cycle_id,intent.user_id,round(intent.amount_usd*100),intent.currency_code,
    jsonb_build_object('status',intent.status::text,'withdrawalRequestId',intent.withdrawal_request_id,
      'sourceResultId',intent.source_result_id,'idempotencyKey',intent.idempotency_key)
  FROM public.payout_intents intent;

  INSERT INTO public.financial_cutover_differences(run_id,source_record_id,severity,difference_type,
    legacy_minor,canonical_minor,difference_minor,detail)
  SELECT record.run_id,record.id,
    CASE WHEN record.source_type IN('bookkeeping_credit','withdrawal_request','payout_intent') THEN 'blocker' ELSE 'warning' END,
    'legacy_unverified_excluded',record.legacy_minor,
    CASE WHEN record.legacy_minor IS NULL THEN NULL ELSE 0 END,record.legacy_minor,
    jsonb_build_object('classification',record.classification,'sourceType',record.source_type)
  FROM public.financial_cutover_source_records record
  WHERE record.run_id=v_run.id AND record.classification='legacy_unverified';

  INSERT INTO public.financial_cutover_differences(run_id,source_record_id,severity,difference_type,
    legacy_minor,canonical_minor,difference_minor,detail)
  SELECT record.run_id,record.id,'blocker','canonical_amount_mismatch',record.legacy_minor,canonical.canonical_minor,
    record.legacy_minor-canonical.canonical_minor,jsonb_build_object('sourceType',record.source_type)
  FROM public.financial_cutover_source_records record
  CROSS JOIN LATERAL (
    SELECT CASE record.source_type
      WHEN 'bookkeeping_credit' THEN coalesce((SELECT obligation.total_minor FROM public.user_withdrawal_obligations obligation
        WHERE obligation.source_bookkeeping_credit_id=record.source_id::bigint),record.legacy_minor)
      WHEN 'withdrawal_request' THEN coalesce((SELECT sum(claim.claimed_minor) FROM public.user_withdrawal_obligation_claims claim
        WHERE claim.withdrawal_request_id=record.source_id::uuid),0)
      WHEN 'payout_intent' THEN coalesce((SELECT request.net_minor FROM public.payout_intents intent
        JOIN public.user_withdrawal_requests request ON request.id=intent.withdrawal_request_id
        WHERE intent.id=record.source_id::bigint),0)
      ELSE record.legacy_minor END AS canonical_minor
  ) canonical
  WHERE record.run_id=v_run.id AND record.classification IN('externally_verified','approved_opening_balance')
    AND record.legacy_minor IS NOT NULL AND record.legacy_minor IS DISTINCT FROM canonical.canonical_minor;

  INSERT INTO public.financial_cutover_differences(run_id,source_record_id,severity,difference_type,
    legacy_minor,canonical_minor,difference_minor,detail)
  SELECT record.run_id,record.id,'blocker','opening_balance_sub_minor_requires_resolution',record.legacy_minor,record.legacy_minor,0,
    jsonb_build_object('amountUsd',record.source_snapshot->>'amountUsd')
  FROM public.financial_cutover_source_records record
  WHERE record.run_id=v_run.id AND record.classification='approved_opening_balance'
    AND ((record.source_snapshot->>'amountUsd')::numeric*100)<>record.legacy_minor;

  SELECT encode(extensions.digest(pg_catalog.convert_to(coalesce(jsonb_agg(jsonb_build_object(
    'sourceType',record.source_type,'sourceId',record.source_id,'classification',record.classification,
    'sourceHash',record.source_hash,'classificationEvidenceHash',record.classification_evidence_hash)
    ORDER BY record.source_type,record.source_id),'[]'::jsonb)::text,'UTF8'),'sha256'),'hex')
  INTO v_manifest_hash FROM public.financial_cutover_source_records record WHERE record.run_id=v_run.id;

  UPDATE public.financial_cutover_runs run SET status='prepared',manifest_hash=v_manifest_hash,
    source_count=(SELECT count(*) FROM public.financial_cutover_source_records record WHERE record.run_id=v_run.id),
    blocker_count=(SELECT count(*) FROM public.financial_cutover_differences difference WHERE difference.run_id=v_run.id AND difference.severity='blocker'),
    warning_count=(SELECT count(*) FROM public.financial_cutover_differences difference WHERE difference.run_id=v_run.id AND difference.severity='warning'),
    legacy_minor_total=coalesce((SELECT sum(record.legacy_minor) FROM public.financial_cutover_source_records record
      WHERE record.run_id=v_run.id AND record.source_type='bookkeeping_credit' AND record.classification<>'reversed_voided'),0),
    canonical_minor_total=coalesce((SELECT sum(record.legacy_minor) FROM public.financial_cutover_source_records record
      WHERE record.run_id=v_run.id AND record.source_type='bookkeeping_credit' AND record.classification IN('externally_verified','approved_opening_balance')),0)
  WHERE run.id=v_run.id RETURNING * INTO v_run;
  INSERT INTO public.financial_cutover_state_events(run_id,event_type,actor_user_id,evidence_hash,detail)
  VALUES(v_run.id,'prepared',p_actor_user_id,v_evidence,jsonb_build_object('manifestHash',v_manifest_hash,'blockerCount',v_run.blocker_count));
  RETURN jsonb_build_object('runId',v_run.id,'status',v_run.status,'manifestHash',v_run.manifest_hash,
    'sourceCount',v_run.source_count,'blockerCount',v_run.blocker_count,'warningCount',v_run.warning_count,'noValueTransferred',true);
END; $$;

CREATE FUNCTION public.activate_financial_cutover(p_actor_user_id uuid,p_command jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  v_environment text:=lower(trim(p_command->>'deploymentEnvironment'));
  v_run public.financial_cutover_runs%ROWTYPE;
  v_record record;
  v_cycle public.monthly_cycles%ROWTYPE;
  v_period_key text;
  v_ledger_id bigint;
  v_obligation_id bigint;
  v_evidence text:=p_command->>'evidenceHash';
  v_current_hash text;
BEGIN
  IF p_command->>'contractVersion'<>'financial_cutover_activate.v1'
    OR NOT public.financial_cutover_runtime_enabled(v_environment,'activate')
    OR v_evidence !~ '^[0-9a-f]{64}$'
  THEN RAISE EXCEPTION 'financial_cutover_contract_invalid'; END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('financial-cutover-instance',0));
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('financial-cutover:'||v_environment,0));
  SELECT * INTO v_run FROM public.financial_cutover_runs
    WHERE id=(p_command->>'runId')::bigint FOR UPDATE;
  IF v_run.id IS NULL OR v_run.deployment_environment<>v_environment OR v_run.status NOT IN('prepared','active')
    OR v_run.manifest_hash<>p_command->>'manifestHash' THEN RAISE EXCEPTION 'financial_cutover_run_mismatch'; END IF;
  IF v_run.status='active' THEN
    RETURN jsonb_build_object('runId',v_run.id,'status','active','manifestHash',v_run.manifest_hash,'noValueTransferred',true);
  END IF;
  IF v_run.blocker_count<>0 OR EXISTS(SELECT 1 FROM public.financial_cutover_differences difference
    WHERE difference.run_id=v_run.id AND difference.severity='blocker') THEN RAISE EXCEPTION 'financial_cutover_blockers_unresolved'; END IF;

  LOCK TABLE public.payments,public.monthly_cycles,public.monthly_cycle_bookkeeping_credits,
    public.user_withdrawal_requests,public.payout_intents IN SHARE ROW EXCLUSIVE MODE;
  IF (SELECT count(*) FROM public.financial_cutover_source_records WHERE run_id=v_run.id AND source_type='payment')<>(SELECT count(*) FROM public.payments)
    OR (SELECT count(*) FROM public.financial_cutover_source_records WHERE run_id=v_run.id AND source_type='monthly_cycle')<>(SELECT count(*) FROM public.monthly_cycles)
    OR (SELECT count(*) FROM public.financial_cutover_source_records WHERE run_id=v_run.id AND source_type='bookkeeping_credit')<>(SELECT count(*) FROM public.monthly_cycle_bookkeeping_credits)
    OR (SELECT count(*) FROM public.financial_cutover_source_records WHERE run_id=v_run.id AND source_type='withdrawal_request')<>(SELECT count(*) FROM public.user_withdrawal_requests)
    OR (SELECT count(*) FROM public.financial_cutover_source_records WHERE run_id=v_run.id AND source_type='payout_intent')<>(SELECT count(*) FROM public.payout_intents)
  THEN RAISE EXCEPTION 'financial_cutover_source_drift'; END IF;
  FOR v_record IN SELECT record.* FROM public.financial_cutover_source_records record WHERE record.run_id=v_run.id ORDER BY record.source_type,record.source_id
  LOOP
    v_current_hash:=public.financial_cutover_current_source_hash(v_record.source_type,v_record.source_id);
    IF v_current_hash IS NULL OR v_current_hash<>v_record.source_hash THEN RAISE EXCEPTION 'financial_cutover_source_drift'; END IF;
  END LOOP;

  FOR v_record IN SELECT record.* FROM public.financial_cutover_source_records record
    WHERE record.run_id=v_run.id AND record.source_type='bookkeeping_credit'
      AND record.classification IN('externally_verified','approved_opening_balance') ORDER BY record.source_id::bigint
  LOOP
    IF v_record.classification='approved_opening_balance' THEN
      SELECT * INTO v_cycle FROM public.monthly_cycles WHERE id=v_record.monthly_cycle_id;
      v_period_key:='cutover_'||replace(v_cycle.cycle_key,'-','_');
      INSERT INTO public.accounting_periods(period_key,starts_at,ends_at,timezone_name)
      VALUES(v_period_key,v_cycle.period_start::timestamp AT TIME ZONE 'America/Los_Angeles',
        (v_cycle.period_end+1)::timestamp AT TIME ZONE 'America/Los_Angeles','America/Los_Angeles')
      ON CONFLICT(period_key) DO NOTHING;
      v_ledger_id:=public.post_neutral_ledger_transaction(jsonb_build_object(
        'contractVersion','ledger_post.v1','deploymentEnvironment',v_environment,
        'periodKey',v_period_key,'transactionType','legacy_opening_balance',
        'idempotencyKey','cutover-opening-credit:'||v_record.source_id,
        'evidenceHash',v_record.classification_evidence_hash,'actorType','operator','actorUserId',p_actor_user_id,
        'effectiveAt',v_cycle.period_start::timestamp AT TIME ZONE 'America/Los_Angeles',
        'postings',jsonb_build_array(
          jsonb_build_object('accountKey','legacy_opening_balance_control','side','debit','functionalUsdAmount',(v_record.legacy_minor/100)::text),
          jsonb_build_object('accountKey','user_withdrawal_liability_control','side','credit','functionalUsdAmount',(v_record.legacy_minor/100)::text,'userId',v_record.user_id)
        )
      ));
      INSERT INTO public.user_withdrawal_obligations(source_bookkeeping_credit_id,monthly_cycle_id,user_id,total_minor,evidence_hash)
      VALUES(v_record.source_id::bigint,v_record.monthly_cycle_id,v_record.user_id,v_record.legacy_minor,v_record.classification_evidence_hash)
      ON CONFLICT(source_bookkeeping_credit_id) DO UPDATE SET source_bookkeeping_credit_id=EXCLUDED.source_bookkeeping_credit_id
      RETURNING id INTO v_obligation_id;
    ELSE
      SELECT obligation.id INTO v_obligation_id FROM public.user_withdrawal_obligations obligation
      WHERE obligation.source_bookkeeping_credit_id=v_record.source_id::bigint;
      SELECT transaction_row.id INTO v_ledger_id FROM public.ledger_transactions transaction_row
      WHERE transaction_row.idempotency_key='cutover-opening-credit:'||v_record.source_id;
    END IF;
    INSERT INTO public.financial_cutover_canonical_links(run_id,source_record_id,canonical_type,canonical_id,
      ledger_transaction_id,withdrawal_obligation_id,evidence_hash)
    VALUES(v_run.id,v_record.id,'withdrawal_obligation',v_obligation_id::text,v_ledger_id,v_obligation_id,v_record.classification_evidence_hash)
    ON CONFLICT(run_id,source_record_id,canonical_type) DO NOTHING;
  END LOOP;

  INSERT INTO public.financial_cutover_canonical_links(run_id,source_record_id,canonical_type,canonical_id,evidence_hash)
  SELECT v_run.id,record.id,'epoch_project_package',package.id::text,record.classification_evidence_hash
  FROM public.financial_cutover_source_records record
  JOIN public.epoch_project_package_payments payment_link ON payment_link.payment_id=record.source_id::bigint
  JOIN public.epoch_project_packages package ON package.id=payment_link.package_id
  WHERE record.run_id=v_run.id AND record.source_type='payment' AND record.classification='externally_verified'
    AND package.funding_status='settled' AND package.status IN('approved','silent_approved')
  ON CONFLICT(run_id,source_record_id,canonical_type) DO NOTHING;

  INSERT INTO public.financial_cutover_canonical_links(run_id,source_record_id,canonical_type,canonical_id,evidence_hash)
  SELECT v_run.id,record.id,'epoch_close_package',package.id::text,record.classification_evidence_hash
  FROM public.financial_cutover_source_records record JOIN public.epoch_close_packages package ON package.monthly_cycle_id=record.source_id::bigint
  WHERE record.run_id=v_run.id AND record.source_type='monthly_cycle' AND record.classification='externally_verified'
  ON CONFLICT(run_id,source_record_id,canonical_type) DO NOTHING;

  INSERT INTO public.financial_cutover_canonical_links(run_id,source_record_id,canonical_type,canonical_id,evidence_hash)
  SELECT v_run.id,record.id,'withdrawal_request',record.source_id,record.classification_evidence_hash
  FROM public.financial_cutover_source_records record
  WHERE record.run_id=v_run.id AND record.source_type='withdrawal_request' AND record.classification='externally_verified'
  ON CONFLICT(run_id,source_record_id,canonical_type) DO NOTHING;

  INSERT INTO public.financial_cutover_canonical_links(run_id,source_record_id,canonical_type,canonical_id,evidence_hash)
  SELECT v_run.id,record.id,'payout_intent',record.source_id,record.classification_evidence_hash
  FROM public.financial_cutover_source_records record
  WHERE record.run_id=v_run.id AND record.source_type='payout_intent' AND record.classification='externally_verified'
  ON CONFLICT(run_id,source_record_id,canonical_type) DO NOTHING;

  UPDATE public.financial_cutover_runs SET status='superseded'
  WHERE deployment_environment=v_environment AND status='active' AND id<>v_run.id;
  UPDATE public.financial_cutover_runs SET status='active',activated_at=clock_timestamp() WHERE id=v_run.id RETURNING * INTO v_run;
  UPDATE public.financial_cutover_instance_state SET active_run_id=v_run.id,deployment_environment=v_environment,
    canonical_reads_enabled=true,legacy_writes_enabled=false,state_version=state_version+1,updated_at=clock_timestamp()
  WHERE singleton;
  INSERT INTO public.financial_cutover_state_events(run_id,event_type,actor_user_id,evidence_hash,detail)
  VALUES(v_run.id,'activated',p_actor_user_id,v_evidence,jsonb_build_object('manifestHash',v_run.manifest_hash,'noValueTransferred',true));
  RETURN jsonb_build_object('runId',v_run.id,'status','active','manifestHash',v_run.manifest_hash,
    'linkedSourceCount',(SELECT count(*) FROM public.financial_cutover_canonical_links link WHERE link.run_id=v_run.id),
    'noValueTransferred',true);
END; $$;

CREATE FUNCTION public.rollback_financial_cutover(p_actor_user_id uuid,p_command jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_environment text:=lower(trim(p_command->>'deploymentEnvironment'));v_run public.financial_cutover_runs%ROWTYPE;v_evidence text:=p_command->>'evidenceHash';
BEGIN
  IF p_command->>'contractVersion'<>'financial_cutover_rollback.v1'
    OR NOT public.financial_cutover_runtime_enabled(v_environment,'activate') OR v_evidence !~ '^[0-9a-f]{64}$'
  THEN RAISE EXCEPTION 'financial_cutover_contract_invalid'; END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('financial-cutover-instance',0));
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('financial-cutover:'||v_environment,0));
  SELECT run.* INTO v_run FROM public.financial_cutover_instance_state state
    JOIN public.financial_cutover_runs run ON run.id=state.active_run_id
    WHERE state.singleton AND state.deployment_environment=v_environment FOR UPDATE OF run;
  IF v_run.id IS NULL OR v_run.id<>(p_command->>'runId')::bigint OR v_run.status<>'active'
    OR v_run.manifest_hash<>p_command->>'manifestHash' THEN RAISE EXCEPTION 'financial_cutover_run_mismatch'; END IF;
  UPDATE public.financial_cutover_runs SET status='rolled_back',rolled_back_at=clock_timestamp() WHERE id=v_run.id;
  UPDATE public.financial_cutover_instance_state SET active_run_id=NULL,deployment_environment='production',
    canonical_reads_enabled=false,legacy_writes_enabled=true,state_version=state_version+1,updated_at=clock_timestamp() WHERE singleton;
  INSERT INTO public.financial_cutover_state_events(run_id,event_type,actor_user_id,evidence_hash,detail)
  VALUES(v_run.id,'rolled_back',p_actor_user_id,v_evidence,jsonb_build_object('canonicalRecordsRetained',true,'forwardFixRequired',true));
  RETURN jsonb_build_object('runId',v_run.id,'status','rolled_back','canonicalRecordsRetained',true,'noValueTransferred',true);
END; $$;

CREATE FUNCTION public.enforce_financial_cutover_legacy_write_boundary()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_active boolean;
BEGIN
  SELECT state.canonical_reads_enabled AND NOT state.legacy_writes_enabled INTO v_active
  FROM public.financial_cutover_instance_state state WHERE state.singleton;
  IF NOT coalesce(v_active,false) THEN
    IF TG_OP='DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
  END IF;
  IF TG_TABLE_NAME IN('payments','monthly_cycle_bookkeeping_credits') THEN
    RAISE EXCEPTION 'legacy_financial_writes_retired';
  ELSIF TG_TABLE_NAME='user_withdrawal_requests' THEN
    IF TG_OP='DELETE' OR NEW.request_hash IS NULL OR NEW.project_id IS NULL OR NEW.financial_asset_id IS NULL THEN
      RAISE EXCEPTION 'legacy_withdrawal_writes_retired';
    END IF;
  ELSIF TG_TABLE_NAME='payout_intents' THEN
    IF TG_OP='DELETE' OR NEW.withdrawal_request_id IS NULL OR NEW.source_result_id IS NOT NULL THEN
      RAISE EXCEPTION 'legacy_payout_intent_writes_retired';
    END IF;
  END IF;
  IF TG_OP='DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER financial_cutover_payments_write_guard BEFORE INSERT OR UPDATE OR DELETE ON public.payments
FOR EACH ROW EXECUTE FUNCTION public.enforce_financial_cutover_legacy_write_boundary();
CREATE TRIGGER financial_cutover_bookkeeping_write_guard BEFORE INSERT OR UPDATE OR DELETE ON public.monthly_cycle_bookkeeping_credits
FOR EACH ROW EXECUTE FUNCTION public.enforce_financial_cutover_legacy_write_boundary();
CREATE TRIGGER financial_cutover_withdrawal_write_guard BEFORE INSERT OR UPDATE OR DELETE ON public.user_withdrawal_requests
FOR EACH ROW EXECUTE FUNCTION public.enforce_financial_cutover_legacy_write_boundary();
CREATE TRIGGER financial_cutover_payout_intent_write_guard BEFORE INSERT OR UPDATE OR DELETE ON public.payout_intents
FOR EACH ROW EXECUTE FUNCTION public.enforce_financial_cutover_legacy_write_boundary();

CREATE VIEW public.financial_cutover_reconciliation_report WITH(security_invoker=true) AS
SELECT run.id run_id,run.deployment_environment,run.status,run.manifest_hash,run.source_count,run.blocker_count,run.warning_count,
  run.legacy_minor_total,run.canonical_minor_total,run.legacy_minor_total-run.canonical_minor_total AS difference_minor,
  count(link.id)::integer linked_source_count,run.prepared_at,run.activated_at,run.rolled_back_at
FROM public.financial_cutover_runs run
LEFT JOIN public.financial_cutover_canonical_links link ON link.run_id=run.id
GROUP BY run.id;

CREATE VIEW public.financial_cutover_source_report WITH(security_invoker=true) AS
SELECT record.run_id,record.source_type,record.source_id,record.classification,record.monthly_cycle_id,record.project_id,record.user_id,
  record.legacy_minor,record.currency_code,record.source_hash,record.classification_evidence_hash,
  difference.severity,difference.difference_type,difference.canonical_minor,difference.difference_minor,
  link.canonical_type,link.canonical_id,link.ledger_transaction_id,link.withdrawal_obligation_id
FROM public.financial_cutover_source_records record
LEFT JOIN public.financial_cutover_differences difference ON difference.source_record_id=record.id
LEFT JOIN public.financial_cutover_canonical_links link ON link.source_record_id=record.id;

CREATE VIEW public.financial_cutover_compatibility_positions WITH(security_invoker=true) AS
SELECT credit.user_id,credit.monthly_cycle_id,credit.id AS legacy_credit_id,credit.usd_equivalent_amount,
  credit.status AS legacy_status,obligation.id AS canonical_obligation_id,obligation.total_minor AS canonical_minor,
  obligation.state AS canonical_state,
  CASE WHEN obligation.id IS NULL THEN 'legacy_read_only' ELSE 'canonical_liability' END AS read_source
FROM public.monthly_cycle_bookkeeping_credits credit
LEFT JOIN public.user_withdrawal_obligations obligation ON obligation.source_bookkeeping_credit_id=credit.id;

ALTER TABLE public.financial_cutover_runtime_controls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_cutover_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_cutover_source_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_cutover_differences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_cutover_canonical_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_cutover_state_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_cutover_instance_state ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.financial_cutover_runtime_controls,public.financial_cutover_runs,
  public.financial_cutover_source_records,public.financial_cutover_differences,public.financial_cutover_canonical_links,
  public.financial_cutover_state_events,public.financial_cutover_instance_state,
  public.financial_cutover_reconciliation_report,public.financial_cutover_source_report,
  public.financial_cutover_compatibility_positions FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT ON TABLE public.financial_cutover_runtime_controls,public.financial_cutover_runs,
  public.financial_cutover_source_records,public.financial_cutover_differences,public.financial_cutover_canonical_links,
  public.financial_cutover_state_events,public.financial_cutover_instance_state,
  public.financial_cutover_reconciliation_report,public.financial_cutover_source_report,
  public.financial_cutover_compatibility_positions TO service_role;

REVOKE ALL ON FUNCTION public.financial_cutover_runtime_enabled(text,text),public.financial_cutover_current_source_hash(text,text),public.prepare_financial_cutover(uuid,jsonb),
  public.activate_financial_cutover(uuid,jsonb),public.rollback_financial_cutover(uuid,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.financial_cutover_runtime_enabled(text,text),public.financial_cutover_current_source_hash(text,text),public.prepare_financial_cutover(uuid,jsonb),
  public.activate_financial_cutover(uuid,jsonb),public.rollback_financial_cutover(uuid,jsonb) TO service_role;
