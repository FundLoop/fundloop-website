# Allocation Architecture

Last updated: 2026-08-09

Related docs:

- [Engineering Docs Index](./README.md)
- [Operational MVP](./operational-mvp.md)
- [Monthly Cycle Domain Model](./monthly-cycles.md)
- [Settlement-backed Epoch Treasury](./settlement-backed-epoch-treasury.md)
- [Outbound Payout Domain](./payouts.md)

## Summary

FundLoop allocation converts fee-processed, settled, journal-backed project value
into provisional user awards. The approved Goal #134 model is a deterministic,
USD-normalized Cubid-score discount followed by one global epoch redistribution:

1. divide each funded project pool equally among that project's eligible users;
2. discount each theoretical share by the user's locked Cubid score divided by the
   locked maximum score;
3. aggregate score-adjusted initial claims across projects;
4. clamp any aggregate initial claim above three times its largest single-project
   claim and contribute the proportionally sourced overflow to the pool;
5. combine every score-discount shortfall and overlap-cap overflow into one epoch
   redistribution pool;
6. raise the lowest current user totals first through deterministic water-filling;
7. exclude users already at cap from top-ups; and
8. return or carry forward any cap-exhausted residue to its originating funded
   sources.

This model explicitly supersedes allocation based on a user's share of total
project points, the sum of eligible scores, or an overlap-derived remainder. A
Cubid score is an individual factor against an equal theoretical project share; it
is not a proportional weight against other users' scores.

The allocator remains a pure calculation package. It consumes one immutable lock
manifest, produces deterministic artifacts and hashes, and performs no live reads,
provider calls, posting, or value transfer.

## Locked Inputs

The allocator consumes only immutable, versioned inputs:

- approved project packages and eligible project-user cohorts;
- fee-processed funding applications backed by reconciled custody and ledger
  postings;
- source lots identified by project, rail, asset, native amount, custody context,
  FX snapshot, and functional USD;
- one positive, versioned locked maximum Cubid score;
- each eligible user's locked score, bounded from zero through that maximum;
- project-scoped pseudonymous identity references and inclusion evidence;
- the epoch FX snapshot and deterministic minor-unit rules;
- user asset preferences and payout eligibility for later fulfillment only; and
- stable project, user, source-lot, asset, and epoch identifiers.

Declared contribution amounts, mutable activity points, unconfirmed receipts,
unresolved receivables, draft cohorts, post-lock identity changes, and
post-lock preference changes are not canonical allocation inputs. A project with
no eligible users does not contribute value to the global pool; its funded sources
follow the explicit return or carryover workflow.

## Eligibility And Privacy

A user is eligible for a project only when the locked package proves a valid,
whitelisted Cubid identity, approved project-scoped inclusion, and resolution to
the FundLoop user represented in the manifest. Greylisted, blacklisted, invalid,
expired, or unresolved evidence follows the versioned exclusion or hold rules.

Operators may inspect the complete audit graph. A project sees only its own
project-scoped pseudonyms, inputs, and outcomes. Users see only their own
project-source breakdown. Project and public read models must not expose raw Cubid
evidence, cross-project membership, another project's pseudonym, or a join key that
reveals the overlap used by redistribution. Public reporting remains aggregate and
subject to the approved anti-correlation thresholds.

## Funded Source Model

Each post-fee distributable source remains an immutable provenance lot containing:

- `epochId` and `originProjectId`;
- rail, asset, custody account, and external/funding reference;
- exact native quantity and asset decimals;
- locked FX snapshot and exact functional-USD value;
- carryover origin and predecessor lot when applicable; and
- manifest position and stable source-lot key.

The global redistribution pool is a calculated total over these lots, not an
untracked fungible balance. Score-discount shortfalls and overlap-cap overflow each
create source-linked pool lots. Top-ups consume those lots in a versioned stable
order and record partial-lot splits. Unconsumed lots retain their original project,
rail, asset, native, FX, and USD dimensions when returned or carried forward.

Redistribution principal is funded epoch value. It is never classified as a
platform fee, platform revenue, treasury sweep, user payable, or newly created
value. Fee recognition and treasury sweeps occur before the distributable project
pool is measured.

