# Outbound Payout Domain

Session 27 introduced the first-class outbound payout domain. It is intentionally separate from founder contribution collection.

## Domain Objects

- `user_payout_routes` stores user-owned payout destinations across supported rails.
- `user_asset_preferences` stores user-owned asset selection preferences for future settlement planning. These preferences rank asset classes and codes, but they do not store transfer destinations.
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

`monthly-cycle-bookkeeping-credits-create` is the MVP handoff from approved calculation results into user-visible bookkeeping earnings. It creates rows in `monthly_cycle_bookkeeping_credits` from verified calculation output, preserving USD equivalent amount, selected asset fills, source/project breakdown, and allocator explanation metadata. These records are deliberately `credited` and `not_paid`: they prove the user's account has been credited in bookkeeping state, but they are not transfer instructions and they do not imply settlement has happened.

The legacy `monthly-cycle-payout-intents-create` result-to-intent command is retired. Approved close packages create withdrawal obligations; users then create one project-scoped asset reservation through `user-withdrawal-request-create`.

The withdrawal command is idempotent per user-supplied request key and immutable project/asset/route/amount snapshot. It creates a `draft` intent only after exact inventory is reserved; otherwise the request is queued without manufacturing an unbacked liability. Missing payout routes remain visible in the earnings workspace before request creation. Asset preferences are handled separately by `user_asset_preferences`; they guide future asset fulfillment planning but do not prove a destination is ready.

For the operational MVP, bookkeeping credits are the success target. Payout intents remain the later outbound-planning model for actual transfer readiness.

## What Is Not Included Yet

Session 28 added the chain-abstracted execution interface in `lib/execution/`. It can now build deterministic payout batch drafts from ready intents.

Session 31 added Solana-specific payout batch draft scaffolding. Solana payout drafts now validate Solana destination addresses and produce a `fundloop-solana-payout-batch.v1` payload with manual-transfer scaffold metadata, network keys, and token mint summaries.

Session 32 added fiat payout batch stubs. Fiat drafts validate placeholder destination methods or account references and produce a `fundloop-fiat-payout-batch.v1` payload with `provider_not_configured` metadata. This lets the product model fiat routes without implying a live payout provider.

Session 35 added the first signed-in user earnings workspace at `/[locale]/workspace/earnings`. Issue #83 updates that page to read `monthly_cycle_bookkeeping_credits` as the primary credited-but-not-paid earnings source, with older published-result and payout-intent details retained as settlement-readiness context.

Issue #84 extends the same bookkeeping boundary to founder and operator summaries. Founder project reporting uses project-scoped asset-fill rows and returned-pool rows to show how that project's contribution pool was credited or returned for a cycle. Operator cycle payout work shows cycle-wide bookkeeping-credit totals, not-paid counts, asset-fill counts, and returned future-pool rows separately from payout intents. These summaries are read-only visibility surfaces; they do not create payout intents, execute transfers, or expose private user payout destinations.

That page is read-only for now. It shows published monthly results, payout intents, route readiness, batch status, and reconciliation cues using the existing payout domain tables. It deliberately does not add payout-route editing or payout execution controls; those remain separate write-path sessions.

Issue #71 adds the first user-facing asset-preference UI. `/workspace/account` owns the editable ordered preference set, while `/workspace/earnings` shows the same preference readiness beside earnings and payout-route status. This keeps settlement asset selection separate from payout destinations: asset preferences say what the user would prefer to receive later; payout routes say where an actual transfer could go.

The app still does not execute payouts or reconcile external transfers from user-facing pages. Those remain later payout execution sessions.
