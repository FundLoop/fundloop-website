CREATE OR REPLACE FUNCTION public.enforce_base_intake_v2_asset_activation() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE
  d public.base_intake_v2_deployments%ROWTYPE;
BEGIN
  SELECT * INTO d FROM public.base_intake_v2_deployments WHERE id = NEW.deployment_id;
  IF NEW.is_enabled AND NOT (
    (d.deployment_environment = 'local' AND d.chain_id = 31337
      AND NEW.provider_evidence_status = 'local_fixture_only')
    OR (d.deployment_environment IN ('dev', 'test') AND d.chain_id = 84532 AND NEW.symbol = 'USDC'
      AND NEW.token_address = '0x036cbd53842c5426634e7929541ec2318f3dcf7e'
      AND NEW.provider_evidence_status = 'reviewed_issuer')
  ) THEN
    RAISE EXCEPTION 'base_intake_v2_provider_evidence_required';
  END IF;
  RETURN NEW;
END
$$;