### Implemented funded-input boundary (Task #135)

The local/dev review path now materializes `epoch_valuation_source_lots` before
allocation. Each lot retains its approved project package and funding-source ID,
project, rail, financial asset, custody account, native atomic quantity, posted FX
snapshot, exact 18-decimal gross/project-fee/base-fee/distributable USD values,
canonical minor-unit scale, and deterministic source order. The lock-candidate
view joins those lots to the package's eligible cohort and exposes the locked Cubid
score, versioned maximum score, and eligible-user count without computing a claim.

The four `$0.335` precision fixture is stored as four independent exact source lots;
it is not pre-aggregated or rounded to cents. Carryover creates a successor lot with
an explicit predecessor reference and the same funded-principal classification.
Reserved value cannot be harvested. These are provisional funded epoch inputs—not
fees, recognized revenue, user payables, provider instructions, or production value
flow—and all Task #135 commands deny production.

## Allocation Algorithm

All equations use exact decimal functional USD until the rounding stage.

### 1. Equal Theoretical Project Share

For each funded project `p`:

```text
theoretical_share(p) = funded_project_pool_usd(p) / eligible_user_count(p)
```

Every eligible user in the same project receives the same theoretical share before
the Cubid factor. Project activity points and the sum of cohort scores do not alter
this share.

### 2. Score-adjusted Initial Project Claim

For eligible user `u` in project `p`:

```text
score_factor(u,p) = locked_score(u,p) / locked_max_score
initial_project_claim(u,p) = theoretical_share(p) * score_factor(u,p)
project_pool_contribution(u,p) = theoretical_share(p) - initial_project_claim(u,p)
```

The maximum score must be positive and versioned. A score outside
`0 <= locked_score <= locked_max_score` is a hard failure. The score-adjusted claim
and its shortfall retain the funded source mix of the theoretical share.

For every project:

```text
funded_project_pool_usd =
  sum(initial_project_claim) + sum(project_pool_contribution)
```

### 3. Aggregate Initial Claim And Baseline

For each user:

```text
aggregate_initial_claim(u) = sum(initial_project_claim(u,p))
baseline(u) = max(initial_project_claim(u,p))
exact_final_cap(u) = 3 * baseline(u)
minor_unit_cap(u) = floor_to_allocation_minor_unit(exact_final_cap(u))
```

The baseline is the largest single-project score-adjusted initial claim. The
canonical executable cap is `minor_unit_cap`, never a nearest-rounded or ceiling
version of the exact cap. It is not
the aggregate initial claim, a raw point-proportional entitlement, or a value
derived from project overlap. A user with a zero baseline has a zero cap.

### 4. Pre-redistribution Cap Clamp

The cap applies before redistribution as well as after it. For every user:

```text
retention_factor(u) =
  1                                        when aggregate_initial_claim(u) <= exact_final_cap(u)
  exact_final_cap(u) / aggregate_initial_claim(u)  otherwise

proportional_retained_initial_lot(u,p,source) =
  initial_project_source_lot(u,p,source) * retention_factor(u)

proportional_overlap_overflow_lot(u,p,source) =
  initial_project_source_lot(u,p,source)
  - proportional_retained_initial_lot(u,p,source)

raw_retained_target(u) = sum(proportional_retained_initial_lot(u,p,source))
canonical_retained_target(u) =
  min(floor_to_allocation_minor_unit(raw_retained_target(u)), minor_unit_cap(u))
```

The raw proportional target is `min(aggregate_initial_claim, exact_final_cap)`.
The exact ledger is immutable: for every source,
`exact_initial = exact_retained + exact_overflow`, every term is non-negative, and
`exact_retained = exact_initial × retention_factor`. Canonical rounding never
rewrites these exact terms.

