CREATE TABLE public.epoch_project_package_runtime_controls (
  deployment_environment text PRIMARY KEY REFERENCES public.financial_runtime_controls(deployment_environment) ON UPDATE RESTRICT ON DELETE RESTRICT,
  package_preview_enabled boolean NOT NULL DEFAULT false,
  local_email_delivery_enabled boolean NOT NULL DEFAULT false,
  production_enabled boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT epoch_project_package_runtime_environment_check CHECK (deployment_environment IN ('local','dev','test','production')),
  CONSTRAINT epoch_project_package_runtime_production_check CHECK (
    deployment_environment <> 'production'
    OR (package_preview_enabled = false AND local_email_delivery_enabled = false AND production_enabled = false)
  ),
  CONSTRAINT epoch_project_package_runtime_value_flow_check CHECK (production_enabled = false)
);

INSERT INTO public.epoch_project_package_runtime_controls (
  deployment_environment, package_preview_enabled, local_email_delivery_enabled
) VALUES
  ('local', true, true),
  ('dev', true, false),
  ('test', true, true),
  ('production', false, false)
ON CONFLICT (deployment_environment) DO NOTHING;

CREATE TABLE public.project_compliance_snapshots (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  project_id bigint NOT NULL REFERENCES public.projects(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  monthly_cycle_id bigint NOT NULL REFERENCES public.monthly_cycles(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  version integer NOT NULL,
  kyb_status text NOT NULL,
  kyc_status text NOT NULL,
  sanctions_status text NOT NULL,
  evidence_hash text NOT NULL,
  valid_until timestamptz NOT NULL,
  recorded_by_user_id uuid NOT NULL REFERENCES public.users(user_id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  production_enabled boolean NOT NULL DEFAULT false,
  UNIQUE(project_id, monthly_cycle_id, version),
  CONSTRAINT project_compliance_kyb_check CHECK (kyb_status IN ('passed','pending','failed')),
  CONSTRAINT project_compliance_kyc_check CHECK (kyc_status IN ('passed','pending','failed')),
  CONSTRAINT project_compliance_sanctions_check CHECK (sanctions_status IN ('passed','pending','failed')),
  CONSTRAINT project_compliance_hash_check CHECK (evidence_hash ~ '^[0-9a-f]{64}$'),
  CONSTRAINT project_compliance_validity_check CHECK (valid_until > recorded_at),
  CONSTRAINT project_compliance_production_check CHECK (production_enabled = false)
);
CREATE INDEX project_compliance_snapshots_project_cycle_idx
  ON public.project_compliance_snapshots(project_id, monthly_cycle_id, version DESC);
CREATE INDEX project_compliance_snapshots_actor_idx ON public.project_compliance_snapshots(recorded_by_user_id);

CREATE TABLE public.epoch_project_packages (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  project_id bigint NOT NULL REFERENCES public.projects(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  intended_cycle_id bigint NOT NULL REFERENCES public.monthly_cycles(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  canonical_cycle_id bigint REFERENCES public.monthly_cycles(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  version integer NOT NULL,
  supersedes_package_id bigint REFERENCES public.epoch_project_packages(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  rolled_from_package_id bigint REFERENCES public.epoch_project_packages(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  rolled_to_package_id bigint REFERENCES public.epoch_project_packages(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  attribution_dataset_id bigint REFERENCES public.project_attribution_datasets(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  compliance_snapshot_id bigint REFERENCES public.project_compliance_snapshots(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  status text NOT NULL,
  list_status text NOT NULL,
  funding_status text NOT NULL,
  compliance_status text NOT NULL,
  cubid_status text NOT NULL,
  cutoff_at timestamptz NOT NULL,
  frozen_at timestamptz,
  reconciliation_email_delivered_at timestamptz,
  reconciliation_deadline_at timestamptz,
  approved_at timestamptz,
  approved_by_user_id uuid REFERENCES public.users(user_id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  opted_out_at timestamptz,
  opted_out_by_user_id uuid REFERENCES public.users(user_id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  project_fee_assessed_once boolean NOT NULL DEFAULT false,
  base_fee_deferred boolean NOT NULL DEFAULT true,
  payment_count integer NOT NULL DEFAULT 0,
  funding_source_count integer NOT NULL DEFAULT 0,
  cohort_count integer NOT NULL DEFAULT 0,
  eligible_user_count integer NOT NULL DEFAULT 0,
  held_user_count integer NOT NULL DEFAULT 0,
  preliminary_usd numeric(38,18) NOT NULL DEFAULT 0,
  manifest jsonb NOT NULL DEFAULT '{}'::jsonb,
  manifest_hash text NOT NULL,
  created_by_user_id uuid NOT NULL REFERENCES public.users(user_id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  production_enabled boolean NOT NULL DEFAULT false,
  UNIQUE(project_id, intended_cycle_id, version),
  CONSTRAINT epoch_project_packages_status_check CHECK (status IN (
    'draft','validation_failed','review_ready','frozen','approved','silent_approved','opted_out','rolled_forward'
  )),
  CONSTRAINT epoch_project_packages_list_check CHECK (list_status IN ('missing','invalid','valid')),
  CONSTRAINT epoch_project_packages_funding_check CHECK (funding_status IN ('missing','unsettled','settled')),
  CONSTRAINT epoch_project_packages_compliance_check CHECK (compliance_status IN ('pending','failed','passed')),
  CONSTRAINT epoch_project_packages_cubid_check CHECK (cubid_status IN ('missing','held','eligible')),
  CONSTRAINT epoch_project_packages_counts_check CHECK (
    payment_count >= 0 AND funding_source_count >= 0 AND cohort_count >= 0
    AND eligible_user_count >= 0 AND held_user_count >= 0 AND preliminary_usd >= 0
    AND eligible_user_count + held_user_count <= cohort_count
  ),
  CONSTRAINT epoch_project_packages_manifest_check CHECK (jsonb_typeof(manifest) = 'object' AND manifest_hash ~ '^[0-9a-f]{64}$'),
  CONSTRAINT epoch_project_packages_decision_check CHECK (
    (status = 'approved' AND approved_at IS NOT NULL AND approved_by_user_id IS NOT NULL AND opted_out_at IS NULL)
    OR (status = 'silent_approved' AND approved_at IS NOT NULL AND approved_by_user_id IS NULL AND opted_out_at IS NULL)
    OR (status = 'opted_out' AND opted_out_at IS NOT NULL AND opted_out_by_user_id IS NOT NULL AND approved_at IS NULL)
    OR status NOT IN ('approved','silent_approved','opted_out')
  ),
  CONSTRAINT epoch_project_packages_delivery_check CHECK (
    reconciliation_deadline_at IS NULL OR (
      reconciliation_email_delivered_at IS NOT NULL AND reconciliation_deadline_at > reconciliation_email_delivered_at
    )
  ),
  CONSTRAINT epoch_project_packages_production_check CHECK (production_enabled = false)
);
CREATE INDEX epoch_project_packages_project_cycle_idx
  ON public.epoch_project_packages(project_id, intended_cycle_id, version DESC);
CREATE INDEX epoch_project_packages_canonical_status_idx
  ON public.epoch_project_packages(canonical_cycle_id, status, project_id)
  WHERE status IN ('frozen','approved','silent_approved','opted_out');
CREATE INDEX epoch_project_packages_supersedes_idx ON public.epoch_project_packages(supersedes_package_id) WHERE supersedes_package_id IS NOT NULL;
CREATE INDEX epoch_project_packages_rolled_from_idx ON public.epoch_project_packages(rolled_from_package_id) WHERE rolled_from_package_id IS NOT NULL;
CREATE INDEX epoch_project_packages_rolled_to_idx ON public.epoch_project_packages(rolled_to_package_id) WHERE rolled_to_package_id IS NOT NULL;
CREATE INDEX epoch_project_packages_dataset_idx ON public.epoch_project_packages(attribution_dataset_id) WHERE attribution_dataset_id IS NOT NULL;
CREATE INDEX epoch_project_packages_compliance_idx ON public.epoch_project_packages(compliance_snapshot_id) WHERE compliance_snapshot_id IS NOT NULL;
CREATE INDEX epoch_project_packages_approved_actor_idx ON public.epoch_project_packages(approved_by_user_id) WHERE approved_by_user_id IS NOT NULL;
CREATE INDEX epoch_project_packages_opted_out_actor_idx ON public.epoch_project_packages(opted_out_by_user_id) WHERE opted_out_by_user_id IS NOT NULL;
CREATE INDEX epoch_project_packages_created_actor_idx ON public.epoch_project_packages(created_by_user_id);

CREATE TABLE public.epoch_project_package_payments (
  package_id bigint NOT NULL REFERENCES public.epoch_project_packages(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  payment_id bigint NOT NULL REFERENCES public.payments(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  source_position integer NOT NULL,
  PRIMARY KEY(package_id, payment_id),
  UNIQUE(package_id, source_position),
  CONSTRAINT epoch_project_package_payments_position_check CHECK (source_position >= 0)
);
CREATE INDEX epoch_project_package_payments_payment_idx ON public.epoch_project_package_payments(payment_id);

CREATE TABLE public.epoch_project_package_funding_sources (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  package_id bigint NOT NULL REFERENCES public.epoch_project_packages(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  source_position integer NOT NULL,
  source_kind text NOT NULL,
  stripe_intent_id bigint REFERENCES public.stripe_bank_transfer_intents(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  base_receipt_id bigint REFERENCES public.base_intake_v2_receipts(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  asset_code text NOT NULL,
  native_atomic_amount numeric(78,0) NOT NULL,
  preliminary_usd numeric(38,18) NOT NULL,
  source_evidence_hash text NOT NULL,
  project_fee_assessed_once boolean NOT NULL DEFAULT false,
  base_fee_deferred boolean NOT NULL DEFAULT true,
  UNIQUE(package_id, source_position),
  UNIQUE(package_id, stripe_intent_id),
  UNIQUE(package_id, base_receipt_id),
  CONSTRAINT epoch_project_package_funding_kind_check CHECK (source_kind IN ('stripe_bank_transfer','base_stablecoin')),
  CONSTRAINT epoch_project_package_funding_shape_check CHECK (
    (source_kind = 'stripe_bank_transfer' AND stripe_intent_id IS NOT NULL AND base_receipt_id IS NULL)
    OR (source_kind = 'base_stablecoin' AND stripe_intent_id IS NULL AND base_receipt_id IS NOT NULL)
  ),
  CONSTRAINT epoch_project_package_funding_amount_check CHECK (native_atomic_amount > 0 AND preliminary_usd > 0),
  CONSTRAINT epoch_project_package_funding_position_check CHECK (source_position >= 0),
  CONSTRAINT epoch_project_package_funding_hash_check CHECK (source_evidence_hash ~ '^[0-9a-f]{64}$')
);
CREATE INDEX epoch_project_package_funding_package_idx ON public.epoch_project_package_funding_sources(package_id, source_position);
CREATE INDEX epoch_project_package_funding_stripe_idx ON public.epoch_project_package_funding_sources(stripe_intent_id) WHERE stripe_intent_id IS NOT NULL;
CREATE INDEX epoch_project_package_funding_base_idx ON public.epoch_project_package_funding_sources(base_receipt_id) WHERE base_receipt_id IS NOT NULL;

CREATE TABLE public.epoch_project_package_cohort (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  package_id bigint NOT NULL REFERENCES public.epoch_project_packages(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  source_row_id bigint NOT NULL REFERENCES public.project_attribution_rows(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  user_id uuid NOT NULL REFERENCES public.users(user_id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  project_pseudonym text NOT NULL,
  cubid_decision text NOT NULL,
  eligibility_status text NOT NULL,
  locked_cubid_score numeric(38,18),
  locked_max_cubid_score numeric(38,18) NOT NULL,
  cubid_evidence_at timestamptz,
  cubid_evidence_expires_at timestamptz,
  evidence_hash text NOT NULL,
  notification_required boolean NOT NULL DEFAULT false,
  UNIQUE(package_id, user_id),
  UNIQUE(package_id, project_pseudonym),
  CONSTRAINT epoch_project_package_cohort_pseudonym_check CHECK (project_pseudonym ~ '^[0-9a-f]{64}$'),
  CONSTRAINT epoch_project_package_cohort_decision_check CHECK (
    cubid_decision IN ('valid','whitelisted','greylisted','blacklisted','invalid','outage_cached','outage_expired')
  ),
  CONSTRAINT epoch_project_package_cohort_eligibility_check CHECK (eligibility_status IN ('eligible','held','excluded')),
  CONSTRAINT epoch_project_package_cohort_score_check CHECK (
    locked_max_cubid_score > 0
    AND (locked_cubid_score IS NULL OR (locked_cubid_score >= 0 AND locked_cubid_score <= locked_max_cubid_score))
  ),
  CONSTRAINT epoch_project_package_cohort_evidence_check CHECK (
    cubid_evidence_expires_at IS NULL OR (
      cubid_evidence_at IS NOT NULL AND cubid_evidence_expires_at > cubid_evidence_at
    )
  ),
  CONSTRAINT epoch_project_package_cohort_hash_check CHECK (evidence_hash ~ '^[0-9a-f]{64}$')
);
CREATE INDEX epoch_project_package_cohort_package_status_idx ON public.epoch_project_package_cohort(package_id, eligibility_status, id);
CREATE INDEX epoch_project_package_cohort_user_idx ON public.epoch_project_package_cohort(user_id);
CREATE INDEX epoch_project_package_cohort_source_row_idx ON public.epoch_project_package_cohort(source_row_id);

CREATE TABLE public.epoch_project_package_email_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  package_id bigint NOT NULL REFERENCES public.epoch_project_packages(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  attempt_id uuid NOT NULL UNIQUE,
  event_type text NOT NULL,
  recipient_hash text NOT NULL,
  provider_key text NOT NULL,
  provider_message_id text,
  accepted_at timestamptz,
  evidence_hash text NOT NULL,
  created_by_user_id uuid NOT NULL REFERENCES public.users(user_id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  production_enabled boolean NOT NULL DEFAULT false,
  CONSTRAINT epoch_project_package_email_event_check CHECK (event_type IN ('delivery_attempt','delivered','delivery_failed','greylist_notice','blacklist_notice')),
  CONSTRAINT epoch_project_package_email_recipient_hash_check CHECK (recipient_hash ~ '^[0-9a-f]{64}$'),
  CONSTRAINT epoch_project_package_email_provider_check CHECK (provider_key IN ('mailpit_local','disabled')),
  CONSTRAINT epoch_project_package_email_evidence_check CHECK (evidence_hash ~ '^[0-9a-f]{64}$'),
  CONSTRAINT epoch_project_package_email_production_check CHECK (production_enabled = false)
);
CREATE INDEX epoch_project_package_email_events_package_idx ON public.epoch_project_package_email_events(package_id, created_at DESC, id DESC);
CREATE INDEX epoch_project_package_email_events_actor_idx ON public.epoch_project_package_email_events(created_by_user_id);

CREATE TABLE public.epoch_project_package_decision_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  package_id bigint NOT NULL REFERENCES public.epoch_project_packages(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  decision text NOT NULL,
  actor_user_id uuid REFERENCES public.users(user_id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  reason text,
  evidence_hash text NOT NULL,
  decided_at timestamptz NOT NULL DEFAULT now(),
  production_enabled boolean NOT NULL DEFAULT false,
  CONSTRAINT epoch_project_package_decision_event_check CHECK (decision IN ('approve','silent_approve','opt_out')),
  CONSTRAINT epoch_project_package_decision_actor_check CHECK ((decision = 'silent_approve' AND actor_user_id IS NULL) OR (decision <> 'silent_approve' AND actor_user_id IS NOT NULL)),
  CONSTRAINT epoch_project_package_decision_reason_check CHECK (decision <> 'opt_out' OR nullif(btrim(reason),'') IS NOT NULL),
  CONSTRAINT epoch_project_package_decision_hash_check CHECK (evidence_hash ~ '^[0-9a-f]{64}$'),
  CONSTRAINT epoch_project_package_decision_production_check CHECK (production_enabled = false)
);
CREATE UNIQUE INDEX epoch_project_package_decision_once_idx ON public.epoch_project_package_decision_events(package_id);
CREATE INDEX epoch_project_package_decision_actor_idx ON public.epoch_project_package_decision_events(actor_user_id) WHERE actor_user_id IS NOT NULL;

CREATE FUNCTION public.reject_epoch_project_package_append_only_mutation() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  RAISE EXCEPTION 'epoch_project_package_evidence_is_append_only';
END
$$;

CREATE TRIGGER project_compliance_snapshots_append_only BEFORE UPDATE OR DELETE ON public.project_compliance_snapshots
FOR EACH ROW EXECUTE FUNCTION public.reject_epoch_project_package_append_only_mutation();
CREATE TRIGGER epoch_project_package_payments_append_only BEFORE UPDATE OR DELETE ON public.epoch_project_package_payments
FOR EACH ROW EXECUTE FUNCTION public.reject_epoch_project_package_append_only_mutation();
CREATE TRIGGER epoch_project_package_funding_append_only BEFORE UPDATE OR DELETE ON public.epoch_project_package_funding_sources
FOR EACH ROW EXECUTE FUNCTION public.reject_epoch_project_package_append_only_mutation();
CREATE TRIGGER epoch_project_package_cohort_append_only BEFORE UPDATE OR DELETE ON public.epoch_project_package_cohort
FOR EACH ROW EXECUTE FUNCTION public.reject_epoch_project_package_append_only_mutation();
CREATE TRIGGER epoch_project_package_email_append_only BEFORE UPDATE OR DELETE ON public.epoch_project_package_email_events
FOR EACH ROW EXECUTE FUNCTION public.reject_epoch_project_package_append_only_mutation();
CREATE TRIGGER epoch_project_package_decisions_append_only BEFORE UPDATE OR DELETE ON public.epoch_project_package_decision_events
FOR EACH ROW EXECUTE FUNCTION public.reject_epoch_project_package_append_only_mutation();

CREATE FUNCTION public.epoch_project_package_runtime_enabled(p_environment text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT lower(coalesce(p_environment,'')) IN ('local','dev','test')
    AND EXISTS (
      SELECT 1 FROM public.epoch_project_package_runtime_controls control
      WHERE control.deployment_environment = lower(p_environment)
        AND control.package_preview_enabled AND NOT control.production_enabled
    );
$$;

CREATE FUNCTION public.epoch_project_package_pseudonym(p_project_id bigint, p_user_id uuid) RETURNS text
LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT encode(extensions.digest(convert_to('fundloop-project-package:v1:' || p_project_id::text || ':' || p_user_id::text, 'UTF8'), 'sha256'), 'hex');
$$;

CREATE FUNCTION public.epoch_project_package_business_deadline(p_delivered_at timestamptz) RETURNS timestamptz
LANGUAGE plpgsql STABLE SET search_path = '' AS $$
DECLARE
  v_local_date date := (p_delivered_at AT TIME ZONE 'America/Los_Angeles')::date + 1;
BEGIN
  LOOP
    IF extract(isodow FROM v_local_date) < 6
      AND NOT EXISTS (
        SELECT 1 FROM public.epoch_business_calendar calendar
        WHERE calendar.calendar_region = 'US-CA' AND calendar.calendar_date = v_local_date AND NOT calendar.is_business_day
      ) THEN
      RETURN ((v_local_date + 1)::timestamp AT TIME ZONE 'America/Los_Angeles');
    END IF;
    v_local_date := v_local_date + 1;
  END LOOP;
  RETURN ((v_local_date + 1)::timestamp AT TIME ZONE 'America/Los_Angeles');
END
$$;

CREATE FUNCTION public.validate_epoch_project_package(p_command jsonb) RETURNS bigint
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_environment text := lower(coalesce(p_command->>'deploymentEnvironment',''));
  v_project public.projects%ROWTYPE;
  v_cycle public.monthly_cycles%ROWTYPE;
  v_next_cycle public.monthly_cycles%ROWTYPE;
  v_dataset public.project_attribution_datasets%ROWTYPE;
  v_compliance_id bigint;
  v_package_id bigint;
  v_previous_id bigint;
  v_version integer;
  v_compliance_version integer;
  v_cutoff timestamptz;
  v_now timestamptz := coalesce(nullif(p_command->>'observedAt','')::timestamptz, clock_timestamp());
  v_list_status text;
  v_funding_status text;
  v_compliance_status text;
  v_cubid_status text;
  v_status text;
  v_payment_count integer;
  v_funding_count integer;
  v_cohort_count integer;
  v_eligible_count integer;
  v_held_count integer;
  v_preliminary_usd numeric(38,18);
  v_manifest jsonb;
  v_manifest_hash text;
  v_max_score numeric(38,18) := coalesce(nullif(p_command->>'maximumCubidScore','')::numeric, 20);
  v_ttl interval := make_interval(hours => greatest(1, least(coalesce(nullif(p_command->>'cubidTtlHours','')::integer, 24), 168)));
BEGIN
  IF NOT public.epoch_project_package_runtime_enabled(v_environment) THEN
    RAISE EXCEPTION 'epoch_project_package_runtime_disabled';
  END IF;
  IF coalesce(p_command->>'actorRole','') <> 'internal_admin' THEN RAISE EXCEPTION 'epoch_project_package_operator_required'; END IF;
  IF v_max_score <= 0 THEN RAISE EXCEPTION 'epoch_project_package_maximum_cubid_score_invalid'; END IF;

  SELECT * INTO v_project FROM public.projects WHERE slug = p_command->>'projectSlug' AND deleted_at IS NULL;
  SELECT * INTO v_cycle FROM public.monthly_cycles WHERE cycle_key = p_command->>'cycleKey';
  IF v_project.id IS NULL OR v_cycle.id IS NULL THEN RAISE EXCEPTION 'epoch_project_package_scope_unavailable'; END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('epoch-project-package:' || v_project.id::text || ':' || v_cycle.id::text, 0));
  SELECT id INTO v_previous_id FROM public.epoch_project_packages
    WHERE project_id = v_project.id AND intended_cycle_id = v_cycle.id ORDER BY version DESC LIMIT 1;
  IF v_previous_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.epoch_project_packages WHERE id = v_previous_id AND status IN ('frozen','approved','silent_approved','opted_out')
  ) THEN RAISE EXCEPTION 'epoch_project_package_frozen'; END IF;

  v_cutoff := ((v_cycle.period_end + 1)::timestamp AT TIME ZONE 'America/Los_Angeles');
  SELECT * INTO v_next_cycle FROM public.monthly_cycles WHERE period_start > v_cycle.period_end ORDER BY period_start LIMIT 1;
  SELECT * INTO v_dataset FROM public.project_attribution_datasets
    WHERE project_id = v_project.id AND monthly_cycle_id = v_cycle.id AND status = 'approved'
    ORDER BY approved_at DESC NULLS LAST, id DESC LIMIT 1;
  v_list_status := CASE WHEN v_dataset.id IS NULL THEN 'missing'
    WHEN EXISTS(SELECT 1 FROM public.project_attribution_rows row WHERE row.dataset_id = v_dataset.id AND (row.user_id IS NULL OR row.resolution_status <> 'resolved')) THEN 'invalid'
    ELSE 'valid' END;

  v_compliance_version := coalesce((SELECT max(version) + 1 FROM public.project_compliance_snapshots WHERE project_id = v_project.id AND monthly_cycle_id = v_cycle.id), 1);
  INSERT INTO public.project_compliance_snapshots(
    project_id, monthly_cycle_id, version, kyb_status, kyc_status, sanctions_status, evidence_hash,
    valid_until, recorded_by_user_id, recorded_at
  ) VALUES (
    v_project.id, v_cycle.id, v_compliance_version,
    coalesce(p_command->>'kybStatus','pending'), coalesce(p_command->>'kycStatus','pending'),
    coalesce(p_command->>'sanctionsStatus','pending'), p_command->>'complianceEvidenceHash',
    coalesce(nullif(p_command->>'complianceValidUntil','')::timestamptz, v_now + interval '30 days'),
    (p_command->>'actorUserId')::uuid, v_now
  ) RETURNING id INTO v_compliance_id;
  SELECT CASE WHEN kyb_status = 'passed' AND kyc_status = 'passed' AND sanctions_status = 'passed' AND valid_until > v_now THEN 'passed'
    WHEN kyb_status = 'failed' OR kyc_status = 'failed' OR sanctions_status = 'failed' THEN 'failed' ELSE 'pending' END
    INTO v_compliance_status FROM public.project_compliance_snapshots WHERE id = v_compliance_id;

  v_payment_count := (SELECT count(*) FROM public.payments payment
    WHERE payment.project_id = v_project.id AND payment.monthly_cycle_id = v_cycle.id AND payment.deleted_at IS NULL);
  v_funding_count := (
    SELECT count(*) FROM (
      SELECT intent.id FROM public.stripe_bank_transfer_intents intent
      JOIN public.stripe_bank_transfer_status status ON status.intent_id = intent.id
      WHERE intent.project_id = v_project.id AND intent.accounting_period_id IN (
        SELECT period.id FROM public.accounting_periods period
        WHERE period.starts_at < v_cutoff AND period.ends_at > (v_cycle.period_start::timestamp AT TIME ZONE 'America/Los_Angeles')
      ) AND status.available_for_shadow_close
      UNION ALL
      SELECT receipt.id FROM public.base_intake_v2_receipts receipt
      JOIN LATERAL (
        SELECT event.status FROM public.base_intake_v2_reconciliation_events event
        WHERE event.receipt_id = receipt.id ORDER BY event.observed_at DESC, event.id DESC LIMIT 1
      ) latest ON true
      JOIN public.accounting_periods period ON period.id = receipt.accounting_period_id
      WHERE receipt.project_id = v_project.id AND latest.status = 'exact'
        AND period.starts_at < v_cutoff AND period.ends_at > (v_cycle.period_start::timestamp AT TIME ZONE 'America/Los_Angeles')
    ) funding
  );
  v_funding_status := CASE WHEN v_funding_count = 0 THEN 'missing' ELSE 'settled' END;
  v_version := coalesce((SELECT max(version) + 1 FROM public.epoch_project_packages WHERE project_id = v_project.id AND intended_cycle_id = v_cycle.id), 1);
  v_status := CASE
    WHEN v_list_status <> 'valid' OR v_payment_count = 0 OR v_funding_status <> 'settled' THEN 'rolled_forward'
    WHEN v_compliance_status <> 'passed' THEN 'validation_failed'
    WHEN v_now >= v_cutoff THEN 'frozen'
    ELSE 'review_ready' END;

  INSERT INTO public.epoch_project_packages(
    project_id, intended_cycle_id, canonical_cycle_id, version, supersedes_package_id, attribution_dataset_id,
    compliance_snapshot_id, status, list_status, funding_status, compliance_status, cubid_status, cutoff_at,
    frozen_at, manifest_hash, created_by_user_id, created_at
  ) VALUES (
    v_project.id, v_cycle.id,
    CASE WHEN v_status = 'rolled_forward' THEN v_next_cycle.id ELSE v_cycle.id END,
    v_version, v_previous_id, v_dataset.id, v_compliance_id, v_status, v_list_status, v_funding_status,
    v_compliance_status, 'missing', v_cutoff, CASE WHEN v_status = 'frozen' THEN v_now END,
    repeat('0',64), (p_command->>'actorUserId')::uuid, v_now
  ) RETURNING id INTO v_package_id;

  INSERT INTO public.epoch_project_package_payments(package_id, payment_id, source_position)
  SELECT v_package_id, payment.id, row_number() OVER(ORDER BY payment.id) - 1
  FROM public.payments payment
  WHERE payment.project_id = v_project.id AND payment.monthly_cycle_id = v_cycle.id AND payment.deleted_at IS NULL
  ORDER BY payment.id;

  INSERT INTO public.epoch_project_package_funding_sources(
    package_id, source_position, source_kind, stripe_intent_id, asset_code, native_atomic_amount,
    preliminary_usd, source_evidence_hash, project_fee_assessed_once
  )
  SELECT v_package_id, row_number() OVER(ORDER BY intent.id) - 1, 'stripe_bank_transfer', intent.id,
    intent.currency_code, intent.expected_amount_minor, intent.expected_amount_minor / 100,
    intent.instruction_evidence_hash, true
  FROM public.stripe_bank_transfer_intents intent
  JOIN public.stripe_bank_transfer_status status ON status.intent_id = intent.id
  WHERE intent.project_id = v_project.id AND status.available_for_shadow_close
    AND intent.accounting_period_id IN (
      SELECT period.id FROM public.accounting_periods period
      WHERE period.starts_at < v_cutoff AND period.ends_at > (v_cycle.period_start::timestamp AT TIME ZONE 'America/Los_Angeles')
    );

  INSERT INTO public.epoch_project_package_funding_sources(
    package_id, source_position, source_kind, base_receipt_id, asset_code, native_atomic_amount,
    preliminary_usd, source_evidence_hash, project_fee_assessed_once
  )
  SELECT v_package_id,
    coalesce((SELECT max(source_position) + 1 FROM public.epoch_project_package_funding_sources WHERE package_id = v_package_id), 0)
      + row_number() OVER(ORDER BY receipt.id) - 1,
    'base_stablecoin', receipt.id, receipt.token_symbol, receipt.net_epoch_native_amount,
    receipt.net_epoch_native_amount / 1000000, receipt.evidence_hash, true
  FROM public.base_intake_v2_receipts receipt
  JOIN LATERAL (
    SELECT event.status FROM public.base_intake_v2_reconciliation_events event
    WHERE event.receipt_id = receipt.id ORDER BY event.observed_at DESC, event.id DESC LIMIT 1
  ) latest ON true
  JOIN public.accounting_periods period ON period.id = receipt.accounting_period_id
  WHERE receipt.project_id = v_project.id AND latest.status = 'exact'
    AND period.starts_at < v_cutoff AND period.ends_at > (v_cycle.period_start::timestamp AT TIME ZONE 'America/Los_Angeles');

  IF v_dataset.id IS NOT NULL THEN
    INSERT INTO public.epoch_project_package_cohort(
      package_id, source_row_id, user_id, project_pseudonym, cubid_decision, eligibility_status,
      locked_cubid_score, locked_max_cubid_score, cubid_evidence_at, cubid_evidence_expires_at,
      evidence_hash, notification_required
    )
    SELECT v_package_id, row.id, row.user_id,
      public.epoch_project_package_pseudonym(v_project.id, row.user_id),
      CASE
        WHEN lower(coalesce(snapshot.raw_identity->>'listStatus','')) = 'blacklisted' THEN 'blacklisted'
        WHEN lower(coalesce(snapshot.raw_identity->>'listStatus','')) = 'greylisted' THEN 'greylisted'
        WHEN lower(coalesce(snapshot.raw_identity->>'listStatus','')) = 'whitelisted' THEN 'whitelisted'
        WHEN user_row.cubid_identity_status NOT IN ('linked','verified') OR snapshot.cubid_score IS NULL
          OR snapshot.last_synced_at IS NULL OR snapshot.last_synced_at > v_now
          OR snapshot.cubid_score < 0 OR snapshot.cubid_score > v_max_score THEN 'invalid'
        WHEN snapshot.last_sync_error_code IS NOT NULL AND snapshot.last_synced_at IS NOT NULL
          AND snapshot.last_synced_at + v_ttl > v_now THEN 'outage_cached'
        WHEN snapshot.last_sync_error_code IS NOT NULL THEN 'outage_expired'
        ELSE 'valid' END,
      CASE
        WHEN lower(coalesce(snapshot.raw_identity->>'listStatus','')) IN ('blacklisted','greylisted') THEN 'held'
        WHEN user_row.cubid_identity_status NOT IN ('linked','verified') OR snapshot.cubid_score IS NULL
          OR snapshot.last_synced_at IS NULL OR snapshot.last_synced_at > v_now
          OR snapshot.cubid_score < 0 OR snapshot.cubid_score > v_max_score THEN 'excluded'
        WHEN snapshot.last_sync_error_code IS NOT NULL AND (
          snapshot.last_synced_at IS NULL OR snapshot.last_synced_at + v_ttl <= v_now
        ) THEN 'held'
        ELSE 'eligible' END,
      CASE WHEN snapshot.cubid_score BETWEEN 0 AND v_max_score THEN snapshot.cubid_score ELSE NULL END,
      v_max_score, snapshot.last_synced_at,
      CASE WHEN snapshot.last_synced_at IS NULL THEN NULL ELSE snapshot.last_synced_at + v_ttl END,
      encode(extensions.digest(convert_to(coalesce(snapshot.raw_identity::text,'{}') || ':' || coalesce(snapshot.raw_stamps::text,'[]'), 'UTF8'), 'sha256'), 'hex'),
      lower(coalesce(snapshot.raw_identity->>'listStatus','')) IN ('blacklisted','greylisted')
    FROM public.project_attribution_rows row
    JOIN public.users user_row ON user_row.user_id = row.user_id
    LEFT JOIN public.cubid_identity_snapshots snapshot ON snapshot.user_id = row.user_id
    WHERE row.dataset_id = v_dataset.id AND row.user_id IS NOT NULL AND row.resolution_status = 'resolved';
  END IF;

  INSERT INTO public.epoch_project_package_email_events(
    package_id,attempt_id,event_type,recipient_hash,provider_key,evidence_hash,created_by_user_id,created_at
  )
  SELECT v_package_id, extensions.gen_random_uuid(),
    CASE WHEN cohort.cubid_decision='blacklisted' THEN 'blacklist_notice' ELSE 'greylist_notice' END,
    encode(extensions.digest(convert_to(lower(coalesce(user_row.email,user_row.user_id::text)),'UTF8'),'sha256'),'hex'),
    'disabled',cohort.evidence_hash,(p_command->>'actorUserId')::uuid,v_now
  FROM public.epoch_project_package_cohort cohort
  JOIN public.users user_row ON user_row.user_id=cohort.user_id
  WHERE cohort.package_id=v_package_id AND cohort.cubid_decision IN ('greylisted','blacklisted');

  SELECT count(*), count(*) FILTER(WHERE eligibility_status = 'eligible'), count(*) FILTER(WHERE eligibility_status = 'held')
    INTO v_cohort_count, v_eligible_count, v_held_count
  FROM public.epoch_project_package_cohort WHERE package_id = v_package_id;
  v_cubid_status := CASE WHEN v_cohort_count = 0 THEN 'missing' WHEN v_eligible_count = 0 THEN 'held' ELSE 'eligible' END;
  IF v_status IN ('review_ready','frozen') AND v_cubid_status <> 'eligible' THEN v_status := 'validation_failed'; END IF;
  SELECT coalesce(sum(source.preliminary_usd), 0) INTO v_preliminary_usd
    FROM public.epoch_project_package_funding_sources source WHERE source.package_id = v_package_id;
  v_manifest := jsonb_build_object(
    'contractVersion','epoch_project_package.v1','projectId',v_project.id,'intendedCycleKey',v_cycle.cycle_key,
    'canonicalCycleKey',CASE WHEN v_status = 'rolled_forward' THEN v_next_cycle.cycle_key ELSE v_cycle.cycle_key END,
    'version',v_version,'listStatus',v_list_status,'fundingStatus',v_funding_status,
    'complianceStatus',v_compliance_status,'cubidStatus',v_cubid_status,'paymentCount',v_payment_count,
    'fundingSourceCount',v_funding_count,'cohortCount',v_cohort_count,'eligibleUserCount',v_eligible_count,
    'heldUserCount',v_held_count,'preliminaryUsd',v_preliminary_usd::text,
    'payments',coalesce((SELECT jsonb_agg(payment_id ORDER BY source_position) FROM public.epoch_project_package_payments WHERE package_id = v_package_id),'[]'::jsonb),
    'funding',coalesce((SELECT jsonb_agg(jsonb_build_object('kind',source_kind,'asset',asset_code,'native',native_atomic_amount::text,'usd',preliminary_usd::text,'evidenceHash',source_evidence_hash) ORDER BY source_position)
      FROM public.epoch_project_package_funding_sources WHERE package_id = v_package_id),'[]'::jsonb),
    'cohort',coalesce((SELECT jsonb_agg(jsonb_build_object('pseudonym',project_pseudonym,'decision',cubid_decision,'eligibility',eligibility_status,'score',locked_cubid_score::text,'maximum',locked_max_cubid_score::text,'evidenceHash',evidence_hash) ORDER BY project_pseudonym)
      FROM public.epoch_project_package_cohort WHERE package_id = v_package_id),'[]'::jsonb)
  );
  v_manifest_hash := encode(extensions.digest(convert_to(v_manifest::text, 'UTF8'), 'sha256'), 'hex');
  UPDATE public.epoch_project_packages SET
    status = v_status, cubid_status = v_cubid_status, payment_count = v_payment_count,
    funding_source_count = (SELECT count(*) FROM public.epoch_project_package_funding_sources WHERE package_id = v_package_id),
    cohort_count = v_cohort_count, eligible_user_count = v_eligible_count, held_user_count = v_held_count,
    preliminary_usd = v_preliminary_usd, manifest = v_manifest, manifest_hash = v_manifest_hash,
    project_fee_assessed_once = EXISTS(SELECT 1 FROM public.epoch_project_package_funding_sources WHERE package_id = v_package_id AND project_fee_assessed_once)
  WHERE id = v_package_id;
  RETURN v_package_id;
END
$$;

CREATE FUNCTION public.prepare_epoch_project_package_email(
  p_package_id bigint, p_actor_user_id uuid, p_actor_role text, p_environment text
) RETURNS TABLE(package_id bigint, recipient_email text, subject text, text_body text, recipient_hash text, evidence_hash text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_package public.epoch_project_packages%ROWTYPE; v_project public.projects%ROWTYPE; v_cycle public.monthly_cycles%ROWTYPE;
BEGIN
  IF NOT public.epoch_project_package_runtime_enabled(p_environment) THEN RAISE EXCEPTION 'epoch_project_package_runtime_disabled'; END IF;
  IF p_actor_role <> 'internal_admin' THEN RAISE EXCEPTION 'epoch_project_package_permission_denied'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.epoch_project_package_runtime_controls control
    WHERE control.deployment_environment=lower(trim(p_environment)) AND control.local_email_delivery_enabled=true
  ) THEN RAISE EXCEPTION 'epoch_project_package_email_provider_disabled'; END IF;
  SELECT * INTO v_package FROM public.epoch_project_packages WHERE id = p_package_id;
  SELECT * INTO v_project FROM public.projects WHERE id = v_package.project_id;
  SELECT * INTO v_cycle FROM public.monthly_cycles WHERE id = v_package.canonical_cycle_id;
  IF v_package.id IS NULL OR v_package.status NOT IN ('review_ready','frozen') THEN RAISE EXCEPTION 'epoch_project_package_not_emailable'; END IF;
  IF p_actor_user_id IS NULL THEN RAISE EXCEPTION 'epoch_project_package_permission_denied'; END IF;
  IF coalesce(nullif(v_project.billing_email,''), nullif(v_project.email,'')) IS NULL THEN RAISE EXCEPTION 'epoch_project_package_recipient_unavailable'; END IF;
  RETURN QUERY SELECT v_package.id,
    coalesce(nullif(v_project.billing_email,''), nullif(v_project.email,'')),
    'FundLoop reconciliation review — ' || v_project.name || ' — ' || v_cycle.cycle_key,
    format('Your frozen FundLoop package for %s contains %s settled funding source(s), %s eligible user(s), and preliminary value %s USD. Review and approve or opt out in FundLoop. Silence after accepted delivery and the stated deadline is approval. No payout or ownership transfer occurs at this stage.',
      v_cycle.cycle_key, v_package.funding_source_count, v_package.eligible_user_count, v_package.preliminary_usd),
    encode(extensions.digest(convert_to(lower(coalesce(nullif(v_project.billing_email,''), nullif(v_project.email,''))), 'UTF8'),'sha256'),'hex'),
    encode(extensions.digest(convert_to(v_package.manifest_hash || ':' || lower(coalesce(nullif(v_project.billing_email,''), nullif(v_project.email,''))), 'UTF8'),'sha256'),'hex');
END
$$;

CREATE FUNCTION public.record_epoch_project_package_email_delivery(p_command jsonb) RETURNS bigint
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_package public.epoch_project_packages%ROWTYPE; v_event_id bigint; v_delivered_at timestamptz := (p_command->>'deliveredAt')::timestamptz;
BEGIN
  IF NOT public.epoch_project_package_runtime_enabled(p_command->>'deploymentEnvironment') THEN RAISE EXCEPTION 'epoch_project_package_runtime_disabled'; END IF;
  IF p_command->>'providerKey' <> 'mailpit_local' THEN RAISE EXCEPTION 'epoch_project_package_email_provider_disabled'; END IF;
  SELECT * INTO v_package FROM public.epoch_project_packages WHERE id = (p_command->>'packageId')::bigint FOR UPDATE;
  IF v_package.id IS NULL OR v_package.status NOT IN ('review_ready','frozen') THEN RAISE EXCEPTION 'epoch_project_package_not_emailable'; END IF;
  INSERT INTO public.epoch_project_package_email_events(
    package_id,attempt_id,event_type,recipient_hash,provider_key,provider_message_id,accepted_at,evidence_hash,created_by_user_id,created_at
  ) VALUES (
    v_package.id,(p_command->>'attemptId')::uuid,'delivered',p_command->>'recipientHash','mailpit_local',
    p_command->>'providerMessageId',v_delivered_at,p_command->>'evidenceHash',(p_command->>'actorUserId')::uuid,v_delivered_at
  ) ON CONFLICT(attempt_id) DO NOTHING RETURNING id INTO v_event_id;
  IF v_event_id IS NULL THEN SELECT id INTO v_event_id FROM public.epoch_project_package_email_events WHERE attempt_id=(p_command->>'attemptId')::uuid; END IF;
  UPDATE public.epoch_project_packages SET reconciliation_email_delivered_at = coalesce(reconciliation_email_delivered_at,v_delivered_at),
    reconciliation_deadline_at = coalesce(reconciliation_deadline_at,public.epoch_project_package_business_deadline(v_delivered_at))
  WHERE id = v_package.id;
  RETURN v_event_id;
END
$$;

CREATE FUNCTION public.decide_epoch_project_package(p_command jsonb) RETURNS bigint
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_package public.epoch_project_packages%ROWTYPE;
  v_decision text := p_command->>'decision';
  v_now timestamptz := coalesce(nullif(p_command->>'decidedAt','')::timestamptz,clock_timestamp());
  v_event_id bigint;
  v_next_cycle_id bigint;
  v_rollover_id bigint;
  v_rollover_version integer;
BEGIN
  IF NOT public.epoch_project_package_runtime_enabled(p_command->>'deploymentEnvironment') THEN RAISE EXCEPTION 'epoch_project_package_runtime_disabled'; END IF;
  SELECT * INTO v_package FROM public.epoch_project_packages WHERE id=(p_command->>'packageId')::bigint FOR UPDATE;
  IF v_package.id IS NULL OR v_package.status <> 'frozen' OR v_package.reconciliation_email_delivered_at IS NULL THEN RAISE EXCEPTION 'epoch_project_package_not_decidable'; END IF;
  IF NOT public.is_project_financial_admin((p_command->>'actorUserId')::uuid,v_package.project_id) THEN RAISE EXCEPTION 'epoch_project_package_permission_denied'; END IF;
  IF v_decision NOT IN ('approve','opt_out') THEN RAISE EXCEPTION 'epoch_project_package_decision_invalid'; END IF;
  INSERT INTO public.epoch_project_package_decision_events(package_id,decision,actor_user_id,reason,evidence_hash,decided_at)
  VALUES(v_package.id,v_decision,(p_command->>'actorUserId')::uuid,nullif(p_command->>'reason',''),p_command->>'evidenceHash',v_now)
  RETURNING id INTO v_event_id;
  IF v_decision='approve' THEN
    UPDATE public.epoch_project_packages SET status='approved',approved_at=v_now,approved_by_user_id=(p_command->>'actorUserId')::uuid WHERE id=v_package.id;
  ELSE
    UPDATE public.epoch_project_packages SET status='opted_out',opted_out_at=v_now,opted_out_by_user_id=(p_command->>'actorUserId')::uuid,base_fee_deferred=true WHERE id=v_package.id;
    SELECT cycle.id INTO v_next_cycle_id FROM public.monthly_cycles cycle
      WHERE cycle.period_start > (SELECT period_end FROM public.monthly_cycles WHERE id=v_package.canonical_cycle_id)
      ORDER BY cycle.period_start LIMIT 1;
    IF v_next_cycle_id IS NULL THEN RAISE EXCEPTION 'epoch_project_package_rollover_cycle_unavailable'; END IF;
    v_rollover_version := coalesce((SELECT max(version)+1 FROM public.epoch_project_packages
      WHERE project_id=v_package.project_id AND intended_cycle_id=v_next_cycle_id),1);
    INSERT INTO public.epoch_project_packages(
      project_id,intended_cycle_id,canonical_cycle_id,version,rolled_from_package_id,attribution_dataset_id,
      compliance_snapshot_id,status,list_status,funding_status,compliance_status,cubid_status,cutoff_at,
      project_fee_assessed_once,base_fee_deferred,payment_count,funding_source_count,cohort_count,
      eligible_user_count,held_user_count,preliminary_usd,manifest,manifest_hash,created_by_user_id,created_at
    ) SELECT package.project_id,v_next_cycle_id,v_next_cycle_id,v_rollover_version,package.id,package.attribution_dataset_id,
      package.compliance_snapshot_id,'rolled_forward',package.list_status,package.funding_status,package.compliance_status,
      package.cubid_status,((cycle.period_end+1)::timestamp AT TIME ZONE 'America/Los_Angeles'),true,true,
      package.payment_count,package.funding_source_count,package.cohort_count,package.eligible_user_count,
      package.held_user_count,package.preliminary_usd,
      package.manifest || jsonb_build_object('rolledFromPackageId',package.id,'intendedCycleKey',cycle.cycle_key,'canonicalCycleKey',cycle.cycle_key),
      encode(extensions.digest(convert_to((package.manifest || jsonb_build_object('rolledFromPackageId',package.id,'intendedCycleKey',cycle.cycle_key,'canonicalCycleKey',cycle.cycle_key))::text,'UTF8'),'sha256'),'hex'),
      (p_command->>'actorUserId')::uuid,v_now
    FROM public.epoch_project_packages package JOIN public.monthly_cycles cycle ON cycle.id=v_next_cycle_id
    WHERE package.id=v_package.id RETURNING id INTO v_rollover_id;
    INSERT INTO public.epoch_project_package_payments(package_id,payment_id,source_position)
      SELECT v_rollover_id,payment_id,source_position FROM public.epoch_project_package_payments WHERE package_id=v_package.id;
    INSERT INTO public.epoch_project_package_funding_sources(
      package_id,source_position,source_kind,stripe_intent_id,base_receipt_id,asset_code,native_atomic_amount,
      preliminary_usd,source_evidence_hash,project_fee_assessed_once,base_fee_deferred
    ) SELECT v_rollover_id,source_position,source_kind,stripe_intent_id,base_receipt_id,asset_code,native_atomic_amount,
      preliminary_usd,source_evidence_hash,true,true FROM public.epoch_project_package_funding_sources WHERE package_id=v_package.id;
    INSERT INTO public.epoch_project_package_cohort(
      package_id,source_row_id,user_id,project_pseudonym,cubid_decision,eligibility_status,locked_cubid_score,
      locked_max_cubid_score,cubid_evidence_at,cubid_evidence_expires_at,evidence_hash,notification_required
    ) SELECT v_rollover_id,source_row_id,user_id,project_pseudonym,cubid_decision,eligibility_status,locked_cubid_score,
      locked_max_cubid_score,cubid_evidence_at,cubid_evidence_expires_at,evidence_hash,notification_required
      FROM public.epoch_project_package_cohort WHERE package_id=v_package.id;
    UPDATE public.epoch_project_packages SET rolled_to_package_id=v_rollover_id WHERE id=v_package.id;
  END IF;
  RETURN v_event_id;
END
$$;

CREATE FUNCTION public.finalize_silent_epoch_project_packages(p_environment text,p_now timestamptz DEFAULT clock_timestamp()) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_count integer := 0; v_package public.epoch_project_packages%ROWTYPE;
BEGIN
  IF NOT public.epoch_project_package_runtime_enabled(p_environment) THEN RAISE EXCEPTION 'epoch_project_package_runtime_disabled'; END IF;
  FOR v_package IN SELECT * FROM public.epoch_project_packages
    WHERE status='frozen' AND reconciliation_deadline_at IS NOT NULL AND reconciliation_deadline_at <= p_now
    ORDER BY reconciliation_deadline_at,id FOR UPDATE SKIP LOCKED
  LOOP
    INSERT INTO public.epoch_project_package_decision_events(package_id,decision,actor_user_id,evidence_hash,decided_at)
    VALUES(v_package.id,'silent_approve',NULL,encode(extensions.digest(convert_to(v_package.manifest_hash||':'||p_now::text,'UTF8'),'sha256'),'hex'),p_now);
    UPDATE public.epoch_project_packages SET status='silent_approved',approved_at=p_now WHERE id=v_package.id;
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END
$$;

CREATE VIEW public.epoch_project_package_operator_view WITH(security_invoker=true) AS
SELECT package.id,package.project_id,project.name project_name,project.slug project_slug,
  intended.cycle_key intended_cycle_key,canonical.cycle_key canonical_cycle_key,package.version,package.status,
  package.list_status,package.funding_status,package.compliance_status,package.cubid_status,package.cutoff_at,
  package.reconciliation_email_delivered_at,package.reconciliation_deadline_at,package.payment_count,
  package.funding_source_count,package.cohort_count,package.eligible_user_count,package.held_user_count,
  package.preliminary_usd,package.manifest_hash,package.project_fee_assessed_once,package.base_fee_deferred
FROM public.epoch_project_packages package
JOIN public.projects project ON project.id=package.project_id
JOIN public.monthly_cycles intended ON intended.id=package.intended_cycle_id
LEFT JOIN public.monthly_cycles canonical ON canonical.id=package.canonical_cycle_id;

CREATE VIEW public.epoch_project_package_public_preliminary WITH(security_invoker=true) AS
SELECT project.slug project_slug,project.name project_name,cycle.cycle_key,package.version,package.status,
  package.preliminary_usd,package.cohort_count,package.eligible_user_count,package.held_user_count,
  package.funding_source_count,package.manifest_hash
FROM public.epoch_project_packages package
JOIN public.projects project ON project.id=package.project_id
JOIN public.monthly_cycles cycle ON cycle.id=package.canonical_cycle_id
WHERE package.status IN ('approved','silent_approved');

CREATE VIEW public.epoch_project_package_lock_candidates WITH(security_invoker=true) AS
SELECT package.id package_id,package.project_id,package.canonical_cycle_id,package.version,package.attribution_dataset_id,
  package.compliance_snapshot_id,package.preliminary_usd,package.eligible_user_count,package.manifest_hash
FROM public.epoch_project_packages package
WHERE package.status IN ('approved','silent_approved') AND package.list_status='valid' AND package.funding_status='settled'
  AND package.compliance_status='passed' AND package.cubid_status='eligible' AND package.production_enabled=false;

CREATE FUNCTION public.list_epoch_project_packages(p_actor_user_id uuid,p_project_slug text DEFAULT NULL)
RETURNS SETOF public.epoch_project_package_operator_view LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
  SELECT view.* FROM public.epoch_project_package_operator_view view
  WHERE (p_project_slug IS NULL OR view.project_slug=p_project_slug)
    AND (p_project_slug IS NULL OR public.is_project_financial_admin(p_actor_user_id,view.project_id))
  ORDER BY view.intended_cycle_key DESC,view.project_id,view.version DESC;
$$;

CREATE FUNCTION public.get_public_epoch_project_package(p_project_slug text,p_cycle_key text)
RETURNS SETOF public.epoch_project_package_public_preliminary
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
  SELECT report.* FROM public.epoch_project_package_public_preliminary report
  WHERE report.project_slug=p_project_slug AND report.cycle_key=p_cycle_key
  ORDER BY report.version DESC LIMIT 1;
$$;

ALTER TABLE public.epoch_project_package_runtime_controls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_compliance_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.epoch_project_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.epoch_project_package_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.epoch_project_package_funding_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.epoch_project_package_cohort ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.epoch_project_package_email_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.epoch_project_package_decision_events ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.epoch_project_package_runtime_controls,public.project_compliance_snapshots,
  public.epoch_project_packages,public.epoch_project_package_payments,public.epoch_project_package_funding_sources,
  public.epoch_project_package_cohort,public.epoch_project_package_email_events,public.epoch_project_package_decision_events,
  public.epoch_project_package_operator_view,public.epoch_project_package_public_preliminary,
  public.epoch_project_package_lock_candidates FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT ON TABLE public.epoch_project_package_runtime_controls,public.project_compliance_snapshots,
  public.epoch_project_packages,public.epoch_project_package_payments,public.epoch_project_package_funding_sources,
  public.epoch_project_package_cohort,public.epoch_project_package_email_events,public.epoch_project_package_decision_events,
  public.epoch_project_package_operator_view,public.epoch_project_package_lock_candidates TO service_role;
GRANT SELECT ON TABLE public.epoch_project_package_public_preliminary TO anon,authenticated,service_role;

REVOKE ALL ON FUNCTION public.epoch_project_package_runtime_enabled(text),public.epoch_project_package_pseudonym(bigint,uuid),
  public.epoch_project_package_business_deadline(timestamptz),public.validate_epoch_project_package(jsonb),
  public.prepare_epoch_project_package_email(bigint,uuid,text,text),public.record_epoch_project_package_email_delivery(jsonb),
  public.decide_epoch_project_package(jsonb),public.finalize_silent_epoch_project_packages(text,timestamptz),
  public.list_epoch_project_packages(uuid,text),public.get_public_epoch_project_package(text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.validate_epoch_project_package(jsonb),public.prepare_epoch_project_package_email(bigint,uuid,text,text),
  public.record_epoch_project_package_email_delivery(jsonb),public.decide_epoch_project_package(jsonb),
  public.finalize_silent_epoch_project_packages(text,timestamptz),public.list_epoch_project_packages(uuid,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.epoch_project_package_runtime_enabled(text),public.epoch_project_package_pseudonym(bigint,uuid),
  public.epoch_project_package_business_deadline(timestamptz) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_public_epoch_project_package(text,text) TO anon,authenticated,service_role;
