# Operational MVP Local Validation

This document records sanitized local-only validation evidence for the operational MVP workflow. It does not describe Preview/dev or production readiness.

## 2026-07-21 Local Smoke

Environment:

- Worktree: `/Users/botmaster/src/fundloop`
- Branch: `codex/operational-mvp-issue-51`
- Local Supabase port block: FundLoop custom `5532x` ports
- Seed baseline: deterministic `2026-05` cycle fixture from `supabase/seed.sql`
- Actor: local seeded founder/operator account documented in `docs/engineering/local-seed.md`
- Remote mutation: none
- Real payout execution: none

Local setup evidence:

- `supabase db reset` completed against the local FundLoop stack after the seed fixture updates.
- Only `civic-mesh` had a positive contribution commitment after reset.
- Local fixture checks confirmed the May 2026 cycle input set: one submitted contribution, one approved scoped-attribution dataset, verified CUBID snapshots, and user asset preferences with USD fallback coverage.

Workflow command evidence:

```json
{
  "cycleKey": "2026-05",
  "finalStatus": "distribution",
  "lock": {
    "status": "locked",
    "hashPresent": true,
    "overrideApplied": false,
    "counts": {
      "payments": 0,
      "onchainSubmissions": 0,
      "unresolvedOnchainSubmissions": 0,
      "identitySnapshots": 4,
      "approvedDatasets": 1,
      "identityArtifacts": 1
    }
  },
  "calculation": {
    "status": "calculation",
    "resultRows": 3,
    "assetFills": 3,
    "returnedPools": 0,
    "resultHashPresent": true
  },
  "verification": {
    "status": "verification",
    "decision": "verified"
  },
  "approval": {
    "status": "approval",
    "totalAllocatedUsd": 1250,
    "userCount": 3
  },
  "bookkeeping": {
    "status": "distribution",
    "createdCount": 3,
    "creditedCount": 3,
    "totalCreditedUsd": 1250,
    "noPayoutExecuted": true
  },
  "credits": [
    {
      "status": "credited",
      "paymentStatus": "not_paid",
      "usd": 625,
      "currency": "USD"
    },
    {
      "status": "credited",
      "paymentStatus": "not_paid",
      "usd": 375,
      "currency": "USD"
    },
    {
      "status": "credited",
      "paymentStatus": "not_paid",
      "usd": 250,
      "currency": "USD"
    }
  ],
  "auditEventTypes": [
    "lock_attempt",
    "lock_success",
    "calculation_package_attempt",
    "calculation_package_success",
    "verification_review",
    "approval_review",
    "bookkeeping_credits_create_attempt",
    "bookkeeping_credits_create_success"
  ]
}
```

Browser evidence:

- `/en/founder/projects/civic-mesh/reporting`
- `/en/admin/cycles/2026-05/payouts`
- `/en/workspace/earnings`
- Screenshots were captured to ignored local artifacts:
  - `output/playwright/issue-86-founder-reporting.png`
  - `output/playwright/issue-86-admin-payouts.png`
  - `output/playwright/issue-86-user-earnings.png`
- Browser smoke detected credited/not-paid/no-transfer copy on all three surfaces.
- Browser console error count: `0`.

Environment notes:

- A local Supabase storage/Kong routing issue appeared during early smoke attempts after repeated `supabase db reset` calls. Kong briefly routed storage uploads to a stale storage container IP and returned `502`.
- Restarting Colima and starting the FundLoop Supabase stack with health checks ignored for diagnosis kept the containers running; a direct storage upload then passed through Kong.
- The final workflow smoke used the normal Supabase JS Storage path for calculation artifacts.
- This note is local-environment evidence only. It does not change the production deploy path.

Validation commands:

- `pnpm test tests/local-public-seed.test.ts`
- `git diff --check`
- `supabase db reset`
- local command smoke through lock, calculation, verification, approval, and bookkeeping credits
- local Playwright browser smoke for founder/operator/user credited-but-not-paid surfaces
