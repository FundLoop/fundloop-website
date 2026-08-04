### session v1: Remote smoke fixture explicit IDs

- Timestamp: 2026-08-04T21:55:33Z
- Agent: Codex
- Branch: codex/fix-remote-smoke-fixture-ids
- Head: 5ca3051291248657cbb9d9ef8b7b6211459ae436

#### Objective

Repair the hosted remote-safe Playwright smoke after the dev Supabase deploy succeeded but fixture setup failed on a duplicate `organizations_pkey` caused by stale remote identity sequences.

#### Actions Taken

- Added a high-range deterministic fixture ID allocator derived from each Playwright run id.
- Updated the remote-safe project payments fixture to assign explicit IDs for organizations, projects, project payment methods, payments, and onchain submissions.
- Kept fixture cleanup scoped to the created project/user resources so repeated hosted smoke runs remain safe.
- Added a forward, idempotent repair migration for `payment_methods.sort_order` after hosted smoke exposed Preview/dev schema drift against the app's project payment route ordering contract.

#### Validation Notes

- Pending: focused local test validation.
- Pending: PR checks.
- Pending: dev Supabase deploy and hosted remote-safe smoke rerun after merge.

#### Reflections

- Remote smoke fixtures should not depend on shared database sequences being perfectly aligned, especially after repeated seeded or partial fixture runs in Preview/dev.

#### Suggested Next Steps

- Open the fixture repair as a separate PR, merge after normal review gates, then rerun the hosted smoke against `https://fundloop-website.vercel.app`.
