# Feature #118 operational validation record

Status: Task #144 local implementation record. This document does not authorize a hosted mutation, remote Supabase change, production promotion, provider call, payable, transfer, or value flow.

## Evidence contract

The canonical capability inventory is `tests/e2e/operational/feature-118-capability-matrix.json`. Its digest is embedded in persona run summaries so a reviewer can match the executed persona evidence to the exact local/sandbox/stubbed/pending classification reviewed in the commit.

Required local commands:

```bash
supabase db reset --local
PATH=/opt/homebrew/opt/node@22/bin:$PATH \
  FUNDLOOP_DEPLOYMENT_ENV=local pnpm test:e2e:feature-118
```

The unified command is the canonical Task #144 gate. It performs a fresh replay, all five personas,
the self-contained privacy and Mailpit browser lane, all ten control-plane SQL suites, focused
contracts, Hardhat, the full Node 22 check, and a final zero-residue reset. It writes an ignored
machine-readable summary under `output/feature-118-operational/`. The component commands remain
available for focused diagnosis:

```bash
PATH=/opt/homebrew/opt/node@22/bin:$PATH pnpm test:e2e:personas
PATH=/opt/homebrew/opt/node@22/bin:$PATH ./node_modules/.bin/vitest run \
  tests/feature-118-operational-matrix.test.ts \
  tests/persona-harness-contracts.test.ts \
  tests/persona-harness-journey-runner.test.ts \
  tests/persona-harness-reporting.test.ts \
  --pool=threads --maxWorkers=1
PATH=/opt/homebrew/opt/node@22/bin:$PATH pnpm --dir contracts test
PATH=/opt/homebrew/opt/node@22/bin:$PATH CI=1 pnpm check
```

Run each SQL evidence owner named by the matrix with `psql -v ON_ERROR_STOP=1` against `127.0.0.1:55322`. The all-five persona result must be `passed` or `incomplete` only for an explicitly registered pending capability, and cleanup must be `clean` with `residualCount=0` for every selected persona. Task #144 does not permit an unavailable provider capability to become a green checkpoint.

## Provider classification

| Capability | Classification | Evidence boundary |
| --- | --- | --- |
| Stripe Connect USD/CAD payout | sandbox-real | Retained FundLoop sandbox provider evidence plus signed-webhook/local reconciliation proofs |
| Stripe bank-transfer USD/CAD intake | pending | Provider sandbox exposes no supported customer-balance bank-transfer currencies |
| Base USDC intake and Safe payout | local-real | Local Hardhat receipt, transfer-log, Safe ownership, sponsor, replacement, and reorg proofs |
| Base USDT/PYUSD | stubbed | Local mock only; no reviewed Base Sepolia issuer-address evidence |
| Production policy/accounting/value flow | pending | Professional approval and production promotion gates remain deferred |

## Artifact and privacy checks

- successful persona captures are exactly 1440x900 and 390x844;
- ignored output directories retain no Edge env file after shutdown;
- summaries contain only allowlisted fixed strings, booleans, bounded counts, paths, and digests;
- OTPs, emails, Auth IDs, invitation tokens/digests, Stripe secrets, bank details beyond explicitly approved redacted evidence, wallet destinations, and private profile fields are excluded;
- private onboarding and the separate unselected publication control are visually proven without leaving consent residue; and
- append-only withdrawal/FX evidence is exercised in transactional or shared-seed owners, never deleted to make persona cleanup appear green.

## Production blockers

The local implementation is intentionally production-disabled. Before production, require effective Terms/Privacy approval, definitive accounting and tax decisions, provider and currency enablement, retention decisions, runtime secrets, hosted role-specific smoke, backups and rollback readiness, and separately authorized value-flow activation. Stripe inbound capability absence remains an external blocker to Feature #130/#131 and therefore to the integrated Feature #118 production-ready claim.
