## 2026-07-20T11:56:25.000Z - MCP hosted validation runbook

- agent: Codex
- branch: codex/mcp-hosted-validation-fixes
- head: 12ce667
- summary: Checked out a fixes branch from dev and updated `docs/mcp/validation.md` with a Preview/dev hosted MCP smoke runbook, sanitized evidence shape, and current note that hosted smoke was not rerun because the required local MCP endpoint/token env vars were unset. Split the earlier mixed local commit into themed commits so local Supabase smoke defaults and MCP hosted validation evidence are reviewable separately.
- validation: Checked local smoke env presence without printing secrets. `git diff --check` passed. `pnpm lint` passed with the existing Node 24 vs repo Node 22 engine warning.
- follow-ups: Run hosted Preview/dev `pnpm mcp:edge:smoke` once a non-production bearer token and endpoint are available, then replace the pending evidence note with the sanitized transcript.

## 2026-07-20T12:03:06.000Z - Cut over todo backlog to GitHub Project 1

- agent: Codex
- branch: codex/mcp-hosted-validation-fixes
- head: 84418e5
- summary: Migrated remaining open MCP roadmap items from `agent-context/todo-mcp.md` into GitHub Issues under Project 1, with parent Feature #43 and scoped Goal issues #44-#50. Left the EverFund/VentureFamily rebrand follow-up unmigrated per product direction. Marked `todo-mcp.md` and `todo-1-through-52.md` as superseded and updated `agent-context/README.md` to point future planning at GitHub Project 1.
- validation: Verified GitHub auth, repository, Project 1 fields/status values, issue hierarchy, and Project status `Scoped` for #43-#50. Local markdown validation pending final diff check.
- follow-ups: Vet the new scoped GitHub issue tree before moving executable Goals to Ready.