The canonical retained target is the lesser of the raw target floored to the
allocation minor unit and `minor_unit_cap`. Canonical retained-lot assignment may
never exceed that target or cap. Canonical pre-redistribution current is
`sum(canonical_retained_minor_lot)`, never the higher raw target. The exact amount
between raw and canonical targets is a separately recorded, source-provenance
`sub_minor_residual`; it is not computed as exact retained minus a rounded lot and
is not an exact overflow source lot.
When aggregate initial value exceeds the cap, each project/source initial lot is
scaled by the same exact factor. Each lot's exact difference becomes
source-preserving overlap-cap overflow in the global pool. The clamp may not choose
one project to absorb another project's overflow or erase rail, asset, native, FX,
or USD provenance.

A user whose canonical pre-redistribution current equals the minor-unit cap is not a water-filling
candidate. With non-negative initial lots, a zero baseline means every initial lot
is zero; the user has cap zero, retains zero, and receives no redistribution top-up.

### 5. Global Epoch Redistribution Pool

```text
epoch_redistribution_pool =
  sum(score_discount_pool_contribution(u,p,source))
  + sum(total_overlap_cap_overflow_lot(u,p,source))
```

All included score-discount shortfalls and overlap-cap overflow enter this one pool.
They do not remain restricted to users of the originating project, but their source
provenance remains intact.

### 6. Lowest-current-total-first Water-filling

Initialize each user's current total to `pre_redistribution_current(u)`. Repeatedly:

1. select uncapped users with the lowest current total;
2. raise the tied lowest group together toward the next-lowest current total or a
   member's cap, whichever comes first;
3. consume no more than the remaining redistribution pool;
4. remove capped users and continue until the pool is exhausted or no user has cap
   capacity.

Exact continuous water-filling treats every equal-current user equally until the
next level, a cap, or pool exhaustion. Aggregate initial claim and baseline do not
break an equal-current tie. Only after exact targets are fixed are indivisible
canonical minor units assigned: descending fractional remainder of the exact user
target, then stable user ID, with cap-aware skipping. An unassignable next unit
continues to the next eligible user or remains source-linked residue.
No final allocation may exceed `minor_unit_cap`, and a user that begins at cap receives
no top-up.

### 7. Returned Or Carried-forward Residue

If every eligible user reaches the cap before the pool is exhausted:

```text
epoch_redistribution_pool =
  sum(redistribution_top_up) + sum(returned_or_carryover_residue)
```

Residue is emitted as deterministic source-linked rows and returns or carries
forward under the originating lot's project, rail, asset, native, FX, and USD
provenance. It is not a user credit, fee, revenue, or payable.

### 8. Rounding

- preserve exact decimal theoretical shares, initial lots, retention factors,
  retained lots, overflow lots, pool lots, and water levels in the artifact;
- maintain separate exact-decimal and canonical integer-minor-unit ledgers; never
  substitute a rounded lot into an exact source identity;
- derive canonical initial source units first: round the exact funded canonical
  total under the versioned currency rule, floor each exact initial source lot, then
  assign residual units by descending fractional remainder and stable
  project/rail/asset/source-lot ID;
- calculate cap scaling before any minor-unit rounding;
- assign canonical retained units to the floored, cap-bounded retained target by
  constrained largest remainder over exact retained lots: require
  `0 <= retained_minor_lot <= initial_minor_lot`, skip saturated/zero-capacity lots,
  and use stable project/rail/asset/source-lot ID after fractional remainder;
- define `overflow_minor_lot = initial_minor_lot - retained_minor_lot`; it is always
  non-negative, and canonical initial equals canonical retained plus canonical
  overflow for every source;
- make every retained-lot and final-award residual assignment cap-aware: skip a
  user/source assignment whenever its next unit would make the user's retained or
  final total exceed `minor_unit_cap`;
- track sub-minor exact residual and deterministic cross-source residual transfers
  separately with original project/rail/asset/native/FX/USD provenance. Residual
  may combine into a canonical pool unit, fund another uncapped user, or become
  returned/carryover residue; it never creates a negative exact or canonical lot;
- apply the same largest-remainder and stable-key rule within each
  rail/asset/custody group when an exact factor crosses atomic native units, and set
  overflow native units to original minus retained units;
- round canonical user awards in integer minor USD units only after water-filling;
- assign user residual minor units by descending fractional remainder, then stable
  user ID, skipping capped candidates rather than crossing their cap;
