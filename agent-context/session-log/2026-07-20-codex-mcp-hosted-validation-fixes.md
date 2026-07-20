## 2026-07-20T11:56:25.000Z - MCP hosted validation runbook

- agent: Codex
- branch: codex/mcp-hosted-validation-fixes
- head: 12ce667
- summary: Checked out a fixes branch from dev and updated `docs/mcp/validation.md` with a Preview/dev hosted MCP smoke runbook, sanitized evidence shape, and current note that hosted smoke was not rerun because the required local MCP endpoint/token env vars were unset. Split the earlier mixed local commit into themed commits so local Supabase smoke defaults and MCP hosted validation evidence are reviewable separately.
- validation: Checked local smoke env presence without printing secrets. `git diff --check` passed. `pnpm lint` passed with the existing Node 24 vs repo Node 22 engine warning.
- follow-ups: Run hosted Preview/dev `pnpm mcp:edge:smoke` once a non-production bearer token and endpoint are available, then replace the pending evidence note with the sanitized transcript.
