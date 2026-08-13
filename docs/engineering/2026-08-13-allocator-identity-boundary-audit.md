# Allocator identity-boundary audit

Date: 2026-08-13  
Task: #204  
Audited target: the three diagrams in `docs/project-reviews/2026-08-13-business-red-team/improvement-suggestions.md` at commit `9d6359b`  
Candidate: Goal 2 branch through `14f7f95`  
Result: **fail — architectural remediation requires approval**

This is a source and schema audit, not a privacy certification. It does not change the
`settled_cubid_redistribution_v2` policy, enable a future flow, or repair the violations it
records. The current conventional MVP is production-disabled and remains a no-value local
candidate.

## Classification

- `pass`: the implemented command and persisted output match the diagram boundary.
- `partial`: some behavior exists, but the identity or trust boundary differs.
- `fail`: the current implementation contradicts the diagram boundary.
- `not implemented`: the arrow is deliberately unavailable and must not be marketed as current.

## Diagram 1 — conventional scoped-identifier MVP

| Arrow | Classification | Current command/artifact and boundary evidence |
| --- | --- | --- |
| Participant → Project: participant identifier | partial | Project invitation and attribution flows accept email, `user_id`, and `scoped_cubid_id`, but FundLoop hosts the project-facing command and database rather than a separated project plane (`project_invitations`, `project_attribution_rows`). |
| Participant → FundLoop: participant identifiers | pass | Supabase Auth and `user-cubid-resolve-email` bind the authenticated FundLoop user to email/CUBID state. |
| Participant → CUBID: identity proofs | partial | CUBID-hosted provider flows and `user-cubid-sync-profile` exist, but FundLoop retains normalized and raw snapshot fields in `cubid_identity_snapshots`. |
| Project → CUBID: project user identifier | fail | The project attribution command resolves rows inside FundLoop against `users`; there is no project-to-CUBID scoped-resolution boundary. |
| CUBID → Project: project-scoped UUID | fail | `scoped_cubid_id` is submitted to and retained by FundLoop together with FundLoop `user_id` and email; it is not returned only to the project. |
| FundLoop → CUBID: FundLoop identifiers | pass | `user-cubid-resolve-email` and `user-cubid-sync-profile` call the CUBID client from server/Edge code. |
| CUBID → FundLoop: FundLoop UUID and score | partial | `users` and `cubid_identity_snapshots` retain the CUBID identifier and score, but the current identifier is not proven to be a FundLoop-only scoped UUID. |
| Project → Allocator: project ID plus project-scoped UUIDs | fail | `project_attribution_rows` is a general `public` application table containing project ID, scoped CUBID ID, FundLoop user ID, and email before calculation. |
| Project → FundLoop: project name plus funds | pass | Projects, payments, packages, settlement evidence, and valuation lots provide the project/funding input without enabling payout. |
| FundLoop → Allocator: project, verified funds, cap | partial | The v2 lock command provides exact sources and cap policy, but it is a service-role SQL function over the same application database, not an isolated allocator contract. |
| Allocator → CUBID: project-scoped UUIDs | fail | No allocator-owned CUBID request exists. The app resolves the cross-scope mapping before lock. |
| CUBID → Allocator: scoped UUID, FundLoop UUID, score | fail | `project-attribution-command.ts` performs the join and stores it in `project_attribution_rows`; package and manifest cohorts copy the joined user/project/score state. |
| Allocator → FundLoop: FundLoop UUID plus award | fail | The result uses raw FundLoop `user_id`; `epoch_allocation_user_awards.project_claims` and the persisted run artifact retain per-project claims with that user identity. |
| FundLoop → Participant: funds | not implemented | Payout/value-flow controls remain disabled. Current obligations, payout intents, and provider modules are no-value control-plane evidence only. |

## Diagram 2 — alias-separated ZK flow

