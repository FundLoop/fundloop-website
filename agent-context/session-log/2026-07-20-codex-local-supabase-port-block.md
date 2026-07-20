## 2026-07-20T20:10:48.000Z - Local Supabase port block

- agent: Codex
- branch: codex/local-supabase-port-block
- head: a05496a
- summary: Moved FundLoop's local Supabase CLI configuration off the default `5432x` ports and onto a dedicated `5532x` block so it can run alongside other local Supabase projects under the same Colima/Docker instance. Updated tracked local environment guidance, MCP local endpoint examples, and `.env.example`; also updated ignored `.env.local` locally to point at the new API URL.
- validation: `git diff --check` passed. Parsed `supabase/config.toml` with Python `tomllib` and confirmed ports `55321`, `55322`, `55320`, `55323`, `55324`, and `55329`. `supabase status` was not useful while stopped because the CLI tried to inspect a non-existent old FundLoop DB container.
- follow-ups: After merge, run `supabase start` from FundLoop and confirm it binds the `5532x` ports while another repo can remain on the default `5432x` block.
