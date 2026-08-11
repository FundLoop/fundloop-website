ALTER TABLE public.stripe_acss_debit_commands
  ADD COLUMN provider_payment_intent_id text,
  ADD COLUMN provider_charge_id text,
  ADD COLUMN provider_mandate_id text,
  ADD CONSTRAINT stripe_acss_command_payment_intent_check
    CHECK (provider_payment_intent_id IS NULL OR provider_payment_intent_id ~ '^pi_[A-Za-z0-9]+$'),
  ADD CONSTRAINT stripe_acss_command_charge_check
    CHECK (provider_charge_id IS NULL OR provider_charge_id ~ '^ch_[A-Za-z0-9]+$'),
  ADD CONSTRAINT stripe_acss_command_mandate_check
    CHECK (provider_mandate_id IS NULL OR provider_mandate_id ~ '^mandate_[A-Za-z0-9]+$');

CREATE UNIQUE INDEX stripe_acss_commands_payment_intent_idx
  ON public.stripe_acss_debit_commands(provider_payment_intent_id)
  WHERE provider_payment_intent_id IS NOT NULL;
CREATE UNIQUE INDEX stripe_acss_commands_charge_idx
  ON public.stripe_acss_debit_commands(provider_charge_id)
  WHERE provider_charge_id IS NOT NULL;
CREATE UNIQUE INDEX stripe_acss_commands_mandate_idx
  ON public.stripe_acss_debit_commands(provider_mandate_id)
  WHERE provider_mandate_id IS NOT NULL;