| Arrow group | Classification | Evidence |
| --- | --- | --- |
| Participant supplies unrelated X to Project, Y to FundLoop, and X/Y proofs to CUBID | not implemented | There is no alias-pair registration contract or proof ceremony. Current email/CUBID linkage is the conventional MVP path. |
| Project resolves X to project-scoped UUID only | not implemented | No project-scoped CUBID client/service boundary exists. |
| FundLoop resolves Y to FundLoop-scoped UUID only | not implemented | Current resolution does not prove alias separation from a project identifier. |
| Project submits project UUIDs while FundLoop submits verified funds/cap | fail for current MVP; not implemented for ZK | The same public database joins raw project and FundLoop identities before calculation. |
| Allocator requests ZK linkage and score proof | not implemented | No circuit, proof request, verifier key, committed score proof, or ZK runtime is present. Legacy `zkas_*` names are not ZK evidence. |
| CUBID returns proof without identifiers | not implemented | No proof response contract exists. |
| ZK allocator returns FundLoop UUID plus award | not implemented | Current v2 allocator consumes and persists raw `user_id` plus project claims. |
| FundLoop pays participant | not implemented | Production value flow is disabled. |

Every future-ZK arrow is unavailable. Product/docs must not describe alias separation,
administrator-collusion resistance, or ZK linkage as implemented.

## Diagram 3 — consented email-list project flow

| Arrow | Classification | Evidence |
| --- | --- | --- |
| Participant → Project: consented email | partial | Invitation email and policy acknowledgements exist, but not the required project-list transfer consent contract. |
| Project → FundLoop: participant email list plus funds | not implemented | There is no secure eligible-email upload command or purpose-bound consent ledger for this product. |
| FundLoop → CUBID: create/use secondary project account | not implemented | No secondary CUBID project-account lifecycle exists. |
| FundLoop → CUBID: emails as project identifiers | not implemented | Current email resolution is a FundLoop-user command, not a project-list operation. |
| CUBID → FundLoop: project-scoped UUIDs | not implemented | No secondary-account response contract exists. |
| FundLoop → Allocator: project ID plus project-scoped UUIDs | fail for current MVP; not implemented for this path | Current general tables would expose any such mapping to the app, which violates the target allocator-only join. |
| FundLoop → Allocator: verified funds plus cap | partial | The no-value v2 source/cap input exists, but the allocator is not isolated. |
| Allocator ↔ CUBID: scoped-to-FundLoop mapping and score | fail for current MVP; not implemented for this path | The current app performs and persists the mapping; no allocator-owned resolver exists. |
| Allocator → FundLoop: FundLoop UUID plus award | fail for current MVP | Raw user/project claims remain in the app database and calculation artifact. |
| Participant → FundLoop: email account identity | pass | Supabase Auth and CUBID email resolution provide this conventional account path. |
| FundLoop → Participant: funds | not implemented | Production value flow is disabled. |

The consented email-list route is unavailable. Existing project invitations must not be
represented as the secondary-account upload product.

## Persistent join inventory and violation register

| ID | Severity | Location | Forbidden combination or propagation |
| --- | --- | --- | --- |
| AIB-001 | critical | `project_attribution_rows`; `lib/attribution/project-attribution-command.ts` | `project_id`, project `scoped_cubid_id`, FundLoop `user_id`, and `user_email` are stored in one general application row. The command can resolve by user ID, email, or CUBID ID. |
| AIB-002 | critical | `epoch_project_package_cohort` | `source_row_id` links back to AIB-001 while the row also stores FundLoop `user_id`, project pseudonym, and locked CUBID score. |
| AIB-003 | critical | `epoch_allocation_manifest_cohort` | The immutable allocator input stores `project_id`, raw FundLoop `user_id`, project pseudonym, and score in the public application schema. |
| AIB-004 | critical | `epoch_allocation_runs`; `epoch_allocation_user_awards` | The result artifact and award row bind raw `user_id` to per-project `project_claims`; the main app can reproduce the cross-project join. |
| AIB-005 | high | `monthly_cycle_allocation_project_results` | The legacy/current read model stores `project_id`, `user_id`, and `scoped_cubid_id` together and remains part of operator/monthly-cycle surfaces. |
| AIB-006 | high | `cubid_identity_snapshots`; `users` | The app retains global CUBID ID, FundLoop user ID, primary email/phone, score, stamps, and raw identity payloads. This is broader than the target FundLoop-scoped account result and increases join impact. |
| AIB-007 | high | lock/package/run JSON; Storage calculation artifacts | Immutable JSON copies the joined cohort and per-project claim data. Immutability preserves—not isolates—the join, and normal database backups inherit it. |
| AIB-008 | medium | operator/service-role reads and support paths | RLS blocks ordinary table reads, but service-role functions and internal operator surfaces share the same database authority. There is no purpose-specific allocator role, separate encryption key, access event, or break-glass boundary. |
| AIB-009 | medium | reporting, MCP, logs | Audience reports are materially scoped and MCP hashes common auth identifiers, but reporting generation and operator/MCP readers execute beside the joined source tables. No forbidden-field contract prevents a future query from exporting the join. |
| AIB-010 | high | retention/backups | Report tombstones are executable, but allocator identity mappings, raw CUBID snapshots, immutable run artifacts, logs, and backups have no unified purpose-specific retention/deletion contract. |

