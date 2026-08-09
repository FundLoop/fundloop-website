# Base stablecoin intake V2 (local review)

Status: provisional, non-production, and fail-closed.

`FundLoopBaseIntakeV2` accepts only the three constructor-bound token contracts labelled
USDC, USDT, and PYUSD. It snapshots the configured project's monotonic fee version and rate
in each receipt event and
transfers the fee and net amount directly to distinct platform and epoch treasuries. The
contract has no native-token, arbitrary-token, payable, or production deployment path.

The tracked manifest is deliberately disabled. The deployment script runs only when
`FUNDLOOP_DEPLOYMENT_ENV` is `local`, `dev`, or `test`, and only on chain ID 31337 or Base
Sepolia 84532. Local mock tokens additionally require `FUNDLOOP_LOCAL_BASE_FIXTURE_MODE=true`
and are labelled `local_fixture_only`. Base Sepolia binds USDC to Circle's reviewed address;
USDT and PYUSD remain zero-address, disabled slots until issuer evidence is reviewed. The script
prints a candidate manifest for review; it does not mutate tracked files,
Supabase, or any production deployment.

The database command boundary independently verifies deployment activation/paused state,
provider-address evidence, token, treasury, the exact historical fee version captured by the
receipt, and exact gross = fee + net conservation. Enabled deployment identity coordinates
cannot be mutated until their assets are disabled; pause and activation controls remain
available. Reconciliation status is derived from authoritative receipt-block confirmation
depth, exact transaction/log/receipt-reference identity, replacement evidence, and the two observed
treasury amounts. The reconciliation Edge request accepts only `receiptId`; trusted viem reads
the chain receipt, current block, exact indexed V2 event, and ERC-20 transfers before the service RPC can
record `trusted_viem_v1` evidence. Receipt and reconciliation evidence is append-only and inaccessible to
browser roles.

Issuer verification remains a production gate. Circle documents Base USDC and Base Sepolia
USDC addresses at <https://developers.circle.com/stablecoins/usdc-contract-addresses>.
Official issuer documentation inspected during implementation did not establish Base
addresses for USDT or PYUSD, so no mainnet addresses are activated or claimed. Local Hardhat
mocks exercise all three allowlist slots; production and the tracked manifest remain disabled.

## Local validation

1. Run `pnpm --dir contracts test` for exact treasury and adversarial contract behavior.
2. Start local Supabase, run a fresh reset, then execute
   `supabase/tests/base_intake_v2_reconciliation.sql`.
3. Run `CI=1 pnpm check` with Node 22.

Base Sepolia is optional and may be used only when an authorized test wallet, issuer test
tokens, and RPC credentials are already available. Never substitute mainnet assets.
