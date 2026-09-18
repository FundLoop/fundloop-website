# Session Log: fix/251-exact-source-conservation

### session v1: Reconcile truncated exact dispositions so sources conserve exactly (#251)

- **Timestamp:** 2026-09-18T12:30:00Z
- **Agent:** Claude Code (Claude Opus 5)
- **Branch:** `fix/251-exact-source-conservation`
- **Head before commit:** `d4ef7a5`

---

#### Objective

Fix #251: `calculateFundedRedistributionV2` threw `funded_allocation_v2_invariant_failed` whenever a lot's per-member share was a non-terminating decimal (cohorts of 3, 6, 7, 9, 11…), because `exactSourceConserved` summed disposition `exactUsd` strings that `decimalString()` had truncated to 18 decimals.

---

#### Actions Taken

- Added `reconcileExactDispositions` to `lib/monthly-cycles/funded-redistribution-v2-calculator.ts`. For each source, the conserved rows (`initial_claim`, `top_up`, `carryout_residue`) are floored to 1e-18 units. The shortfall (an integer that is at most the row count) is handed back one unit at a time to the rows with the largest truncation remainder, ties broken by row order. Rows are only adjusted when a shortfall exists.
- Conserved rows now record their exact `Fraction` as they are built. Reconciliation runs before the invariant checks, so the existing `exactSourceConserved` check is unchanged and now passes.
- Added regression tests: cohorts of 3/6/7/9/11 members, a mixed-score/overlap/pool case, and a bound that every reconciled row is floor or floor + 1e-18 of its exact value.

---

#### Validation Notes

- The new tests fail on `dev` (7 failures) and pass with the fix.
- `calculator` + `allocator-currency-binding` tests: 24/24. Full Vitest: 1159/1159. `tsc --noEmit` and scoped ESLint pass.
- #216 parity fixtures (50, from `feat/209-standalone-allocator`): 50/50 now succeed with all invariants true. The 17 fixtures that already succeeded produce **byte-identical outcomes**, so existing result hashes are unchanged.
- `epoch_allocation_v2_four_epoch_lifecycle.sh` (runs the real calculator, persists to `numeric(38,18)`, and applies the SQL close-time exact conservation check) passes after a fresh `supabase db reset --local`.
- `deno check supabase/functions/epoch-funded-allocation/index.ts` reports only the pre-existing `Buffer` global in `lib/cubid/private-allocator-client.ts`, the same as on `dev`.

---

#### Reflections

The SQL close check (`epoch_close_exact_source_conservation_failed`) sums persisted `exact_usd numeric(38,18)` values. Because reconciled rows have at most 18 decimals and sum exactly to the source in 1e-18 units, the database sum is exact as well. Every existing calculator test used cohort sizes that divide evenly; the #216 synthetic sweep is what exposed this.

---

#### Suggested Next Steps

- After merge, rebase `feat/209-standalone-allocator` on `dev`, regenerate `golden-v1.json` (expect 50/50 successful outcomes), and mark the #216 harness as no longer WIP.
- A persisted end-to-end SQL fixture with a 3-member cohort would add direct database coverage for this path.
