### session v1: Hosted E2E auth gate and fixture return cleanup

- Timestamp: 2026-08-04T22:30:12Z
- Agent: Codex
- Branch: codex/fix-hosted-e2e-env-gate
- Head: d590431bea23529d28ae8003b85141f728933910

#### Objective

Repair the hosted remote-safe smoke after deploy and schema-cache repairs succeeded, but the test login endpoint returned 404 on the canonical non-production Vercel app.

#### Actions Taken

- Updated `isE2EAuthEnabled()` so hosted Preview/dev deployments can enable the E2E login endpoint with `FUNDLOOP_DEPLOYMENT_ENV=dev` even though Vercel runs the app with `NODE_ENV=production`.
- Preserved the production safety boundary by keeping the endpoint disabled when `FUNDLOOP_DEPLOYMENT_ENV=production`.
- Removed the remaining remote fixture dependency on ordered mutation-return rows for `payment_methods`; the fixture now uses its explicit IDs directly.
- Added config test coverage for the hosted Preview/dev gate.
- Updated the gate after review to fail closed for unknown deployment env values such as `main` or `prod`.
- Reused named fixture payment method ID constants in both insert payloads and later references.

#### Validation Notes

- Passed: `git diff --check`.
- Passed: `pnpm dlx node@22.22.1 /opt/homebrew/bin/pnpm exec vitest run tests/e2e-config.test.ts --pool=forks`.
- Pending: hosted remote-safe smoke after the Vercel preview/deploy includes this gate fix.
- Pending: PR checks and post-merge dev validation.

#### Reflections

- Runtime `NODE_ENV` is not a deployment-environment signal on Vercel. Safety gates that differ between Preview/dev and Production should use `FUNDLOOP_DEPLOYMENT_ENV`.

#### Suggested Next Steps

- Merge through normal review gates, confirm the Vercel dev deployment includes the gate change, then rerun the hosted remote-safe smoke.