CREATE TABLE public.stripe_acss_debit_package_invalidations (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  command_id uuid NOT NULL REFERENCES public.stripe_acss_debit_commands(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  evidence_id bigint NOT NULL REFERENCES public.stripe_acss_debit_evidence(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  package_id bigint NOT NULL REFERENCES public.epoch_project_packages(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  funding_source_id bigint NOT NULL REFERENCES public.epoch_project_package_funding_sources(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  reason text NOT NULL CHECK (reason IN ('disputed','refunded','dispute_lost')),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  production_enabled boolean NOT NULL DEFAULT false CHECK (production_enabled = false),
  UNIQUE(evidence_id,funding_source_id)
);
CREATE INDEX stripe_acss_package_invalidations_command_idx
  ON public.stripe_acss_debit_package_invalidations(command_id,created_at DESC,id DESC);
CREATE INDEX stripe_acss_package_invalidations_package_idx
  ON public.stripe_acss_debit_package_invalidations(package_id,created_at DESC,id DESC);

CREATE FUNCTION public.enforce_stripe_acss_debit_evidence_identity() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_command public.stripe_acss_debit_commands%ROWTYPE;
BEGIN
  SELECT * INTO v_command FROM public.stripe_acss_debit_commands WHERE id=NEW.command_id FOR UPDATE;
  IF v_command.id IS NULL
    OR NEW.provider_checkout_session_id IS NULL
    OR NEW.provider_checkout_session_id<>v_command.provider_checkout_session_id
    OR NEW.provider_payment_intent_id IS NULL
    OR NEW.provider_mandate_id IS NULL THEN
    RAISE EXCEPTION 'stripe_acss_provider_identity_missing';
  END IF;
  IF (v_command.provider_payment_intent_id IS NOT NULL AND v_command.provider_payment_intent_id<>NEW.provider_payment_intent_id)
    OR (v_command.provider_charge_id IS NOT NULL AND NEW.provider_charge_id IS NOT NULL AND v_command.provider_charge_id<>NEW.provider_charge_id)
    OR (v_command.provider_mandate_id IS NOT NULL AND v_command.provider_mandate_id<>NEW.provider_mandate_id) THEN
    RAISE EXCEPTION 'stripe_acss_provider_identity_conflict';
  END IF;
  IF NEW.evidence_type='settled_available' AND EXISTS(
    SELECT 1 FROM public.stripe_acss_debit_evidence e
    WHERE e.command_id=NEW.command_id AND e.evidence_type IN ('refunded','dispute_lost')
  ) THEN
    RAISE EXCEPTION 'stripe_acss_terminal_evidence_blocks_settlement';
  END IF;
  UPDATE public.stripe_acss_debit_commands
  SET provider_payment_intent_id=coalesce(provider_payment_intent_id,NEW.provider_payment_intent_id),
      provider_charge_id=coalesce(provider_charge_id,NEW.provider_charge_id),
      provider_mandate_id=coalesce(provider_mandate_id,NEW.provider_mandate_id)
  WHERE id=NEW.command_id;
  RETURN NEW;
END
$$;

CREATE TRIGGER stripe_acss_evidence_identity_before_insert
BEFORE INSERT ON public.stripe_acss_debit_evidence
FOR EACH ROW EXECUTE FUNCTION public.enforce_stripe_acss_debit_evidence_identity();

CREATE FUNCTION public.invalidate_stripe_acss_debit_packages() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  IF NEW.evidence_type NOT IN ('disputed','refunded','dispute_lost') THEN RETURN NEW; END IF;
  INSERT INTO public.stripe_acss_debit_package_invalidations(command_id,evidence_id,package_id,funding_source_id,reason)
  SELECT NEW.command_id,NEW.id,source.package_id,source.id,NEW.evidence_type
  FROM public.epoch_project_package_funding_sources source
  WHERE source.stripe_acss_debit_command_id=NEW.command_id
  ON CONFLICT(evidence_id,funding_source_id) DO NOTHING;
  UPDATE public.epoch_project_packages package
  SET funding_status='unsettled'
  WHERE package.id IN (
    SELECT source.package_id FROM public.epoch_project_package_funding_sources source
    WHERE source.stripe_acss_debit_command_id=NEW.command_id
  ) AND package.funding_status='settled';
  RETURN NEW;
END
$$;

CREATE TRIGGER stripe_acss_evidence_invalidate_packages_after_insert
AFTER INSERT ON public.stripe_acss_debit_evidence
FOR EACH ROW EXECUTE FUNCTION public.invalidate_stripe_acss_debit_packages();

DROP FUNCTION public.list_project_stripe_acss_debit_status(uuid,text);
DROP VIEW public.stripe_acss_debit_status;
CREATE VIEW public.stripe_acss_debit_status WITH(security_invoker=true) AS
SELECT c.id command_id,c.project_id,c.payment_id,c.currency_code,c.expected_amount_minor,c.created_at,
  coalesce(latest.evidence_type,CASE WHEN c.provider_checkout_session_id IS NULL THEN'prepared' ELSE'checkout_created' END)status,
  latest.provider_created_at status_at,
  (settled.ledger_transaction_id IS NOT NULL AND reversal.id IS NULL
    AND coalesce(latest.evidence_type,'') NOT IN ('disputed','refunded','dispute_lost')) available_for_package,
  (reversal.id IS NOT NULL) reversed
FROM public.stripe_acss_debit_commands c
LEFT JOIN LATERAL(SELECT e.*,w.provider_created_at FROM public.stripe_acss_debit_evidence e JOIN public.stripe_webhook_events w ON w.id=e.webhook_event_id
  WHERE e.command_id=c.id ORDER BY w.provider_created_at DESC,e.id DESC LIMIT 1)latest ON true
LEFT JOIN LATERAL(SELECT e.ledger_transaction_id FROM public.stripe_acss_debit_evidence e WHERE e.command_id=c.id AND e.ledger_transaction_id IS NOT NULL ORDER BY e.id LIMIT 1)settled ON true
LEFT JOIN public.ledger_transactions reversal ON reversal.reversal_of_transaction_id=settled.ledger_transaction_id;

CREATE FUNCTION public.list_project_stripe_acss_debit_status(p_actor_user_id uuid,p_project_slug text) RETURNS SETOF public.stripe_acss_debit_status
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
  SELECT s.* FROM public.stripe_acss_debit_status s JOIN public.projects p ON p.id=s.project_id
  WHERE p.slug=p_project_slug AND public.is_project_financial_admin(p_actor_user_id,p.id) ORDER BY s.created_at DESC,s.command_id;
$$;

ALTER TABLE public.stripe_acss_debit_package_invalidations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.stripe_acss_debit_package_invalidations FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT ON TABLE public.stripe_acss_debit_package_invalidations TO service_role;
GRANT SELECT ON TABLE public.stripe_acss_debit_status TO service_role;
REVOKE INSERT,UPDATE,DELETE,TRUNCATE ON TABLE public.stripe_acss_debit_package_invalidations FROM service_role;
REVOKE ALL ON FUNCTION public.list_project_stripe_acss_debit_status(uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.list_project_stripe_acss_debit_status(uuid,text) TO service_role;
REVOKE ALL ON FUNCTION public.enforce_stripe_acss_debit_evidence_identity(),public.invalidate_stripe_acss_debit_packages()
  FROM PUBLIC,anon,authenticated,service_role;
