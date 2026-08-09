### session v1: Cubid redistribution architecture rescope (#134-#137)

- Timestamp: 2026-08-09T02:30:58-04:00
- Agent: Codex
- Branch: codex/134-cubid-redistribution-architecture
- Head: 25233cf

#### Objective

Align the repository architecture with the approved Goal #134 allocation rescope
without changing product code, schema, issue state, or production behavior.

#### Actions Taken

- Replaced the legacy point-proportional project entitlement and overlap-derived
  remainder model with equal theoretical project shares discounted by locked Cubid
  score divided by the versioned locked maximum score.
- Defined one global epoch redistribution pool, aggregate initial claims,
  largest-single-project baseline, deterministic lowest-current-total-first
  water-filling, stable tie/rounding rules, and the `3 ×` final cap.
- Defined immutable source-lot provenance for initial claims, top-ups, and
  cap-exhausted returned/carryover residue across project, rail, asset, native, FX,
  and functional USD.
- Recorded that redistribution is funded principal rather than fee, revenue,
  treasury sweep, payable, or new value.
- Added the exact A+B fixture and propagated the formulas, conservation equations,
  privacy boundary, provisional-award semantics, and production fail-closed gate
  across the allocation, operational MVP, treasury, sprint, and issue-tree docs.
- Explicitly superseded the current legacy calculator policy pending Task #136.

#### Validation Notes

- Passed scoped Markdown local-link resolution for all five edited architecture files.
- Passed contradiction audit for legacy raw-entitlement, sum-of-scores,
  score-proportional, and overlap-remainder formulas.
- Passed executable A+B arithmetic/cent-rounding probe: `$650` distributed across
  97 B-only users as ten `$6.71` and eighty-seven `$6.70` top-ups; total conserved
  at `$1,300`.
- Passed `pnpm lint` and `git diff --check`.
- No dedicated Markdown/static-doc test command exists in the repository.

#### Suggested Next Steps

- Use these architecture contracts while vetting and implementing Tasks #135-#137.
- Keep production allocation, award posting, and real value flow fail-closed until
  the named professional, privacy, custody, and launch gates are satisfied.

### session v2: Pre-redistribution overlap cap correction (#134/#136)

- Timestamp: 2026-08-09T02:43:42-04:00
- Agent: Codex
- Branch: codex/134-cubid-redistribution-architecture
- Head: a8e7f71

#### Objective

Close the architecture validation gap for users whose aggregate score-adjusted
initial claims already exceed the `3 ×` largest-project baseline before
redistribution begins.

#### Actions Taken

- Defined `pre_redistribution_current = min(aggregate_initial, cap)` and excluded
  users already at cap, including zero-baseline users, from top-ups.
- Required an exact `cap / aggregate` factor across every project/source initial lot
  when aggregate exceeds cap; retained lots keep the factor and each exact difference
  enters the global pool as source-linked overlap-cap overflow.
- Defined the global pool as score-discount shortfalls plus overlap-cap overflow and
  extended returned/carryover provenance to both contribution classes.
- Added exact-decimal, USD minor-unit, and native atomic-unit residual rules using
  fractional remainder plus stable project/rail/asset/source-lot identity.
- Added the four-project `[100,100,100,100]` fixture and arbitrary-overlap,
  source-order permutation, zero-baseline, and conservation requirements.
- Replaced every canonical B-fixture average with 100 users each exactly `10/20`.

#### Validation Notes

- Passed exact A+B fixture: ten B-only users receive `$6.71`, 87 receive `$6.70`,
  the `$650` pool is exhausted, and `$1,300` is conserved.
- Passed four-project fixture: four `$75` retained lots plus four `$25` overflow lots
  conserve the `$400` aggregate under the `$300` cap.
- Passed 1,000 deterministic randomized overlap cases with retained/overflow
  minor-unit conservation and source-order permutation equivalence.
- Passed scoped Markdown local-link and cap/fixture contradiction audits.
- Passed `pnpm lint` and `git diff --check`.

#### Suggested Next Steps

- Commit this docs-only validation correction and retain the production fail-closed
  boundary for later Task #136 implementation.

### session v3: Cap-aware minor-unit precision (#134/#136)

- Timestamp: 2026-08-09T02:54:51-04:00
- Agent: Codex
- Branch: codex/134-cubid-redistribution-architecture
- Head: 521f3f2

#### Objective

Close the final architecture precision gap where nearest rounding of an exact
`3 × baseline` cap could award one minor unit above the allowed cap.

#### Actions Taken

- Defined the canonical executable cap as the exact cap floored to the allocation
  minor unit and bounded both retained-lot and final-award targets by it.
- Distinguished raw proportional retention from canonical retained lots and moved
  cap-floor differences into source-linked global overflow.
- Made descending-fraction residual assignment cap-aware for source lots and users;
  capped candidates are skipped rather than receiving another unit.
- Required rejected exact fractions and minor units to retain project, rail, asset,
  native, FX, and USD provenance through pool use or returned/carryover residue.
- Added the four-`$0.335` fixture and exact-decimal versus integer-minor-unit
  conservation requirements throughout the Goal #134 and Task #136 architecture.

#### Validation Notes

- Passed the fractional fixture: 100 retained cents plus 34 source-linked overflow
  cents conserve 134 cents under a 100-cent cap; the award never becomes 101 cents.
- Passed the four-project overlap regression under its 30,000-cent cap.
- Passed 2,000 deterministic randomized cap-aware overlap cases with minor-unit
  conservation and source-order permutation equivalence.
- Passed the canonical A+B `$650` redistribution regression.
- Passed scoped Markdown local-link and precision-contradiction audits.
- Passed `pnpm lint` under Node 22 and `git diff --check`.

#### Suggested Next Steps

- Use the cap-aware integer contract as the executable acceptance rule for Task
  #136 while keeping production allocation and value flow fail-closed.
