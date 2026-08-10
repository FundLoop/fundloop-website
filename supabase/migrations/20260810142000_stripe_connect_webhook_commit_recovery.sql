-- Let a signed, SDK-refetched payout event heal a provider/local acknowledgement race.

ALTER FUNCTION public.ingest_stripe_connect_webhook(jsonb) RENAME TO ingest_stripe_connect_webhook_once;
REVOKE ALL ON FUNCTION public.ingest_stripe_connect_webhook_once(jsonb) FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.ingest_stripe_connect_webhook(p_command jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  v_environment text:=lower(p_command->>'deploymentEnvironment');
  v_command_id bigint;
  v_payout public.stripe_connect_payout_commands%ROWTYPE;
  v_transfer_id text:=p_command->>'providerTransferId';
  v_payout_id text:=p_command->>'providerObjectId';
BEGIN
  IF NOT public.stripe_connect_runtime_enabled(v_environment,'webhook') THEN RAISE EXCEPTION 'stripe_connect_runtime_disabled'; END IF;
  IF p_command->>'contractVersion'<>'stripe_connect_webhook.v1' OR (p_command->>'livemode')::boolean
    OR p_command->>'observationSource'<>'stripe_sdk_v1' THEN RAISE EXCEPTION 'stripe_connect_webhook_contract_invalid'; END IF;
  IF p_command->>'eventType'<>'account.updated' AND coalesce(p_command->>'providerCommandId','')<>'' THEN
    IF p_command->>'providerCommandId'!~'^[0-9]+$' OR v_transfer_id!~'^tr_[A-Za-z0-9]+$' OR v_payout_id!~'^po_[A-Za-z0-9]+$'
    THEN RAISE EXCEPTION 'stripe_connect_provider_metadata_invalid'; END IF;
    v_command_id:=(p_command->>'providerCommandId')::bigint;
    SELECT command.* INTO v_payout FROM public.stripe_connect_payout_commands command
      JOIN public.stripe_connect_accounts account ON account.id=command.stripe_connect_account_id
      WHERE command.id=v_command_id AND account.provider_account_id=p_command->>'providerAccountId' FOR UPDATE OF command;
    IF v_payout.id IS NULL THEN RAISE EXCEPTION 'stripe_connect_provider_metadata_unknown'; END IF;
    IF v_payout.provider_payout_id IS NULL AND v_payout.status IN('prepared','transferred') THEN
      UPDATE public.stripe_connect_payout_commands SET provider_transfer_id=v_transfer_id,provider_payout_id=v_payout_id,
        status='submitted',submitted_at=coalesce(submitted_at,clock_timestamp()),updated_at=clock_timestamp() WHERE id=v_payout.id;
      UPDATE public.payout_execution_attempts SET status='submitted',provider_reference=v_payout_id
        WHERE id=v_payout.payout_execution_attempt_id;
    ELSIF v_payout.provider_transfer_id IS DISTINCT FROM v_transfer_id OR v_payout.provider_payout_id IS DISTINCT FROM v_payout_id THEN
      RAISE EXCEPTION 'stripe_connect_provider_reference_conflict';
    END IF;
  END IF;
  RETURN public.ingest_stripe_connect_webhook_once(p_command);
END; $$;

REVOKE ALL ON FUNCTION public.ingest_stripe_connect_webhook(jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.ingest_stripe_connect_webhook(jsonb) TO service_role;
