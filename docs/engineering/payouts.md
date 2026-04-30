# Outbound Payout Domain

Session 27 introduced the first-class outbound payout domain. It is intentionally separate from founder contribution collection.

## Domain Objects

- `user_payout_routes` stores user-owned payout destinations and preferences across supported rails.
- `payout_intents` stores concrete outbound obligations created from approved monthly-cycle user results.
- `payout_batches` groups ready intents for later rail-specific execution.
- `payout_batch_items` links intents into batches without losing the original obligation row.
- `payout_reconciliation_events` records observed execution and reconciliation outcomes.

## Rails

The initial rail enum is:

- `evm`
- `solana`
- `fiat_stub`

The enum exists now so the product and operator model can be multi-rail before all execution adapters are live.

## Monthly Cycle Handoff

`monthly-cycle-payout-intents-create` converts approved `zkas_published_user_results` into `payout_intents`.

The command is idempotent per published result and cycle. It creates:

- `ready` intents when a user has an active default payout route
- `draft` intents when the user still needs to configure a route

This keeps missing user preferences visible without blocking the whole cycle from entering distribution work.

## What Is Not Included Yet

Session 28 added the chain-abstracted execution interface in `lib/execution/`. It can now build deterministic payout batch drafts from ready intents.

Session 31 added Solana-specific payout batch draft scaffolding. Solana payout drafts now validate Solana destination addresses and produce a `fundloop-solana-payout-batch.v1` payload with manual-transfer scaffold metadata, network keys, and token mint summaries.

The app still does not execute payouts, publish user earnings history, or reconcile external transfers. Those remain later payout execution and user workspace sessions.
