# Allocator privacy-boundary audit

Date: 2026-08-13
Task: #204
Audited target: Goal 2 candidate through `14f7f95` plus the approved MVP clarification
Result: **pass with required cross-repo follow-up**

This audit asks one narrow question: does the allocator receive only the identity and financial
data needed to calculate awards? It does not require FundLoop to remove its pre-allocation or
post-allocation identity joins in the MVP. Those joins are intentionally retained so the current
logic can be validated. Production value flow remains disabled.

The component is called the **allocator** throughout. There is no separate "adjudicator" in this
architecture.

## Approved MVP boundary

The approved data flow is:

1. FundLoop prepares a project-scoped list containing only `project_id` and project-scoped UUIDs,
   plus calculation facts such as eligible funds, cap policy, cycle, source evidence, and currency.
2. The allocator sends the project-scoped UUID list to a private Cubid allocator API.
3. Cubid returns the corresponding FundLoop-scoped UUIDs and scores. It must not return raw email,
   phone, legal name, global Cubid account ID, raw stamps, raw proof payloads, or unrelated project
   membership data.
4. The allocator calculates the award and returns FundLoop-scoped UUID, amounts, currency, source
   evidence, and the MVP project-claim breakdown to FundLoop.
5. FundLoop may bind that result to its user IDs, per-project claims, reports, and payout-control
   records before and after calculation. This is accepted for the MVP and is not an audit failure.

People may self-identify as project participants elsewhere in FundLoop. Those membership records
are application data, not allocator inputs, and must not be joined into the allocator request.

## Current findings

| ID | Result | Finding |
| --- | --- | --- |
| APB-001 | accepted MVP | FundLoop currently resolves and retains project/FundLoop identity joins before and after allocation. This is deliberately allowed for short-term logic validation. |
| APB-002 | follow-up required | There is no private allocator-owned Cubid batch API yet. The mapping is currently resolved inside FundLoop before calculation. |
| APB-003 | follow-up required | Allocator records live in the shared `public` schema. They need an explicit allocator-only ownership and grant boundary even while the physical database remains shared. |
| APB-004 | follow-up required | The allocator output does not carry an explicit currency datapoint alongside amounts and claims. Currency must be mandatory and bound into deterministic result evidence. |
| APB-005 | accepted MVP | Results bind FundLoop users to per-project claims and return that data to FundLoop. This remains allowed in v1/MVP. |
| APB-006 | future v2 | Project claims should later be reduced to currency claims so the retained result no longer exposes the project breakdown. This is roadmap work, not an MVP blocker. |
| APB-007 | future architecture | A physically separate allocator database is desirable later. For the MVP, logically separate allocator tables, roles, commands, and field allowlists are sufficient. |

The earlier audit treated APB-001 and APB-005 as violations. That was stricter than the approved
MVP and is superseded by this decision.

## Allocator field contract

### Allowed input

```text
cycle_id
project_id
project_scoped_uid
eligible_funds
currency
cap_policy
source/evidence hashes
```

### Allowed Cubid response

```text
project_scoped_uid              # correlation key from the request
fundloop_scoped_uid
score
score_version / evidence hash
```

### Allowed allocator result to FundLoop

```text
fundloop_scoped_uid
award amount and exact minor-unit amount
currency
source/disposition hashes
project claims                  # MVP only; replace with currency claims in v2
```

### Forbidden allocator fields

```text
email, phone, legal/display name
FundLoop authentication user_id
global Cubid account/user ID
raw stamps, raw identity snapshots, raw proof payloads
FundLoop project-membership or self-identification rows
wallet address or payout destination unless a later calculation explicitly requires it
```

FundLoop may perform the final `fundloop_scoped_uid` to application `user_id` binding outside the
allocator. The allocator must not gain general read access to FundLoop application tables merely
because both currently use one Supabase project.

## MVP storage and access boundary

- Allocator-owned tables and functions must use an explicit allocator namespace/role boundary.
- The allocator role may read only prepared source lots, project-scoped UUID inputs, returned
  FundLoop-scoped UUIDs/scores, calculation policy, currency, and its own manifests/results.
- FundLoop application, membership, auth, reporting, support, and payout tables are not allocator
  tables. They remain FundLoop-owned even when they consume an allocator result.
- Every request/result contract must reject unknown fields and scan deterministic JSON artifacts
  for forbidden identity fields.
- Internal service authentication, request IDs, replay/idempotency, batch bounds, timeout, and
  audit hashes are required for the private Cubid API.
- A shared physical database is accepted for the MVP; a separate allocator database is recorded
  as future hardening, not a current release gate.

## Diagram disposition

- The conventional scoped-identifier flow is the approved MVP.
- The alias-separated/ZK diagram remains future work and must not be marketed as implemented.
- The consented email-list flow remains unavailable.
- Participant, Project, and Cubid interactions that do not touch FundLoop or the allocator remain
  external assumptions. This audit neither remediates nor certifies them.

## Cross-repo delivery split

### Cubid repository

Create a Feature tree for a private `cubid-allocator-api` that:

- authenticates FundLoop's allocator as a server-to-server client;
- accepts bounded batches of `project_id` plus project-scoped UUIDs;
- resolves them to FundLoop-scoped UUIDs and current scores;
- returns only the reviewed response fields;
- rejects unknown, duplicate, cross-project, unauthorized, stale, and oversized requests; and
- provides local and hosted privacy-negative evidence without exposing raw identifiers in logs.

### FundLoop repository

FundLoop follow-up work should:

- call the private Cubid API from the allocator boundary rather than from project membership/UI
  paths;
- introduce explicit allocator-only tables/roles/contracts within the MVP database;
- add mandatory currency to allocator inputs, outputs, persisted artifacts, hashes, and replay
  checks; and
- preserve current project-claim output for MVP while documenting its v2 replacement.

## Roadmap

### MVP

- Private Cubid allocator API and authenticated batch mapping.
- Project-scoped UUID input only; FundLoop-scoped UUID plus score output only.
- Allocator-only logical tables and access policies.
- Currency included end to end.
- FundLoop identity joins and per-project claims remain permitted.

### v2 privacy hardening

- Replace project claims in allocator results with currency claims.
- Remove unnecessary project correlation from retained allocator artifacts.
- Evaluate moving allocator storage and execution to a physically separate database/service.
- Revisit shorter retention and narrower FundLoop post-processing after MVP logic is certified.

## Decision

The present FundLoop identity joins are accepted for the MVP. The audit therefore no longer
blocks on removing them. The remaining implementation dependencies are the private Cubid API,
allocator-only logical ownership, and currency propagation. They must be delivered and validated
before the multi-repo allocator boundary is described as implemented; none authorize Production
deployment, payout activation, or real-value flow.
