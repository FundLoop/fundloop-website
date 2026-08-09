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
4. combine every project shortfall into one epoch redistribution pool;
5. raise the lowest current user totals first through deterministic water-filling;
6. stop each user at three times that user's largest single-project initial claim;
7. return or carry forward any cap-exhausted residue to its originating funded
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
untracked fungible balance. Project shortfalls create source-linked pool lots.
Top-ups consume those lots in a versioned stable order and record partial-lot
splits. Unconsumed lots retain their original project, rail, asset, native, FX, and
USD dimensions when returned or carried forward.

Redistribution principal is funded epoch value. It is never classified as a
platform fee, platform revenue, treasury sweep, user payable, or newly created
value. Fee recognition and treasury sweeps occur before the distributable project
pool is measured.

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
final_cap(u) = 3 * baseline(u)
```

The baseline is the largest single-project score-adjusted initial claim. It is not
the aggregate initial claim, a raw point-proportional entitlement, or a value
derived from project overlap.

### 4. Global Epoch Redistribution Pool

```text
epoch_redistribution_pool = sum(project_pool_contribution(u,p))
```

All included project shortfalls enter this one pool. They do not remain restricted
to users of the originating project, but their source provenance remains intact.

### 5. Lowest-current-total-first Water-filling

Initialize each user's current total to `aggregate_initial_claim(u)`. Repeatedly:

1. select uncapped users with the lowest current total;
2. raise the tied lowest group together toward the next-lowest current total or a
   member's cap, whichever comes first;
3. consume no more than the remaining redistribution pool;
4. remove capped users and continue until the pool is exhausted or no user has cap
   capacity.

Deterministic ordering is:

1. lowest current total;
2. lowest aggregate initial claim;
3. lowest baseline; and
4. stable user ID.

Exact-decimal water-filling treats a tied group equally. Stable user ID is used
only where indivisible minor units or an otherwise exact tie require assignment.
No final allocation may exceed `3 * baseline`.

### 6. Returned Or Carried-forward Residue

If every eligible user reaches the cap before the pool is exhausted:

```text
epoch_redistribution_pool =
  sum(redistribution_top_up) + sum(returned_or_carryover_residue)
```

Residue is emitted as deterministic source-linked rows and returns or carries
forward under the originating lot's project, rail, asset, native, FX, and USD
provenance. It is not a user credit, fee, revenue, or payable.

### 7. Rounding

- preserve exact decimal theoretical shares, claims, pool lots, and water levels in
  the artifact;
- round canonical user awards in integer minor USD units only after water-filling;
- assign user residual minor units by descending fractional remainder, then stable
  user ID;
- split source-lot native quantities under the asset's exact atomic-unit rules;
- assign source residuals through the versioned stable lot order; and
- prove rounded user awards plus rounded returned residue equal the rounded funded
  pool, while native source quantities conserve exactly.

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
fixture each B user is locked at `10/20`, so the `$10` theoretical share becomes a
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
- aggregate initial claims, baselines, and caps;
- ordered water-filling steps and redistribution top-ups;
- final provisional allocations and cap status;
- stable rounding decisions and asset/source fills;
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
- equal theoretical shares, score-adjusted claims, and pool contributions recompute;
- water-filling order, ties, caps, and rounding reproduce deterministically;
- `final_allocation <= 3 * baseline` for every user;
- funded pool equals initial claims plus pool contributions;
- pool contributions equal top-ups plus returned/carryover residue;
- final allocations equal initial claims plus top-ups;
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
