# Production-readiness evidence contract

Contract version: `fundloop.production-readiness/v1`

Status: required evidence design for Sprint #155. This document defines how later Tasks prove replay, deployment, parity, hosted acceptance, Production promotion, cutover, and go-live. It does not perform or authorize any of them.

The machine-readable shape is [production-readiness-manifest.schema.json](./production-readiness-manifest.schema.json), and [`evaluateProductionReadinessManifest`](../../lib/release-readiness/evidence-manifest.ts) is the canonical executable cross-field evaluator. A conforming JSON document is necessary but not sufficient: the evaluator must return no blocking codes, every digest and observation must be independently regenerated, every required gate must pass in order, and missing or unreadable evidence fails closed.

## 1. One immutable candidate, several independent gates

Every evidence bundle binds one full 40-character Git commit, Git tree, PR, application deployment ID, Supabase project ref, Actions deploy run/attempt, expected backend inventory, observed backend inventory, capability observations, approvals, and runtime-control read-back. A later commit or redeploy requires a new manifest.

The gates are separate and monotonic:

1. **Replay:** every tracked migration executes from a fresh local database with the pinned toolchain and focused SQL suites.
2. **Remote plan:** the target reports only the expected forward migrations. A dry-run is planning evidence, not execution evidence.
3. **Deploy:** migrations and every expected Edge Function deploy successfully from the candidate SHA.
4. **Parity:** exact migration names/digests, exact function names/source digests, and the schema fingerprint match the candidate after deploy.
5. **Hosted acceptance:** the required roles and provider paths pass against an application deployment and Supabase deployment bound to that same SHA/manifest.
6. **Production deploy:** the reviewed `main` SHA is deployed and reaches parity while all value-flow controls remain false.
7. **Cutover:** separately approved opening balances, classifications, reconciliation, backup, and rollback evidence permit canonical reads or the defined cutover action.
8. **Go-live:** a later, separately scoped approval authorizes exact runtime-control changes. Production deployment, parity, or cutover does not grant this authority.

No gate may infer a stronger gate from a weaker one. A green app build, PR dry-run, active function, hosted page, signed packet, or merged PR proves only its own field.

## 2. Canonical bytes and digests

All hashes use lowercase hexadecimal SHA-256 over UTF-8/raw bytes without secret material.

### 2.1 Canonical JSON

Inventory and evidence-object hashes use RFC 8785 JSON Canonicalization Scheme bytes. Implementations must reject duplicate JSON keys, non-finite numbers, and values not representable by the schema. The approval scope hash is SHA-256 over canonical JSON containing `contractVersion`, `environment`, `candidate`, `expected`, `observed`, `deployment`, `prerequisites`, `githubControls`, `runtimeControls`, `capabilities`, and `allocationV2`; it excludes `manifestId`, `generatedAt`, `approvals`, `alerts`, and `gates` to avoid a circular signature. The final manifest digest is the SHA-256 of the complete canonical JSON with any detached `manifestSha256` field omitted.

### 2.2 Migrations

Expected migrations are every `supabase/migrations/*.sql` regular file at the candidate commit:

1. sort by the complete ASCII filename;
2. require `YYYYMMDDHHMMSS_name.sql` and a unique 14-digit version;
3. hash each file's exact Git blob bytes as `fileSha256`;
4. canonicalize the array of `{version,name,fileSha256}`; and
5. hash that array as `inventorySha256` using `sha256-raw-bytes-sorted-filename-v1`.

Observed migrations come from `supabase_migrations.schema_migrations` plus a repo-owned append-only deploy-evidence record through a read-only migration-role query after deploy. The deploy record must persist the exact candidate filename/digest inventory and run/SHA before application; a version without that remotely readable digest binding is `unverifiable-migration-source` and blocks parity. Missing, unexpected, duplicate, reordered, repaired-in-place, or digest-mismatched entries are blocking drift. A CLI plan alone is not an observed inventory.

The evaluator independently recomputes `inventorySha256`, rejects duplicate names,
requires strict ASCII filename order, and requires each migration version to match
its filename prefix. The same checks run over both expected and observed inventories;
copying one incorrect aggregate digest to both sides cannot pass.

### 2.3 Edge Functions

Expected functions are each direct directory under `supabase/functions/` except `_shared` and `_vendor`, sorted by ASCII name. For each function:

1. include its own regular files plus the transitive repo-owned imports under `_shared` and package/import-map lock inputs;
2. exclude `node_modules`, caches, logs, build output, `.env*`, and secrets;
3. record sorted POSIX-relative paths and the SHA-256 of each raw file;
4. canonicalize the path/digest array and hash it as `sourceSha256`; and
5. canonicalize sorted `{name,sourceSha256}` entries as the function `inventorySha256` using `sha256-function-tree-sorted-path-v1`.

Name/status/version read-back from the Supabase management API is required but insufficient because it does not expose source bytes. The deploy job must publish the expected source digest as an immutable artifact and the deployed function must expose or be associated with an independently readable deployment digest. A missing digest is `unverifiable-function-source`, which blocks parity. Missing functions, unexplained extras, inactive functions, or digest mismatch also block. An intentionally retired extra needs a reviewed quarantine/tombstone record bound to the manifest; silence is not retirement evidence.

Function inventories also require strict ASCII name order, unique names, independently
recomputed aggregate hashes, matching source digests, an active remote status, and
a non-null remote version.

### 2.4 Public-schema fingerprint

`pg17-public-schema-normalized-v1` requires PostgreSQL client major 17 and:

```bash
pg_dump --schema-only --schema=public --no-owner --no-privileges --no-comments "$DATABASE_URL"
```

Normalize the output by converting CRLF to LF, removing `--` comment lines, blank lines, and `\\restrict`/`\\unrestrict` lines, trimming trailing ASCII spaces from each remaining line, and ending with one LF. Hash those UTF-8 bytes as `normalizedSchemaSha256`. Record the exact `pg_dump --version`. Expected is generated from a fresh replay; observed is generated read-only from the target. Any mismatch is blocking until an allowlisted, reviewed nondeterminism is removed from the algorithm itself; do not whitelist an environment's unexplained output.

## 3. Deployment binding

The deployment record must contain the Actions run ID and attempt, run `headSha`, workflow-file digest, pinned Supabase CLI version, PostgreSQL client version, start/end timestamps, and separate database/function step conclusions. Parity evaluation requires:

- `candidate.gitSha == deployment.headSha`;
- the application deployment reports the same Git SHA;
- the Supabase target is the manifest's environment/project ref;
- the deploy run and all read-backs occurred after the reviewed candidate was created;
- both database and function steps succeeded; and
- expected/observed inventories and schema fingerprint match.

The observed block separately records application deployment ID and observed Git
SHA, Supabase environment/project ref, and Actions run ID/attempt. All must match
the candidate/deployment record. Backend, GitHub-control, and runtime-control
observations must occur after deploy completion and no later than manifest
generation. Canonical FundLoop refs are Dev `kyxtqnfnksvcaugxwzuj` and Production
`tpouimiyfmvucrerfhfc`; changing them requires a reviewed contract update.

A rerun is a new run attempt and must be named. A partially applied failed deployment remains a failed deploy until a reviewed forward fix produces a new successful run and parity read-back.

The `prerequisites` collection fails the deploy gate unless every environment-required entry is `pass`. Dev requires fresh replay, upgrade rehearsal, migration-plan review, expected-inventory generation, required-secret presence checks (names/booleans only), and provider/runtime configuration classification. Production additionally requires backup/restore rehearsal, approved rollback, protection read-back, professional packet status, and explicit Production-deploy approval.

## 4. Drift classification and response

| Class | Examples | Result |
| --- | --- | --- |
| Blocking | Missing/extra/digest-mismatched migration or function; schema mismatch; wrong SHA/environment/project; partial deploy; unreadable control; missing approval; enabled value flow before go-live | Stop promotion/cutover/go-live and alert. |
| Warning | A non-authoritative timestamp/version differs while all signed source and runtime evidence matches; expiring evidence is inside its renewal window | Human review before the next gate; cannot mask a blocker. |
| Informational | Observation time, run duration, or provider request identifier changes while its immutable evidence digest and subject remain the same | Record for audit; no gate effect. |