- split source-lot native quantities under the asset's exact atomic-unit rules;
- assign source residuals through the versioned stable lot order; and
- prove exact source decimals conserve and, independently, integer minor-unit user
  awards plus integer minor-unit pool/residue equal the integer minor-unit funded
  pool. No fractional or integer unit may be lost or assigned twice.

### 9. Arbitrary-overlap Invariants

For any number of overlapping project initial lots, including zero and one:

```text
sum(canonical_retained_minor_lot + canonical_overflow_minor_lot) =
  sum(canonical_initial_minor_lot)

exact_initial_source_lot =
  exact_retained_source_lot + exact_overflow_source_lot

canonical_initial_minor_lot =
  canonical_retained_minor_lot + canonical_overflow_minor_lot

raw_proportional_retained_target = min(aggregate_initial_claim, 3 * baseline)

canonical_pre_redistribution_current =
  min(floor_to_allocation_minor_unit(raw_proportional_retained_target),
      floor_to_allocation_minor_unit(3 * baseline))

exact_funded_epoch_pool =
  sum(exact_retained_source_lot)
  + sum(exact_score_discount_pool_lot)
  + sum(exact_overflow_source_lot)

canonical_funded_epoch_minor_units =
  sum(canonical_retained_minor_lot)
  + sum(canonical_score_discount_minor_lot)
  + sum(canonical_overflow_minor_lot)
```

These identities must hold separately in exact decimals and integer functional-USD minor units,
and exact native atomic units. Permuting project/source input order cannot change
retained totals, overflow totals, final allocations, or the result hash.

### Fractional Cap Fixture

Four source lots of `$0.335` produce aggregate initial `$1.34`, baseline `$0.335`,
exact cap `$1.005`, and canonical cent cap `$1.00`. Raw proportional retention is
`$0.25125` per source, totaling `$1.005`, with `$0.08375` exact overflow per
source and `$0.335` exact overflow total. Cap-aware canonical retained-lot rounding emits four
`$0.25` retained lots totaling `$1.00`, never `$1.01`. The exact `$0.005` retained
target remainder is recorded separately with source provenance and joins the
canonical pool/residue bridge. The exact ledger conserves
`$1.005 + $0.335 = $1.34`; the canonical ledger independently conserves
100 retained + 34 overflow = 134 cents. No source has negative overflow, and no
fraction or cent is lost or assigned twice.

### Non-negative Source-lot Counterexample

Two exact retained source lots of `$0.006` have a one-cent canonical retained
target. First derive canonical initial capacity from the exact funded total: stable
largest remainder assigns one initial cent to the lower stable source ID and zero
to the other. Constrained retained rounding assigns that one cent only to the
one-cent-capacity source; canonical overflow is zero for both, never `-$0.004`.
The exact ledger independently records `$0.006 = $0.006 + $0` for each source.
The cross-source rounding transfer and remaining `$0.002` sub-minor residual stay
source-provenanced outside exact overflow and reconcile the exact `$0.012` total to
the canonical one-cent total.

### One-cent Equal-current Tie Fixture

Two uncapped users have the same exact current total, equal capacity, and exact
top-up targets of `$0.005` each when one canonical cent remains. Continuous
water-filling treats them equally. Their fractional remainders tie, so the lower
stable user ID receives the cent; aggregate initial claim and baseline are ignored.
Reversing user or source input order produces the same recipient and result hash.

## Canonical A+B Fixture

Project A has `$300`, three eligible users, locked scores `5`, `10`, and `15`, and a
locked maximum score of `20`.

```text
theoretical share per A user = $300 / 3 = $100
initial A claims             = $25, $50, $75
A pool contributions         = $75, $50, $25
A redistribution total       = $150
```

Project B has `$1,000` and 100 eligible users. In the canonical deterministic
fixture the 100 B users are each exactly `10/20`, so the `$10` theoretical share becomes a
`$5` initial claim.

```text
aggregate B initial claims   = 100 * $5 = $500
B redistribution total       = $500
combined epoch pool          = $150 + $500 = $650
```

