# Shadow financial reconciliation

Task #129 records immutable provider/chain fixtures, deduplicates canonical provider event IDs, classifies out-of-order observations, applies funding only up to settled native amounts, and compares custody balances by account and asset with explicit tolerances. Receipt, fee, allocation, payout, and suspense journals require exact native and functional conservation. Legacy timestamps are retained only as labelled non-settlement evidence.

All tables and commands are service-only, provisional, and production-disabled. The observability view explains unmatched native amounts without switching canonical allocations, creating payables, calling providers, or transferring value. Close packages are scaffolding only.

Every shadow journal created by the typed command references one immutable neutral-ledger transaction. Trial balance rows expose exact native and functional amounts by period, transaction, account, asset, and custody account. Custody reconciliation derives its shadow balance from debit-normal ledger postings; callers cannot certify a supplied shadow total, and append-only reversals change the derived balance.
