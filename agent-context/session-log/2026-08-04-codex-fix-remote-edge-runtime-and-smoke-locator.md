### session v1: Remote Edge runtime and hosted smoke repair

- Timestamp: 2026-08-05T01:36:18Z
- Agent: Codex
- Branch: codex/fix-remote-edge-runtime-and-smoke-locator
- Head: pending commit

#### Objective

Repair the remaining hosted remote-safe smoke failures after Vercel E2E and wallet settings were applied.

#### Actions Taken

- Updated the shared Supabase Edge Function command runtime to fall back from `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` to Supabase's built-in `SUPABASE_URL` / `SUPABASE_ANON_KEY` function secrets.
- Deployed the affected dev Supabase payment route command functions from this branch after direct secret alias mutation was blocked by Supabase access control.
- Tightened the remote-safe Playwright payment smoke locators so duplicate reconciliation copy and route labels stored in inputs do not cause false failures.
- Fixed the crypto route manager so successful create/update responses replace local editable route state with the server-returned route list, preventing stale draft rows from surviving after create.
- Redeployed the dev Vercel project to refresh the hosted app with the route-manager fix.

#### Validation Notes

- Passed: `deno cache --config supabase/functions/deno.json supabase/functions/project-crypto-route-create/index.ts`.
- Passed: `deno cache --config supabase/functions/deno.json` for `project-crypto-route-update`, `project-crypto-route-move`, and `project-crypto-route-enabled-set`.
- Passed: dev Supabase deploys for `project-crypto-route-create`, `project-crypto-route-update`, `project-crypto-route-move`, and `project-crypto-route-enabled-set`.
- Passed: dev Vercel deployment `dpl_GBPci2yj5eYAZZ7QR4cjNcje6Pim` aliased to `https://fundloop-website.vercel.app`.
- Passed: `PLAYWRIGHT_REMOTE_BASE_URL=https://fundloop-website.vercel.app PLAYWRIGHT_REMOTE_ALLOW_CANONICAL_SUPABASE=true pnpm dlx node@22.22.1 /opt/homebrew/bin/pnpm test:e2e:remote`.
- Passed: `pnpm lint && pnpm exec vitest run tests/e2e-config.test.ts && pnpm typecheck && pnpm build`.
- Note: local pnpm emitted Node engine warnings because the shell uses Node 24 while the repo targets Node 22; the explicit hosted smoke used Node 22.22.1.

#### Reflections

- Remote function deploys should not rely on Next-style public env aliases when Supabase already provides canonical `SUPABASE_URL` and `SUPABASE_ANON_KEY` secrets.
- The route manager needed deterministic local state replacement after successful server mutations; preserving drafts across every parent route update made the UI vulnerable to stale draft interactions.

#### Suggested Next Steps

- Yeet this repair branch to `dev` so future Supabase deploys carry the shared Edge runtime fallback permanently.
