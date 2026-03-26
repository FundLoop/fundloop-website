# zkAS v1 Implementation Reference

## Summary

This document maps the current zkAS v1 implementation to the main files, tables, actions, and runtime contracts in the FundLoop repo.

It is intended as the handoff/reference document for engineers extending the control plane.

## Main Entrypoints

### `app/actions/zkas-actions.ts`

This is the orchestration center for zkAS.

Main responsibilities:

- role assignment for `zkas_access`
- dataset upload and validation persistence
- identity artifact upload
- dataset approval and rejection
- draft run creation
- run locking and manifest upload
- local execution dispatch
- superadmin verification and rejection
- result publication, notification fan-out, and project analytics materialization
- dataset detail access helpers

Important action groups:

- **project-scope actions**
  - `assignProjectZkasAccess`
  - `revokeProjectZkasAccess`
  - `uploadZkasDataset`
- **operator actions**
  - `uploadZkasIdentityArtifact`
  - `approveZkasDataset`
  - `rejectZkasDataset`
  - `createZkasRunDraft`
  - `lockZkasRun`
  - `dispatchZkasRun`
- **superadmin actions**
  - `verifyZkasRun`
  - `rejectZkasRunVerification`
  - `publishZkasRun`
  - `finalizeZkasRun`

### `app/admin/zkas/page.tsx`

This is the operator control-plane landing page.

It summarizes:

- dataset count
- run count
- completed run count
- identity artifact count

It links operators to:

- `/admin/zkas/uploads`
- `/admin/zkas/runs`
- `/admin/superadmin/zkas`

### `app/projects/[slug]/zkas/page.tsx`

This is the project zkAS workspace.

It is intentionally multi-purpose and combines:

- zkAS manager assignment
- the canonical dataset derivation guide
- upload form and template downloads
- dataset submission history
- aggregate published analytics

The page uses project membership plus `zkas_access` to determine whether analytics and uploads are visible.

### `lib/zkas/validation.ts`

This file owns deterministic parsing and validation for:

- CSV datasets
- JSON datasets
- identity artifact JSON

Key rules enforced:

- required columns must exist
- month must match the selected upload month
- `project_id` must match the selected project
- `app_user_id` cannot be blank
- if an optional scoring column is used anywhere, it must be numeric and populated everywhere
- duplicate `month/project_id/app_user_id` rows are rejected

It also parses identity artifacts with:

- `project_id`
- `app_user_id`
- `zkas_user_id`
- optional `fundloop_user_id`

## Schema Reference

### Base migration: `supabase/migrations/20260326001500_zkas_v1.sql`

This migration introduces the base zkAS schema.

#### Tables

- `zkas_identity_artifacts`
  - confidential monthly identity-linkage artifact metadata
- `zkas_runs`
  - monthly run metadata, manifest hashes, result hashes, totals
- `zkas_datasets`
  - one dataset version per project/month upload
- `zkas_dataset_issues`
  - normalized validation issues
- `zkas_run_datasets`
  - immutable dataset snapshots included in a run
- `zkas_run_payments`
  - immutable payment snapshots used to derive the pool
- `zkas_run_attempts`
  - execution attempts and logs
- `zkas_run_results`
  - normalized per-user run output rows keyed by `zkas_user_id`

#### Notable constraints

- only one approved/included dataset per project/month
- only project admins may hold `zkas_access`
- demoting a project admin requires removing `zkas_access` first

#### Storage buckets

- `zkas-datasets`
- `zkas-identities`
- `zkas-runs`

### Extension migration: `supabase/migrations/20260326013000_zkas_admin_ui.sql`

This migration extends the base schema with verification, publication, and project analytics.

#### Added run fields

- `verification_status`
- `verified_by_user_id`
- `verified_at`
- `verification_note`
- `published_by_user_id`
- `published_at`
- `publication_note`

#### Added tables

- `zkas_published_user_results`
- `zkas_run_project_summaries`
- `zkas_run_project_cubid_buckets`

#### Added snapshots

- `zkas_run_payments.project_id`

#### Notifications

- inserts `ref_notification_types.code = 'zkas_published_result'`

## Auth and Data Access

### `lib/supabase-admin.ts`

This is the server-only service-role Supabase client.

Properties:

- uses `SUPABASE_SERVICE_ROLE_KEY`
- never loads in client bundles
- centralizes elevated database and storage access

zkAS relies on this client for:

- private storage bucket access
- cross-project admin queries
- publication writes
- materialized analytics writes

