INSERT INTO public.ref_chains (
  chain_id,
  description,
  display_name,
  ecosystem,
  network_key,
  evm_chain_id,
  layer_type,
  native_asset_symbol,
  is_active
)
VALUES (
  'solana-mainnet',
  'solana',
  'Solana',
  'solana',
  'solana-mainnet',
  -1,
  'L1',
  'SOL',
  true
)
ON CONFLICT (network_key) DO UPDATE
SET
  description = EXCLUDED.description,
  display_name = EXCLUDED.display_name,
  ecosystem = EXCLUDED.ecosystem,
  layer_type = EXCLUDED.layer_type,
  native_asset_symbol = EXCLUDED.native_asset_symbol,
  is_active = EXCLUDED.is_active;

INSERT INTO public.ref_chain_assets (
  chain_id,
  asset_key,
  symbol,
  name,
  token_address,
  decimals,
  is_native,
  is_stablecoin,
  is_active,
  sort_order
)
SELECT chains.id, assets.asset_key, assets.symbol, assets.name, assets.token_address, assets.decimals, assets.is_native, assets.is_stablecoin, true, assets.sort_order
FROM (
  VALUES
    ('native', 'SOL', 'Solana', NULL, 9, true, false, 0),
    ('usdc', 'USDC', 'USD Coin', 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', 6, false, true, 1)
) AS assets(asset_key, symbol, name, token_address, decimals, is_native, is_stablecoin, sort_order)
JOIN public.ref_chains chains ON chains.network_key = 'solana-mainnet'
ON CONFLICT (chain_id, asset_key) DO UPDATE
SET
  symbol = EXCLUDED.symbol,
  name = EXCLUDED.name,
  token_address = EXCLUDED.token_address,
  decimals = EXCLUDED.decimals,
  is_native = EXCLUDED.is_native,
  is_stablecoin = EXCLUDED.is_stablecoin,
  is_active = EXCLUDED.is_active,
  sort_order = EXCLUDED.sort_order;

WITH solana_settings AS (
  SELECT
    chains.id AS chain_id,
    'deposit_address'::public.payment_collection_mode AS collection_mode,
    COALESCE(NULLIF(current_setting('app.settings.solana_program_address', true), ''), '11111111111111111111111111111111') AS contract_address,
    COALESCE(NULLIF(current_setting('app.settings.solana_treasury_address', true), ''), '11111111111111111111111111111111') AS treasury_address,
    'solana-transfer-v1'::text AS abi_version
  FROM public.ref_chains chains
  WHERE chains.network_key = 'solana-mainnet'
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
  settings.chain_id,
  settings.collection_mode,
  settings.contract_address,
  settings.treasury_address,
  settings.abi_version,
  settings.treasury_address <> '11111111111111111111111111111111'
FROM solana_settings settings
ON CONFLICT (chain_id, collection_mode) DO UPDATE
SET
  contract_address = EXCLUDED.contract_address,
  treasury_address = EXCLUDED.treasury_address,
  abi_version = EXCLUDED.abi_version,
  is_active = EXCLUDED.is_active;