The three A users are also B users. Their aggregate initial claims are `$30`, `$55`,
and `$80`; their baselines are `$25`, `$50`, and `$75`. The other 97 B-only users
each begin at `$5`, with a `$5` baseline and `$15` cap. Lowest-current-total-first
water-filling therefore sends the entire `$650` to the 97 B-only users before any
A+B user. Exact top-up is `$650 / 97`; after cent rounding, 10 stable user IDs
receive `$6.71` and 87 receive `$6.70`. No user reaches the `$15` cap, no A+B user
receives a top-up, and no residue remains.

## Four-project Overlap Cap Fixture

One user has four score-adjusted project/source initial lots of `$100` each:

```text
aggregate initial claim      = $400
baseline                     = $100
cap                          = 3 * $100 = $300
retention factor             = $300 / $400 = 0.75
retained source lots         = $75, $75, $75, $75
overlap-cap overflow lots    = $25, $25, $25, $25
pre-redistribution current   = $300
```

The `$100` overflow joins the global pool with all four project/source identities
intact. The user begins at cap and receives no top-up; water-filling proceeds only
to other uncapped users. If no uncapped capacity remains, the four `$25` lots return
or carry forward through their originating funded sources.

## Asset Fulfillment

Asset preferences affect later source fulfillment only; they never change the USD
allocation. Fulfillment consumes eligible source lots in the approved deterministic
order, may split a user's award across accepted assets, and must retain the exact
project/rail/asset/native/FX/USD source fills. Unfulfillable value follows the same
source-linked return or carryover rules and is not presented as a user award.

## Deterministic Outputs

The calculation artifact contains at least:

- funded project pools and immutable source lots;
- eligible project-user counts and theoretical shares;
- locked score, locked maximum score, and score factor;
- initial project claims and project pool contributions;
- aggregate initial claims, exact and canonical caps, retention factors, separate
  exact/canonical initial-retained-overflow source lots, and sub-minor residuals;
- ordered water-filling steps and redistribution top-ups;
- final provisional allocations and cap status;
- stable exact/canonical rounding decisions, constrained source capacities,
  sub-minor residual transfers, and asset/source fills;
- returned or carryover residue with complete provenance;
- excluded users and typed reason codes;
- conservation, privacy, and production-gate results; and
- canonical input, result, and root hashes.

The current point-proportional calculator and its old raw-entitlement/remainder
outputs are legacy compatibility surfaces. Task #136 must replace or version them;
they cannot be the canonical Goal #134 result and must remain production-disabled.

## Verification Requirements

Verification must prove:

- the exact locked manifest hash was consumed;
- every project dollar is settled, applied, journal-backed, fee-processed, and
  linked to immutable source provenance;
- every user and score/max pair was eligible and locked;
- equal theoretical shares, score-adjusted claims, pre-redistribution cap clamps,
  retained lots, and both pool-contribution classes recompute;
- continuous equal-current water-filling and the sole minor-unit tie rule reproduce
  deterministically under user/source input permutation;
- `final_allocation_minor <= floor_to_minor_unit(3 * baseline)` for every user;
- every exact initial lot equals non-negative exact retained plus exact overflow;
- every canonical initial lot equals bounded canonical retained plus non-negative
  canonical overflow;
- funded pool equals retained initial lots plus score-discount contributions plus
  overlap-cap overflow;
- score-discount contributions plus overlap-cap overflow equal top-ups plus
  returned/carryover residue;
- final allocations equal pre-redistribution current plus top-ups;
- capped and zero-baseline users receive no top-up;
- arbitrary overlap count and input permutation properties hold;
- native, FX, and functional-USD source conservation all hold;
- project/public outputs cannot reveal cross-project membership; and
- production allocation, payable posting, provider calls, and real value flow are
  fail-closed.

## Reporting Boundary

User reporting may show the user's provisional total and permitted project/source
breakdown. Founder reporting may show only that founder's project cohort and
aggregate source/pool results. Public reporting may show approved aggregate project
and epoch totals only after privacy thresholds pass. Authorized operators may see
the full provenance and overlap evidence.

Allocation and approval are conditional internal records. They do not create user
ownership, a general-ledger payable, an external transfer, or a production value
flow. Production activation remains blocked on the named accounting, legal,
privacy, custody, and payout gates.
