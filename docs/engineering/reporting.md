# Monthly Reporting Publication

Session 36 introduced the first reporting read model. Goal #163 adds the deterministic command-backed publication lifecycle.

## Storage And Tables

- `monthly_cycle_report_artifacts` stores versioned, close-root-bound generated JSON and its SHA-256 hash.
- `monthly_cycle_report_events` is the append-only generation, publication, supersession, regeneration, and tombstone audit trail.
- `monthly_cycle_reports` is the published audience read model populated only after completeness and hash validation.
- `monthly_cycle_report_audience` scopes each report to `public`, `user`, `founder`, or `operator`.
- `monthly-cycle-reports` is the Supabase Storage bucket reserved for generated report artifacts.
- Report rows may point at stored JSON, Markdown, or PDF artifacts through `artifact_bucket`, `artifact_path`, `artifact_mime_type`, and `artifact_hash`.
- Report artifact paths should be generated with `buildMonthlyCycleReportArtifactPath(...)` from `lib/storage/artifacts.ts`.

`monthly-report-publication` exposes typed `generate`, `publish`, and authorized `read` actions. Generation creates public, private user, founder-project, operator, and MCP workflow artifacts from one approved close. Every artifact binds the manifest, result, and close root hashes and explains inputs, attribution, uniqueness, fee/FX handling, allocation, claims/expiry/rollover, exceptions, and reconciliation. Exact replay creates nothing; changed close/root input conflicts.

Publication verifies the complete expected audience/subject inventory, recalculates every artifact hash, and then publishes idempotently. Public and MCP artifacts contain aggregate/workflow data; private user and founder artifacts remain subject-scoped; operator artifacts remain internal. The MCP `reporting.artifacts.read` operation applies the same public/self/founder/operator authorization rules.

## Role Surfaces

- Public readers use `/[locale]/reports`.
- Users use `/[locale]/workspace/reporting`.
- Founders use `/[locale]/founder/projects/[slug]/reporting`.
- Operators use `/[locale]/admin/cycles/[cycleKey]/reporting`.

These pages remain read surfaces over genuinely published artifacts. They no longer treat placeholder cards as publication evidence.

## Retention, regeneration, and deletion

Artifacts receive a seven-year retention deadline. `apply_monthly_report_retention(...)` is a bounded service-role job that replaces expired content with a hash-preserving tombstone and appends an audit event. Regeneration uses a new version and supersedes the prior row; published versions and event history are never rewritten. A subject deletion request therefore removes private report content only after the governing financial retention period while preserving the minimal original hash, close linkage, and audit evidence required for reconciliation.

## Operating Rule

Monthly reports should attach to `monthly_cycles`. Pages should use reporting read models from `lib/reporting/monthly-cycle-reports.ts` instead of separately reconstructing cycle status, user results, project summaries, and artifact metadata.

All commands are local/dev/test/preview only. Production value flow remains disabled; report generation or publication performs no provider, payout, or transfer call. Hosted Dev artifact proof is owned by #183 and must not be inferred from local fixtures.
