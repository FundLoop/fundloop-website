## 2026-07-20T20:10:48.000Z - Local Supabase port block

- agent: Codex
- branch: codex/local-supabase-port-block
- head: 1990b04
- summary: Moved FundLoop's local Supabase CLI configuration off the default `5432x` ports and onto a dedicated `5532x` block so it can run alongside other local Supabase projects under the same Colima/Docker instance. Updated tracked local environment guidance, MCP local endpoint examples, and `.env.example`; also updated ignored `.env.local` locally to point at the new API URL.
- validation: `git diff --check` passed. Parsed `supabase/config.toml` with Python `tomllib` and confirmed ports `55321`, `55322`, `55320`, `55323`, `55324`, and `55329`. `supabase status` was not useful while stopped because the CLI tried to inspect a non-existent old FundLoop DB container.
- follow-ups: After merge, run `supabase start` from FundLoop and confirm it binds the `5532x` ports while another repo can remain on the default `5432x` block.

## 2026-07-20T20:28:05.000Z - PR review port-block follow-up

- agent: Codex
- branch: codex/local-supabase-port-block
- head: 1990b04
- summary: Addressed PR #88 review feedback by moving the Supabase analytics/Logflare port into the FundLoop `5532x` block, updating the MCP Edge smoke default URL, and aligning stale `AGENTS.md` references with the current branch-scoped session-log directory convention.
- validation: Pending rerun after commit: `git diff --check`, `tomllib` config parse, focused MCP smoke-script grep, and PR CI.
- follow-ups: Re-run the PR checks after pushing the review-fix commit and confirm Supabase dry-run remains green.
