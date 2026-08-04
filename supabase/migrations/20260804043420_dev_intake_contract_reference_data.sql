-- Keep remote smoke reference data repair on the approved deploy path.
-- The dev fallback addresses are deterministic non-production placeholders used only
-- when the Supabase deploy workflow marks the target environment as dev.
WITH deploy_context AS (
  SELECT COALESCE(NULLIF(current_setting('app.settings.fundloop_target_environment', true), ''), 'unknown') AS target_environment
),
configured_intake AS (
  SELECT
    chains.id AS chain_id,
    chains.network_key,
    'contract'::public.payment_collection_mode AS collection_mode,
    CASE chains.network_key
      WHEN 'ethereum' THEN COALESCE(
        NULLIF(current_setting('app.settings.ethereum_intake_contract', true), ''),
        CASE WHEN deploy_context.target_environment = 'dev' THEN '0x0000000000000000000000000000000000001E01' END
      )
      WHEN 'base' THEN COALESCE(
        NULLIF(current_setting('app.settings.base_intake_contract', true), ''),
        CASE WHEN deploy_context.target_environment = 'dev' THEN '0x0000000000000000000000000000000000001B01' END
      )
      WHEN 'celo' THEN COALESCE(
        NULLIF(current_setting('app.settings.celo_intake_contract', true), ''),
        CASE WHEN deploy_context.target_environment = 'dev' THEN '0x0000000000000000000000000000000000001C01' END
      )
    END AS contract_address,
    CASE chains.network_key
      WHEN 'ethereum' THEN COALESCE(
        NULLIF(current_setting('app.settings.ethereum_treasury_address', true), ''),
        CASE WHEN deploy_context.target_environment = 'dev' THEN '0x0000000000000000000000000000000000002E01' END
      )
      WHEN 'base' THEN COALESCE(
        NULLIF(current_setting('app.settings.base_treasury_address', true), ''),
        CASE WHEN deploy_context.target_environment = 'dev' THEN '0x0000000000000000000000000000000000002B01' END
      )
      WHEN 'celo' THEN COALESCE(
        NULLIF(current_setting('app.settings.celo_treasury_address', true), ''),
        CASE WHEN deploy_context.target_environment = 'dev' THEN '0x0000000000000000000000000000000000002C01' END
      )
    END AS treasury_address,
    'fundloop-intake-v1'::text AS abi_version
  FROM public.ref_chains chains
  CROSS JOIN deploy_context
  WHERE chains.network_key IN ('ethereum', 'base', 'celo')
),
valid_intake AS (
  SELECT *
  FROM configured_intake
  WHERE contract_address IS NOT NULL
    AND treasury_address IS NOT NULL
    AND contract_address <> '0x0000000000000000000000000000000000000000'
    AND treasury_address <> '0x0000000000000000000000000000000000000000'
)
INSERT INTO public.chain_intake_contracts (
  chain_id,
  collection_mode,
  contract_address,
  treasury_address,
  abi_version,
  is_active
)
SELECT
  chain_id,
  collection_mode,
  contract_address,
  treasury_address,
  abi_version,
  true
FROM valid_intake
ON CONFLICT (chain_id, collection_mode) DO UPDATE
SET
  contract_address = EXCLUDED.contract_address,
  treasury_address = EXCLUDED.treasury_address,
  abi_version = EXCLUDED.abi_version,
  is_active = EXCLUDED.is_active;