The allocator is therefore **not** the sole identity-amalgamation component. The join occurs
in attribution resolution, persists across package/manifest/result tables, and remains
available to the general service-role application and backups.

## Current view by actor

| Actor/view | Current visibility | Result |
| --- | --- | --- |
| Project admin | Project datasets and workflow through FundLoop; project membership uses FundLoop `user_id` | partial; app-hosted project plane can participate in the join |
| FundLoop application | Users, CUBID snapshots, attribution joins, cohorts, manifests, awards, reports | fail; broad join authority |
| CUBID | Conventional FundLoop email/account resolution and identity data | partial; no scoped project resolver contract evidenced |
| Allocator | SQL functions in the same public database using service role | fail; no isolated authority or storage |
| Operator/support | Internal role plus service-role read paths | fail; purpose/break-glass access is not isolated or immutably audited |
| Participant | Self reports and payout readiness | partial; scoped output exists but underlying mapping is broadly retained |
| Founder report | Project aggregate only | pass at the published report boundary |
| Public report | Global aggregate only | pass at the published report boundary |
| MCP | Audience/role-filtered reporting and hashed common observability identifiers | partial; safe output today, no schema-level forbidden-field guarantee |
| Backups | Supabase database/Storage inherit retained joins | fail; no allocator-specific encryption, exclusion, key, TTL, or deletion evidence |

## Required target architecture

### Trust domains

1. **Project submission plane** accepts a project-scoped participant token and attribution
   facts. It cannot query FundLoop user records or CUBID/FundLoop identifiers.
2. **FundLoop account plane** owns auth, payout readiness, and an opaque
   `fundloop_subject_token`. It cannot query project-scoped identifiers or membership maps.
3. **Identity-link vault** is the only component allowed to resolve project tokens to
   FundLoop subject tokens and score evidence. It uses a dedicated database schema/role,
   separate encryption key, purpose-bound commands, immutable access events, and explicit TTL.
4. **Allocator** accepts only versioned source lots, project-local attribution keyed by a
   one-run allocator token, score commitment/evidence, cap policy, and cycle identity. It has
   no general-table access. Its output is keyed only by `fundloop_subject_token` plus award and
   source-disposition hashes.
5. **Projection plane** separately derives project aggregates, private participant output,
   operator exceptions, public aggregates, and MCP output. It cannot expose or reconstruct the
   identity-link vault.

### Narrow contracts

`allocator_identity_link.v1` input:

```text
cycle_id, project_id, project_subject_token, purpose, expires_at,
project_assertion_hash, cubid_score_commitment
```

Output to allocator only:

```text
allocation_subject_token, score_value_or_commitment, evidence_hash, expires_at
```

`settled_cubid_redistribution_v2` input keeps the approved formula and financial provenance,
but replaces `user_id`, email, CUBID ID, and reusable project pseudonym with run-scoped
`allocation_subject_token`. Output contains that token, award amounts, and source hashes. A
separate account-plane redemption command maps the allocation token to a FundLoop subject
without returning project identity.

### Data and access controls

- New private schemas/roles for project submissions, identity links, and allocator records;
  no `public`, `anon`, `authenticated`, general service-role, or broad operator grants.
- Domain-separated keyed tokens for project, run, and FundLoop scopes; tokens must not be
  derivable from raw UUID/email values or reusable across projects/runs.
- Envelope encryption for retained link evidence with environment/purpose-specific keys.
- Append-only access events recording actor, purpose, command, record hash, and outcome—never
  raw identifier values.
- Short TTL for link inputs; financial result hashes and aggregate evidence may persist without
  the reversible link. Subject deletion must erase mappings while preserving no-PII audit hashes.
- Backup/restore, support export, observability, and incident tooling must use the same field
  allowlists and key/access policy; a database backup alone cannot be the privacy boundary.
- Compatibility views must fail closed during rollout. No applied migration or v1 artifact is
  rewritten, and production value flow stays disabled.

