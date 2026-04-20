# Local Seed Fixtures

FundLoop's tracked [`supabase/seed.sql`](../../supabase/seed.sql) remains the canonical local data seed, but it now includes a small deterministic public-discovery fixture set specifically for browser smoke tests and local UX validation.

Use these fixtures after `supabase db reset` when you want predictable public pages:

- Projects
  - `/en/projects/civic-mesh`
  - `/en/projects/mutual-aid-atlas`
  - `/en/projects/open-transit-ledger`
- Users
  - `/en/users/00000000-0000-4000-8000-000000000101`
  - `/en/users/00000000-0000-4000-8000-000000000102`
  - `/en/users/00000000-0000-4000-8000-000000000103`
  - `/en/users/00000000-0000-4000-8000-000000000104`
- Authenticated founder workspace smoke
  - Email: `maya@fundloop.example.com`
  - Password: `FundLoopFounder123!`
  - Founder routes: `/en/founder`, `/en/founder/projects`, `/en/founder/projects/civic-mesh`
  - The account is a local-only Supabase Auth fixture matched to the deterministic public user `00000000-0000-4000-8000-000000000101`.
- Blog
  - `/en/blog/why-monthly-cadence-matters`
  - `/en/blog/what-contributors-actually-need-from-a-project-directory`
  - `/en/blog/from-kyc-friction-to-trust-signals`

Why these fixtures exist:

- they make public project and user detail pages smoke-testable without depending on whichever rows happened to come from a remote-style snapshot
- they make signed-in founder workspace smoke tests possible through the same e2e login endpoint used by Playwright tests
- they give Playwright and manual browser checks a stable target set
- they keep the local seed intentionally small and human-readable for this public-discovery slice

When adding new public discovery or workspace smoke coverage, prefer extending this deterministic fixture set rather than depending on incidental snapshot rows.
