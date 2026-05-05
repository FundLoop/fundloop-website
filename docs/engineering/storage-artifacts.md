# Supabase Storage Artifacts

FundLoop uses Supabase Storage as the canonical artifact store for generated reports, zkAS inputs/outputs, project media, onboarding attachments, bookkeeping exports, and audit proofs.

The product rule is simple: database rows own metadata and authorization context; storage objects own file bytes. Web pages, Edge Functions, and MCP tools should pass stable artifact references rather than inventing ad hoc bucket/path conventions.

## Buckets

All product buckets are private by default.

| Bucket | Purpose | Retention |
| --- | --- | --- |
| `zkas-datasets` | Founder/project-member attribution uploads | kept with the cycle audit trail |
| `zkas-identities` | Operator-approved identity input artifacts | kept with the cycle audit trail |
| `zkas-runs` | calculation packages, run manifests, result artifacts, attestations | immutable after cycle calculation/verification |
| `monthly-cycle-reports` | published public, user, founder, and operator reports | published report retention |
| `project-assets` | project logos and other project-owned media | current plus replacement history when needed |
| `onboarding-uploads` | temporary onboarding proof attachments | draft lifecycle until converted or discarded |
| `bookkeeping-exports` | payout, reconciliation, and finance exports | audit retention |
| `audit-proofs` | override reasons, receipts, external proof bundles | audit retention |

Do not add new buckets without updating `lib/storage/artifacts.ts`, this document, and the Supabase bucket migration.

## Path Contract

Use `lib/storage/artifacts.ts` for path construction and artifact references.

Current canonical paths:

- zkAS dataset: `YYYY-MM/project-{projectId}/dataset-{hash}.{csv|json}`
- zkAS identity artifact: `YYYY-MM/identity-{hash}.json`
- zkAS calculation package: `YYYY-MM/cycle-{cycleId}/calculation-package.v1.json`
- zkAS run manifest: `YYYY-MM/run-{runId}/run-manifest.v1.json`
- zkAS run result: `YYYY-MM/run-{runId}/run-result.v1.json`
- monthly report: `YYYY-MM/{audience}/{subjectId?}/{fileName}`
- project asset: `project-{projectId}/{fileName}`
- onboarding upload: `user-{userId}/{user|project}/{fileName}`
- bookkeeping export: `YYYY-MM/{fileName}`
- audit proof: `YYYY-MM/{proofType}/{fileName}`

Cycle-bound paths must start with a valid `YYYY-MM` cycle key. This keeps storage references aligned with `monthly_cycles` and makes MCP/operator tooling predictable.

Private artifact downloads must validate stored paths before touching Supabase Storage. Session 51 added runtime guards that reject traversal, absolute paths, mismatched cycle/run prefixes, and mismatched zkAS artifact kinds for the superadmin zkAS artifact route.

## Access Rules

Storage access should happen through server-owned or Edge Function-owned paths.

- Browser code must not write directly to product artifact buckets.
- Service-role clients may upload/download only after the caller has passed the relevant app authorization check.
- Public pages should read metadata from typed read models, not from public buckets.
- MCP tools should return artifact references and metadata, not raw private storage contents, unless a specific Edge Function grants a scoped download path.

## Lifecycle

Draft artifacts may be overwritten while the owning draft is active. Cycle-locked, calculation, payout, reporting, and audit artifacts should be treated as immutable. If an operator needs to correct a published artifact, create a new object and update the database row with replacement metadata rather than mutating the old object.

Remote deployment creates and normalizes the known buckets through forward migrations. Seeds do not populate storage objects.
