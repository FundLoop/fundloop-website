# Shadow financial reconciliation

Task #129 records immutable provider/chain fixtures, deduplicates canonical provider event IDs, classifies out-of-order observations, applies funding only up to settled native amounts, and compares custody balances by account and asset with explicit tolerances. Receipt, fee, allocation, payout, and suspense journals require exact native and functional conservation. Legacy timestamps are retained only as labelled non-settlement evidence.

All tables and commands are service-only, provisional, and production-disabled. The observability view explains unmatched native amounts without switching canonical allocations, creating payables, calling providers, or transferring value. Close packages are scaffolding only.
