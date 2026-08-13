# Settled Cubid Redistribution v2

Status: implemented behind local, development, preview, and test controls. Production value flow remains disabled.

Privacy-boundary status: the [2026-08-13 allocator privacy-boundary audit](./2026-08-13-allocator-identity-boundary-audit.md)
accepts FundLoop's current pre/post-allocation identity joins and per-project claims for the MVP.
The remaining multi-repo work is a private Cubid batch resolver, allocator-only logical storage
and access, and explicit currency propagation. Project claims become currency claims in a later
v2 privacy hardening step.

Policy key: `settled_cubid_redistribution_v2`

The v1 policy and its persisted artifacts remain reproducible. New monthly calculations use v2 and must never reinterpret or rewrite v1 records.

## Policy summary

Each approved, settled project source is divided equally among that project's eligible cohort. Each theoretical share is multiplied by the member's locked Cubid score divided by the locked maximum score. The result is that member's score-adjusted initial claim for that project.

Every user is entitled to the full sum of all score-adjusted initial claims. The redistribution ceiling does not reduce those claims.

For user `u`:

```text
initial total(u) = sum(all score-adjusted project claims for u)
baseline(u) = largest single-project score-adjusted initial claim for u
redistribution top-up ceiling(u) = floor(baseline(u) × selected cap multiple)
top-up capacity(u) = max(0, redistribution top-up ceiling(u) − initial total(u))
final award(u) = initial total(u) + redistribution top-up(u)
```

If the initial total already exceeds the redistribution top-up ceiling, the initial total remains intact and the user receives no top-up.

## Immutable monthly cap selection

During pre-calculation an internal operator may preview read-only scenarios using a decimal cap multiple from `1.00` through `10.00`, in `0.01` increments. The interface starts at `3.00`, but that value is only an initial scenario, not a permanent policy constant.

The system does not choose an optimization objective. The operator compares scenarios and selects one. Locking persists only the selected scenario and binds these fields into the immutable manifest:

- cap multiple;
- selected preview hash;
- input hash and manifest hash;
- actor and lock timestamp;
- current project sources, E−3 harvest sources, carry-in sources, cohort, scores, and provenance.

The selected multiple is also bound into the result hash, independent close rerun, root approval package, and all monthly report scopes.

## Redistribution pool

The v2 global pool is exactly:

```text
score-discount contributions
+ unclaimed awards harvested from E−3
+ prior redistribution residue carried into E
```

There is no v2 overlap pool. The `overlap_pool_minor` value must be zero for v2 runs.

Score-discount contributions are the difference between each theoretical equal share and its score-adjusted initial claim. They retain their source project, rail, custody account, asset, FX snapshot, native amount, exact USD amount, and canonical minor-unit provenance.

Carry-in sources are prior v2 residue lots. A residue lot points to its predecessor disposition so its complete source chain remains reproducible.

## E−3 unclaimed-award harvest

An award from epoch `E−3` remains claimable through three complete payout months and can be harvested only after the target epoch `E` closes. For example, January awards remain claimable through February, March, and April; the unclaimed January balance can enter April's redistribution calculation only after April 30.

Unclaimed value is obligation value not covered by a non-released claim. Claims in `reserved`, `queued`, `held`, `paid`, or `closed` state are protected. A `released` claim no longer protects value and makes it harvestable again.

For partial claims, inventory is treated oldest-first for the claimant and newest-first for the harvest. This preserves the oldest source lots behind timely claims and harvests the newest remaining lots. Partial canonical minor and native quantities use deterministic rounding and retain predecessor fill, inventory, custody, rail, asset, FX, project, and USD provenance.

Harvest and lock are one fail-closed transaction. They lock the cycle and obligations, close the harvestable balance, prevent new claims against harvested value, reserve each source once, and reject stale previews, duplicate harvests, and concurrent lock attempts.

## Redistribution algorithm

1. Build every user's canonical initial total without clipping it.
2. Calculate the user's redistribution top-up ceiling and remaining top-up capacity.
3. Order users by current canonical total, then stable user identifier.
4. Water-fill the lowest current totals first.
5. Stop a user at their top-up capacity and stop globally when the pool is exhausted or nobody has capacity.
6. Preserve each consumed source lot's exact USD, canonical minor, native asset, project, rail, custody, FX, and predecessor provenance.
7. Carry every undistributed exact residue into `E+1` as a dedicated redistribution source.

The algorithm is deterministic under project-source, redistribution-source, and cohort input permutations.

## Required conservation checks

Every v2 artifact must prove:

```text
initial claim + top-up = final award                         (per user)
top-up <= max(redistribution ceiling − initial claim, 0)     (per user)
current funded + harvested E−3 + carry-in
  = final awards + carry-out residue                         (global)
score pool + harvested E−3 + carry-in
  = top-ups + carry-out residue                              (pool)
sum(source dispositions) = source exact and canonical value  (per source)
overlap pool = 0
```

Exact-decimal conservation is authoritative. Canonical minor units use deterministic largest-remainder assignment, and native quantities stay source-linked through partial dispositions.

## Close, withdrawal, and reporting

Close independently reruns the immutable v2 manifest and rejects a result-hash mismatch. Conditional award controls record full initial claims, selected cap multiple, redistribution top-up ceiling, top-up, and final award. Preparing withdrawal inventory accepts v2 initial-claim and top-up fills and preserves both project-source and redistribution-source provenance.

The calculation command is idempotent after the manifest advances to `calculated`: an exact result-hash replay returns the existing run, while a changed hash is rejected. The local EUR Pay by Bank fixture exercises authoritative settlement evidence, native EUR and USD-functional FX/fee conservation, package provenance, v2 lock, calculation replay, close replay, and later refund invalidation. Its close root remains immutable after invalidation; corrective handling is forward-only and never reinterprets the closed artifact.

The monthly reporting package includes the selected cap multiple and aggregate E−3 harvested amount for:

- operator reports;
- project reports;
- private user reports;
- public and public-project reports when their privacy threshold is met.

These values are part of report artifact hashes and the close root. Public reports never expose user identifiers, scores, overlap membership, or private source ownership.

## Safety boundary

Previewing, locking, calculating, closing, reporting, and withdrawal preparation remain review-only outside production. The v2 schema, functions, Edge handlers, and source tables all fail closed for production value flow. No provider call, payout submission, or transfer is authorized by an allocation or close artifact.
