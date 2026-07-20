# AGENTS.md

This file tells coding agents how to work safely and effectively in this repository.

It is not a product spec. It is an execution guide for the current FundLoop codebase.

---

## 1. Mission

Build and maintain FundLoop as a production-grade web app and application shell using:

- **Next.js 16** with the App Router
- **Supabase** for auth, Postgres, RLS, and SSR-aware data access
- **Tailwind CSS 4** for styling
- **viem** for EVM contract interaction
- **wagmi** for React wallet state
- **Reown AppKit** for wallet connection UX
- **Hardhat** in the `contracts/` workspace for smart-contract testing and deployment scripts

Agents in this repo must optimize for:

1. Correctness
2. Security
3. Type safety
4. Maintainability
5. Small, reviewable changes
6. Clear separation of server concerns, client concerns, and wallet concerns

---

## 2. Current Repo Ground Truth

- Package manager is **pnpm**. Do not introduce npm or yarn workflow drift.
- Node baseline is **22.x**.
- `supabase/` is the canonical database source of truth.
- `database/` has been removed and must not be reintroduced as a parallel schema source.
- `types/supabase.ts` is generated from the canonical Supabase schema and should stay in sync with migrations.
- The repo uses real quality gates:
  - `pnpm lint`
  - `pnpm test`
  - `pnpm typecheck`
  - `pnpm build`
  - `pnpm check`
- Standard branch flow is:
  - create feature work on a non-`dev` branch, typically from the current `dev`
  - keep work on feature branches, but do not require one branch per numbered session
  - stack multiple related sessions on one feature branch when the user asks or when it keeps a coherent PR together
  - keep commits and `agent-context/session-log/` entries separated by session or meaningful checkpoint
  - open PRs from feature branches into `dev`
  - open PRs from `dev` into `main`
- Do not push feature work directly to `dev` or `main` unless the user explicitly instructs you to do so.
- `agent-context/session-log/` contains maintained branch-scoped session logs and must be updated for every commit.
- At the start of a new session, inventory what is next from:
  - the active roadmap in `agent-context/todo-mcp.md`, the archived `agent-context/todo-1-through-52.md` for historical context, and any relevant `todo.md` files under feature folders
  - larger planned work and implementation docs inside `docs/engineering/`
  - open GitHub issues when repo access is available

---

## 3. Architecture Principles

### 3.1 Next.js rules

This project uses **Next.js App Router**.

Respect the distinction between:

- **Server Components** for default page/layout/data rendering
- **Client Components** only where browser APIs, hooks, wallet state, or interaction are required
- **Route Handlers** for HTTP endpoints
- **Server Actions** where they simplify mutations and fit the existing patterns

Do not convert a server component into a client component just to make something work. Move the interactive part into a smaller client child.

### 3.2 Supabase rules

Use the modern SSR approach already established in the repo:

- browser access through repo-owned browser helpers
- server access through repo-owned server helpers
- cookie-aware auth/session handling
- no service-role logic in client bundles
- no direct reintroduction of deprecated auth-helper packages

Supabase Edge Functions are the repo-wide backend command boundary:

- all new writes should go through typed Supabase Edge Function commands unless the relevant engineering doc explicitly records a temporary exception
- existing direct server-action or route-handler writes should be treated as migration targets, not as patterns to copy
- most authenticated reads should move toward typed Edge Function or server-owned read-model boundaries when they feed workflows, agents, or cross-surface product state
- browser code must not write directly to Supabase tables or call service-role-backed routes
- MCP and future non-web clients should use the same Edge Function and protocol contracts as the web app, not a parallel backend path

If a change affects schema:

1. Add a forward-only migration in `supabase/migrations/`
2. Update or regenerate `types/supabase.ts`
3. Verify the app still works against the current schema

Do not treat the remote database as disposable. Prefer forward migrations. Do not reset the remote project.

### 3.3 Wallet and onchain rules

Use each layer for its intended role:

- **viem** for chain primitives, ABI-driven reads/writes, and receipt handling
- **wagmi** for React wallet/account/network state
- **Reown AppKit** for wallet connection UX only

Supabase auth remains the primary app identity. Wallet connection is additive and scoped to payment and onchain flows.

### 3.4 Security posture

Assume:

- the browser is hostile
- user input is untrusted
- wallet data is user-controlled
- route handlers are public unless protected
- all writes require explicit authorization
- RLS is part of the security model

Do not weaken RLS, leak secrets to the client, or bypass ownership checks for project/user mutations.

---

