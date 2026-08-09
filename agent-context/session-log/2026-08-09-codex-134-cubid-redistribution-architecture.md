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