## Proposed remediation Tasks — approval required before creation

### R1 — Introduce scoped identity-link vault and token contracts

- **Surfaces:** forward migrations under `supabase/migrations/`; new allocator/identity contract
  modules under `lib/allocator-boundary/`; typed Edge commands; generated Supabase types; CUBID
  docs.
- **Changes:** dedicated private schemas/roles, keyed project/run/FundLoop tokens, encrypted
  mapping evidence, purpose/TTL/access events, and project/FundLoop APIs that cannot query the
  opposite scope.
- **Dependencies:** current Goal 2 candidate; no native dependency change without separate
  approval.
- **Validation:** fresh replay, grant/RLS/adversarial field tests, token unlinkability vectors,
  expiry/deletion/access-audit tests, Deno/typecheck.
- **Smoke:** resolve one fixture mapping inside the vault, prove both outer planes cannot read or
  correlate it, expire/delete it, preserve only sanctioned hashes.
- **Stop:** commit and independent validator pass; no allocator calculation migration yet.

### R2 — Separate project attribution ingestion from FundLoop account resolution

- **Surfaces:** `lib/attribution/`, project attribution Edge functions/contracts, project UI,
  project package cohort construction, migrations, Storage attribution artifacts, docs/tests.
- **Changes:** remove email/FundLoop `user_id` resolution from project rows; submit only project
  tokens and attribution facts; call R1 through a purpose-bound allocator preparation command;
  quarantine and migrate legacy joins forward without rewriting history.
- **Dependencies:** R1.
- **Validation:** project-admin authorization, cross-project negatives, forbidden-column/storage
  scans, legacy compatibility/quarantine replay, exact package evidence.
- **Smoke:** project submits attribution; project and FundLoop account planes each see only their
  scope; allocator preparation receives run tokens; no raw join appears in logs/artifacts.
- **Stop:** independent validator pass; v2 formula remains unchanged and value flow disabled.

### R3 — Rekey v2 allocator inputs/results behind the isolated contract

- **Surfaces:** v2 lock/calculate/close SQL and Edge contracts, calculator input/output types,
  manifest/cohort/award/disposition tables, close artifacts, claims preparation, four-epoch/EUR
  fixtures, allocation docs.
- **Changes:** replace raw `user_id`, project pseudonym, and `project_claims` identity payloads
  with run-scoped allocation tokens and hashed project/source claims; allocator role has only
  contract tables; account redemption projects FundLoop awards after calculation. Preserve all
  cap, E−3, claim, FX, fee, and conservation semantics byte-for-byte at the policy layer.
- **Dependencies:** R1 and R2.
- **Validation:** calculator golden vectors before/after, canonical TAP, four-epoch concurrency,
  EUR lineage, forbidden-field scans of DB/JSON/Storage, replay/close/root equivalence.
- **Smoke:** deterministic no-value allocation where only the vault can connect one project token
  to one FundLoop award; project permutation and replay hashes remain stable.
- **Stop:** independent validator pass; no Production or payout activation.

### R4 — Enforce scoped projections, operator access, retention, and backup hygiene

- **Surfaces:** reporting generation/publication, MCP readers, operator/support tooling,
  observability/logging, Storage paths, retention/tombstone commands, deployment/runbooks and
  boundary tests.
- **Changes:** audience-specific projection allowlists and minimum-cohort rules; purpose-bound
  operator/break-glass reads with immutable access events; remove joined identifiers from logs,
  exports and support views; allocator mapping TTL/deletion; backup/key/restore controls and
  verified forbidden-field scans.
- **Dependencies:** R3.
- **Validation:** public/self/founder/operator/MCP privacy negatives, log/artifact/database dump
  scans, backup/restore rehearsal, DSR/tombstone evidence, full Feature #118 and Node 22 check.
- **Smoke:** generate every audience report and support trace from one no-value run, demonstrate
  that no output or backup-access path reconstructs the project↔FundLoop mapping.
- **Stop:** independent validator pass and combined #204 re-audit with no unresolved violation.

## Decision and stop boundary

Violations AIB-001 through AIB-010 require architecture changes. Per #204, the four remediation
Tasks above are proposals only: they have not been created, attached, or implemented. #204 and
#188 remain blocked. Explicit user approval is required before inserting these Tasks under Goal
#163 or changing the candidate architecture.