The parity evaluator must emit stable codes and exact expected/observed values. At minimum: `missing-migration`, `unexpected-migration`, `duplicate-migration`, `migration-order`, `migration-digest`, `migration-inventory-digest`, `missing-function`, `unexpected-function`, `duplicate-function`, `function-order`, `function-digest`, `function-inventory-digest`, `schema-fingerprint`, `deployment-sha`, `deployment-incomplete`, `environment-binding`, `project-binding`, `application-deployment-binding`, `application-sha-binding`, `workflow-run-binding`, `prerequisite-missing`, `prerequisite-not-passed`, `protection-missing`, `approval-missing`, `approval-stale`, `alert-delivery-failed`, `cutover-control-enabled-before-approval`, `value-flow-enabled-before-go-live`, `gate-dependency`, and `gate-contradiction`. A subject may follow a colon; the code before it remains exact.

Every blocking result creates an `alerts` entry containing manifest ID/digest in its evidence artifact, environment, stable code, subject, first-observed time, run/deployment IDs, owner, severity, delivery status, and evidence digest. The evaluator posts the sanitized alert to the configured GitHub/operations sink and records the delivery receipt in the evidence artifact. A `failed` or `pending` blocking-alert delivery is itself blocking. Repair is always a forward PR/migration/function change or explicit configuration correction; never rewrite applied migrations, reset a shared project, delete unexplained functions, or mutate audit evidence to make parity pass.

## 5. Replay, expand/contract, and forward fixes

Schema changes use expand/contract sequencing:

1. expand with backward-compatible tables/columns/functions and dual-readable contracts;
2. deploy code that can operate across the transition;
3. backfill through a reviewed, idempotent, observable command;
4. verify reconciliation and new-read adoption;
5. contract only in a later release after retained-client and rollback windows expire.

Every migration runs on fresh replay before a remote plan. Rehearsal must also cover upgrading a snapshot of the current target. If remote execution fails after partial application, record which statements/versions applied, freeze further promotion, prepare a forward-only repair, rerun both replay lanes, deploy, and regenerate the complete manifest. A passing rerun never erases the failed-run evidence.

## 6. GitHub protection and approvals

The manifest records live, timestamped API read-back for the exact base branch and `Production` environment. Dev/main promotion requires PR enforcement and named required checks. Production deploy requires at least one required reviewer and the repository-approved bypass posture. A checked-in workflow reference is not protection evidence.

Approvals are immutable evidence objects, not booleans. Each records type, `approved|rejected|pending|not-required`, artifact hash, exact manifest-scope hash, approver role, recorded timestamp, and expiry timestamp. A required approval with a different manifest hash, future recorded time, or expired timestamp is stale. Secrets, personal email addresses, tokens, and private provider payloads never enter the manifest; use opaque evidence IDs plus sanitized digests.

Required approval classes by gate:

- PR/code review before merge;
- Production deploy approval before the main-target workflow proceeds;
- qualified legal, accounting, privacy/retention, and provider conclusions before production economic activation;
- opening-balance and finance/operator approval before cutover;
- rollback approval/evidence before Production deploy and cutover; and
- a new explicit go-live approval after Production parity and cutover readiness.

## 7. Runtime controls

Runtime controls must be read from the deployed database/function boundary, not inferred from source defaults. The manifest binds the observation source and digest plus `neutralPostingEnabled`, `cutoverPrepareEnabled`, `cutoverActivationEnabled`, and `productionValueFlowEnabled`.

Production deployment and parity require `productionValueFlowEnabled=false`. The Sprint's Production validation also requires posting/cutover controls in their approved disabled state. A missing row, permission error, unknown environment, stale observation, or true value-flow flag fails closed. Only the later go-live manifest may authorize a reviewed transition, and it must include activation and rollback evidence for the exact manifest.

Enabling cutover prepare or activation while its gate lacks the required approvals is
blocking. A Production neutral-posting or value-flow flag is blocking before an
internally consistent go-live gate. Gate declarations cannot override failed
prerequisites, protections, parity, approvals, alerts, or runtime-control checks.

## 8. Capability evidence

Every capability entry names a stable capability ID, evidence class, evidence digest, observation time, environment, and exact subject/account/token/deployment without secrets. Evidence expires when its subject, provider capability, environment deployment, or candidate SHA changes.

Required Sprint evidence includes:

- **Provider/token reality:** exact Stripe test account/country/currency/capability and Base chain/token/issuer/address/provider topology. Unavailable/private-preview paths must prove zero mutation.
- **Same-environment roles/privacy:** founder, verified member, project member, and operator against one app/Supabase Dev pair, including unauthorized/cross-role negative reads and cleanup.
- **Reporting:** deterministic generation, audience transformation, immutable artifact hash/root, publication read-back, redaction/privacy threshold, retention class, and deletion/tombstone behavior.
- **Three-month claims:** open-month eligibility, oldest-first partial claims, reservation states, exactly E−3 harvesting, release/expiry, carry provenance, destination readiness, and reconciliation across four local epochs then hosted Dev.
- **Governance packets:** final legal/accounting/privacy/provider documents, qualified approver scope, exact document hashes/effective versions, runtime assumptions, unresolved conditions, and expiration/re-review rules.
- **Opening balances/cutover:** source-by-source classification, native/functional totals, difference report, approver evidence, backup/restore rehearsal, canonical-read switch, legacy-write posture, and rollback result.
- **Promotion:** reviewed `dev -> main` PR, required checks, human merge, Vercel/Supabase deployment IDs, exact main SHA, Production parity, safe hosted reads/denials, and disabled value flow.
- **Later go-live:** new manifest, refreshed capabilities/approvals, activation diff, monitoring, alert routing, stop limits, and rehearsed rollback.

`in-code`, `local-real`, `sandbox-real`, `ci-deployed-dev`, `hosted-verified`, `production-deployed`, and `value-flow-enabled` remain distinct. `stubbed`, `pending`, and `unavailable` are honest non-ready states.

## 9. Allocation v2 evidence

The same manifest that binds Git/backend state must bind:

- policy version exactly `settled_cubid_redistribution_v2`;
- the selected decimal cap multiple;
- immutable preview and selection input hashes;
- the source/version/hash for every CUBID score discount;
- exactly E−3 harvested award identities and the `exactly-E-minus-3` rule;
- carry-in and carry-out provenance hashes;
- audience report hash and allocation root hash; and
- runtime-control read-back proving value flow remains disabled.

Changing the cap, source set, score, harvest set, carry provenance, report, root, candidate, or backend invalidates the evidence bundle. A prior capability review cannot certify a later allocation candidate or later Supabase deployment.

## 10. Historical contract application

The contract was dry-applied to two read-only historical records:

| Run | Contract result | Reason |
| --- | --- | --- |
| [31287337962](https://github.com/FundLoop/fundloop-website/actions/runs/31287337962), SHA `1cd8b822484c7804238dea6f2955fed0c6d4955b` | Deploy step evidence: pass; parity for that historical moment: not established | The run applied seven named migrations through `20260809010000`, then deployed 38 named functions successfully. It predates the manifest/digest/schema read-back contract, so it cannot retroactively prove exact source or schema parity. |
| [31542120571](https://github.com/FundLoop/fundloop-website/actions/runs/31542120571), SHA `7eacafe7d1003a7f9e529d4887423d158e017732` | Deploy: fail; parity/hosted/promotion: blocked | Migration execution failed with SQLSTATE `42601`; function deploy was skipped; live read-back shows 25 candidate functions missing and one retired extra. |

This is intentional: historical success can prove that named workflow steps completed, but missing v1 digest fields fail closed rather than being guessed.

## 11. Fixture drift smoke

The fixture [`tests/fixtures/production-readiness/manifest-valid.json`](../../tests/fixtures/production-readiness/manifest-valid.json) represents a parity-valid Dev manifest with recomputed inventory and approval-scope hashes. [`tests/production-readiness-evidence-contract.test.ts`](../../tests/production-readiness-evidence-contract.test.ts) runs the full negative matrix: missing, unexpected, reordered, duplicate, digest-changed, and aggregate-hash migration/function drift; wrong Git/app/environment/project/run/attempt/time binding; prerequisite and protection failures; missing/stale approval; failed alert delivery; cutover/value-flow violations; and contradictory pass gates. Every counterexample must return its documented blocking code.

## 12. Stop conditions

Stop the active promotion/cutover/go-live operation when any required field is absent, stale, unreadable, invalid, from another SHA/environment/account, or contradicted by a second source; when an alert cannot be delivered; when a provider/account capability is unavailable; when GitHub protection/approval is absent; or when a runtime control is unexpectedly enabled. Preserve the evidence and route a forward fix through review.