## 4. Repository Conventions

Use the existing repo structure and patterns:

```text
app/                    Next.js routes, pages, layouts, server components, server actions
components/             Feature components and shared UI
components/ui/          Reusable UI primitives
lib/                    Shared helpers, Supabase clients, onboarding, onchain config
contracts/              Hardhat workspace for intake contracts and tests
supabase/               Canonical migrations, config, and seed artifacts
tests/                  Vitest setup and test files
types/                  Generated Supabase types and shared TS types
docs/engineering/       Longer-lived engineering and architecture docs
agent-context/          Lightweight live agent context, backlog, and session-log artifacts
```

Follow existing naming and placement conventions before creating new abstractions. Extend the current pattern instead of creating a competing one.

Inside `agent-context/`:

- `session-log/` records one entry per commit or significant coded session
- `todo.md` holds smaller follow-up tasks and parked next actions
- keep the rest of the folder small and current for active agent context only

Inside `docs/engineering/`:

- longer-lived route, architecture, and implementation docs live here
- update these docs whenever a task materially changes architecture, route decisions, workflows, or operating assumptions

---

## 5. Before Changing Code

Before making changes:

1. Read the nearby files and understand the existing pattern.
2. Preserve naming, file layout, and architectural conventions already in use.
3. Decide whether the change belongs in:
   - a server component
   - a client component
   - a server action
   - a route handler
   - a Supabase helper
   - an onchain/web3 helper
   - the `contracts/` workspace
4. Make the smallest change that fully solves the problem.
5. Add or update tests when behavior changes.
6. Smoke test the affected flow.

Do not do broad refactors unless explicitly asked.

---

## 6. Validation Expectations

For app changes, run the smallest relevant validation first, then the broader gates as needed.

Common commands:

```bash
pnpm lint
pnpm test
pnpm typecheck
pnpm build
pnpm check
```

For smart-contract changes:

```bash
pnpm --dir contracts test
```

For local UI-flow verification, prefer real browser smoke tests. If the task calls for browser automation, use Playwright.

Do not claim a feature works unless you ran the relevant checks.

For local-vs-remote Supabase env handling and test ownership by change type, use `docs/engineering/env-and-testing.md`.

---

## 7. Supabase Workflow

The canonical database assets live under `supabase/`.

- `supabase/migrations/` contains forward-only migrations
- `supabase/config.toml` is the local Supabase CLI config
- `supabase/seed.sql` is the tracked public-schema seed artifact

When working locally:

- prefer local Supabase for destructive or migration validation
- if Docker is needed locally on this machine, Colima is an acceptable path
- do not push to, reset, re-link, or otherwise modify the remote Supabase project unless the user explicitly granted permission in their most recent prompt; if that permission is absent, stop and ask first
- do not reset the remote Supabase project unless the user explicitly asks and the impact is understood

If the tracked seed is unsuitable for a local smoke test, use a disposable local workdir rather than mutating canonical repo assets casually.

---

## 8. Commit and Session Log Rules

Every commit must be accompanied by an update to a current branch log under `agent-context/session-log/`.

Each session-log entry should:

- use the existing `### session vN: ...` format
- include timestamp, agent, branch, and head
- describe:
  - objective
  - actions taken
  - tests and validation notes
  - reflections
  - suggested next steps

If you split work into multiple commits, add an incremental session-log entry for each commit, not one combined entry at the end.

Do not make a commit that changes code without updating the current branch log in `agent-context/session-log/` in the same commit.

---

## 9. Things To Avoid

- Do not reintroduce legacy `database/` migration workflows.
- Do not add parallel Supabase client abstractions when the repo already has one.
- Do not put secrets, service-role keys, treasury private keys, or RPC credentials in tracked files.
- Do not bypass project-role checks for project payment or onboarding actions.
- Do not leave temporary local test directories, generated dumps, or disposable workdirs tracked in Git.
- Do not commit broken lint, typecheck, tests, or build unless the user explicitly asks for an incomplete checkpoint.

---

## 10. Practical Defaults

- Prefer server-rendered data access first, client-side fetching second.
- Prefer typed Supabase queries over loose JSON plumbing.
- Prefer explicit loading/error/empty states over silent failures.
- Prefer reviewable migrations over hand-wavy schema drift.
- Prefer keeping user drafts private until explicitly published.
- Prefer keeping onchain support curated and deterministic rather than accepting arbitrary user-supplied chain/token configuration.

When in doubt, align with the most recent patterns already present in the repo rather than the generic pattern from another project.
