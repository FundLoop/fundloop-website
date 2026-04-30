# Chain-Abstracted Execution Interface

Session 28 introduced the backend-facing execution interface that future EVM, Solana, and fiat adapters should implement.
Session 29 moved the existing EVM inbound receipt-recording command behind that interface.
Session 30 added the first Solana inbound contribution adapter behind the same deposit intent and receipt-verification contract.

The goal is to keep pages, monthly-cycle workflow code, and agent protocols FundLoop-centric. Chain details should live behind execution adapters instead of leaking into route handlers or UI components.

## Interface Surface

The canonical TypeScript boundary lives under `lib/execution/`.

It defines stable operations for:

- creating a deposit intent
- verifying a deposit receipt
- creating a payout batch draft
- executing a payout batch
- reconciling payout status

The initial rails are:

- `evm`
- `solana`
- `fiat_stub`

## Current Adapter State

Session 29 moved the existing live EVM payment receipt-recording flow behind the adapter boundary while preserving the user-facing wallet flow.

- The EVM adapter can create a FundLoop-facing deposit intent from an existing route snapshot.
- The EVM adapter verifies submitted receipt metadata and amount matching before the payment command records an `onchain_payment_submissions` row.
- EVM payout execution and payout reconciliation are explicit `capability_not_implemented` responses for now.
- The Solana adapter can create a deposit-address intent for SOL/SPL token routes and verifies submitted transaction signatures plus amount matching before the shared payment command records the onchain submission.
- Solana payout execution and payout reconciliation remain explicit `capability_not_implemented` responses for now.
- Fiat-stub is a registered scaffold with payout-batch draft creation available and execution still unsupported.
- Payout batch draft creation is rail-agnostic and deterministic: it validates same rail/currency, requires routed positive intents, sorts by user/id, and produces a stable execution payload.

## Why This Exists Before More Chain Work

Sessions 29-32 should use this boundary before adding or moving rail-specific logic.

Expected next steps:

- Session 29 moved the existing EVM inbound receipt-recording command behind the adapter contract.
- Session 30 added Solana inbound scaffolding behind the same deposit interfaces.
- Session 31 extends payout execution scaffolding for Solana.
- Session 32 adds intentional fiat stubs for inbound and outbound rails.

No product surface should directly branch on chain details once a workflow is migrated. It should ask the execution registry for the rail adapter and operate on FundLoop concepts such as deposits, payout intents, batches, receipts, and reconciliation outcomes.
