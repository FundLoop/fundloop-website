# Monthly Reporting Publication

Session 36 introduced the first reporting read model. Goal #163 adds the deterministic command-backed publication lifecycle.

## Storage And Tables

- `monthly_cycle_report_artifacts` stores versioned, close-root-bound generated JSON, the exact canonical JSON bytes, deterministic Storage path, SHA-256 hash, and Storage verification evidence.
- `monthly_cycle_report_events` is the append-only generation, publication, supersession, regeneration, and tombstone audit trail.
- `monthly_cycle_reports` is the published audience read model populated only after completeness and hash validation.
- `monthly_cycle_report_audience` scopes each report to `public`, `user`, `founder`, `operator`, or `mcp`.
- `monthly-cycle-reports` is the Supabase Storage bucket reserved for generated report artifacts.
- Report rows may point at stored JSON, Markdown, or PDF artifacts through `artifact_bucket`, `artifact_path`, `artifact_mime_type`, and `artifact_hash`.
- Immutable publication paths are generated only with `buildMonthlyCycleReportPublicationPath(...)` from `lib/storage/artifacts.ts`: `<cycle>/close-<id>/v<version>/<audience>/<opaque-path-token>-<sha256>.json`. The token is a domain-separated SHA-256 of the immutable artifact identity; raw user UUIDs and project IDs never enter Storage paths, event path metadata, or removed-object locators.

`monthly-report-publication` exposes typed `generate`, `regenerate`, `publish`, `read`, and `tombstone` actions. Generation creates public, private user, founder-project, operator, and MCP workflow artifacts from one approved close. Every artifact binds the manifest, result, and close root hashes and explains inputs, attribution, uniqueness, fee/FX handling, allocation, claims/expiry/rollover, exceptions, and reconciliation. Exact generate replay returns the existing version. Changed candidate bytes conflict and require the internal `regenerate` command with an expected current version, reason, and idempotency digest. Regeneration creates a new version, links both directions, marks the old version superseded, and appends regenerated/superseded events; it never overwrites an old artifact.

Publication is a three-boundary protocol. The prepare RPC authorizes the close and returns exact canonical bytes/hash/path plus the opaque path token for the complete latest version; it does not expose subject IDs in the publication manifest. The Edge command uploads each object to the private `monthly-cycle-reports` bucket with `upsert: false`, downloads it, and requires byte-for-byte and SHA-256 equality. Only then may the finalize RPC record Storage verification, create the versioned read model, and mark the artifact published. A byte-identical existing object is an idempotent replay; a conflicting object fails. Pre-finalize failure removes only objects newly created by that attempt and records an append-only failure event. Finalize failure retains already verified immutable objects for safe retry and records failure evidence. The legacy direct publication RPC now fails closed because SQL alone cannot prove a Storage object exists. An upgraded environment with an already-verified legacy subject-bearing path fails its migration explicitly so an authorized operator can move/delete the private object before retrying; database code never pretends that a Storage object moved.

Direct reads require one explicit audience. Anonymous callers may read only `public`; authenticated users may read only their own exact `user` subject; founders require an active `participants.is_admin` row for the exact requested project; `operator` and `mcp` are internal-only. Cross-user, cross-project, mixed subject/audience, and implicit all-audience requests fail closed. The MCP `reporting.artifacts.read` operation continues to apply the same public/self/founder/operator rules at its own boundary.

## Role Surfaces

- Public readers use `/[locale]/reports`.
- Users use `/[locale]/workspace/reporting`.
- Founders use `/[locale]/founder/projects/[slug]/reporting`.
- Operators use `/[locale]/admin/cycles/[cycleKey]/reporting`.

These pages remain read surfaces over genuinely published artifacts. They no longer treat placeholder cards as publication evidence.

## Retention, regeneration, and deletion

Artifacts receive a seven-year evidence-retention deadline. Database-only retention is disabled because it cannot erase the matching Storage object. The authorized `tombstone` action prepares the exact opaque object path, removes the object, then replaces report PII and subject identifiers with a minimal hash-preserving tombstone while retaining the original content hash, close/version linkage, subject evidence hash, opaque path token, removed-path evidence hash, deadline, and append-only event. This supports subject erasure without destroying financial/legal audit evidence. A finalize failure is durably recorded and must be retried; it is never presented as completed deletion.

## Operating Rule

Monthly reports should attach to `monthly_cycles`. Pages should use reporting read models from `lib/reporting/monthly-cycle-reports.ts` instead of separately reconstructing cycle status, user results, project summaries, and artifact metadata.

All commands are local/dev/test/preview only. Production value flow remains disabled; report generation or publication performs no provider, payout, or transfer call. Hosted Dev artifact proof is owned by #183 and must not be inferred from local fixtures.
