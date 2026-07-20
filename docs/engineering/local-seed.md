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
  - The managed `civic-mesh` project has an explicit MVP commitment fixture: `payment_percentage=1.00` and `default_reporting_currency_code=USD`.
  - Expected readiness: founder workspace pages should show Civic Mesh as commitment-ready for contribution rate and reporting currency, while separate payment-route or submission readiness can still reflect the current local fixture state.
- Internal operator smoke
  - Use the same local fixture account: `maya@fundloop.example.com`
  - Required local/preview env allowlists:
    - `FUNDLOOP_INTERNAL_ADMIN_EMAILS=maya@fundloop.example.com`
    - `FUNDLOOP_ZKAS_SUPERADMIN_EMAILS=maya@fundloop.example.com`
  - Operator routes: `/en/admin`, `/en/admin/cycles`, `/en/admin/operations`, `/en/admin/identity`, `/en/admin/payments`, `/en/admin/cycles/observability`, `/en/admin/zkas`, `/en/admin/superadmin/zkas`
  - Without the allowlists, the account is still a valid founder/project admin but should not be expected to pass internal-operator route smoke.
- Blog
  - `/en/blog/why-monthly-cadence-matters`
  - `/en/blog/what-contributors-actually-need-from-a-project-directory`
  - `/en/blog/from-kyc-friction-to-trust-signals`

Why these fixtures exist:

- they make public project and user detail pages smoke-testable without depending on whichever rows happened to come from a remote-style snapshot
- they make signed-in founder workspace smoke tests possible through the same e2e login endpoint used by Playwright tests
- they make project commitment readiness smoke-testable without relying on migration defaults or incidental remote data
- they make internal-operator smoke tests possible when the local or preview runtime explicitly allowlists the seeded email
- they give Playwright and manual browser checks a stable target set
- they keep the local seed intentionally small and human-readable for this public-discovery slice

When adding new public discovery or workspace smoke coverage, prefer extending this deterministic fixture set rather than depending on incidental snapshot rows.