### `lib/zkas/auth.ts`

This file defines the three distinct zkAS access layers:

- `requireProjectZkasManager`
- `requireInternalZkasOperator`
- `requireZkasSuperadmin`

Supporting behavior:

- `zkas_access` is resolved through `ref_roles` and `participant_roles`
- internal operator access is email-allowlist based
- superadmin access is a separate email allowlist

## Shared Types

### `types/zkas.ts`

This file defines the application-level zkAS contracts.

Important types:

- dataset and validation types
  - `ZkasDatasetRow`
  - `ZkasValidationIssue`
  - `ZkasValidationSummary`
- manifest/result contracts
  - `ZkasRunManifest`
  - `ZkasRunResultArtifact`
  - `LocalExecutionManifest`
- publication and analytics types
  - `ZkasVerificationStatus`
  - `ZkasPublishedUserResult`
  - `ZkasProjectAnalyticsSummary`
  - `ZkasProjectCubidBucket`
  - `ZkasPublishedResultNotificationPayload`

### `types/supabase.ts`

This is the generated schema surface consumed by the app.

Relevant additions include typed rows for:

- all `zkas_*` tables
- `zkas_verification_status`
- `user_notifications`
- `ref_notification_types`

The generated file now includes both:

- base v1 zkAS tables from the first migration
- publication/analytics tables from the follow-on migration

## Admin and Project Surfaces

### Operator surfaces

- `app/admin/zkas/page.tsx`
- `app/admin/zkas/uploads/page.tsx`
- `app/admin/zkas/uploads/[id]/page.tsx`
- `app/admin/zkas/runs/page.tsx`
- `app/admin/zkas/runs/[id]/page.tsx`

Operator pages cover:

- dataset review
- identity artifact upload
- run drafting
- run locking
- local execution

The run detail page now deliberately hands off verification/publication to the superadmin route instead of doing it inline.

### Superadmin surfaces

- `app/admin/superadmin/page.tsx`
- `app/admin/superadmin/zkas/page.tsx`
- `app/admin/superadmin/zkas/runs/[id]/page.tsx`
- `app/admin/superadmin/zkas/runs/[id]/artifacts/[kind]/route.ts`

These surfaces cover:

- review queue
- verification status
- publication controls
- private artifact downloads
- execution-log review
- post-publication project rollup inspection

### Project surfaces

- `app/projects/[slug]/zkas/page.tsx`
- `app/projects/[slug]/zkas/uploads/[id]/page.tsx`

These surfaces cover:

- manager assignment
- exact derivation/format instructions
- upload templates
- validation history
- aggregate project analytics for published runs only

### User surface

- `app/settings/zkas/page.tsx`

This page reads `zkas_published_user_results` for the authenticated user and presents:

- month
- aggregate score
- USD allocation
- publication time

## Validation and Publication Helpers

### `lib/zkas/guide.ts`

This file contains the canonical manager-facing dataset guide material:

- CSV template
- JSON example
- derivation steps
- submission checklist
- identity artifact compatibility notes

### `lib/zkas/publication.ts`

This file materializes publication data from run results plus dataset and identity inputs.

It is responsible for:

- resolving `zkas_user_id` to `fundloop_user_id` where possible
- attributing each published payout back to projects by project-level score share
- producing project contribution/payout summaries
- producing Cubid score buckets

Important rule:

- project payout is additive because each user’s final payout is apportioned across projects by their project-specific score share

## Local Python Runner

### Entry

- `zkas/engine/zkas_engine/runner.py`

### Role

The runner is the local execution backend for operator-triggered runs.

It:

- loads the identity artifact
- loads the selected datasets
- resolves `project_id + app_user_id -> zkas_user_id`
- computes row scores using the same defaulting semantics as the app
- aggregates by `zkas_user_id`
- emits canonical result rows with allocation amounts and row hashes

### Boundary

The TypeScript app never reimplements the runner algorithm for official execution.

Instead it:

- builds a local manifest
- downloads storage artifacts
- invokes the runner
- persists the returned artifact and normalized DB rows

This separation keeps the engine replaceable for future Nitro/TEE execution.

## Suggested Extension Points

If you extend zkAS next, these are the lowest-risk seams:

- add Nitro execution behind the existing manifest/result boundary
- replace the current mock notification-center UI with real `user_notifications` reads
- introduce project name joins on superadmin rollup tables for richer review screens
- add publication rollback tooling if operationally required
