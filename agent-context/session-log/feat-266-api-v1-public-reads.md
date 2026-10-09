# Session Log: feat/266-api-v1-public-reads

### session v1: Public /api/v1 read surface (#266 stage 1)

- **Timestamp:** 2026-10-09T12:00:00Z
- **Agent:** Claude Code (Claude Opus 5)
- **Branch:** `feat/266-api-v1-public-reads`
- **Head before commit:** `7473aa4`

---

#### Objective

Stage 1 of #266: the tokenless half of the delegated-access API that WondrBot and other MCP clients need, plus the shared response contract the later stages build on. Stage 2 adds the OAuth 2.1 server, stage 3 the `/me/*` routes, stage 4 MCP accepting those tokens.

---

#### Decisions recorded on the issue (set by the HBIC coordination session)

Option B (personal API keys) is skipped; scopes are `profile:read`, `awards:read`, `payout-routes:read`; stages 1-3 now with stage 4 after Production is healthy; the sandbox host stays configuration so nothing blocks on DNS.

---

#### Actions Taken

- `lib/api/v1/config.ts`: production and sandbox origins as configuration (`FUNDLOOP_PUBLIC_API_BASE_URL`, `FUNDLOOP_SANDBOX_API_BASE_URL`), defaulting to `https://www.fundloop.org` and `https://dev.fundloop.org`.

- `lib/api/v1/response.ts`: the shared contract from WondrBot's integration doc. `{ data, meta }` for success, `{ error: { code, message, request_id } }` for failure with the documented code-to-status mapping, `insufficient_scope` carrying an RFC 6750 challenge naming the missing scope, `Retry-After` for rate limits, opaque base64url cursors, limit clamping (default 25, max 100) and ISO-8601 UTC normalisation. Every response is `Cache-Control: no-store` with an `X-Request-Id`.
- `lib/api/v1/public-projects.ts`: read models that reuse the existing RLS-safe paths, so a third party can never see more than fundloop.org already shows. `getPublicProjectsDirectoryData` for the list; the anon-readable `epoch_close_public_project_view` and `epoch_close_public_view` for cycle status. The public id is the project slug (a stable string id); a numeric id also resolves.
- Routes: `GET /api/v1/projects` (cursor paginated, optional search), `GET /api/v1/projects/{projectId}/cycle` (latest closed cycle plus network totals; `data: null` when none has closed, not a 404), and `GET /api/v1/openapi.json` (OpenAPI 3.1, declaring the stage-2 OAuth security scheme and scopes so clients can read the shape early).
- `i18n/proxy-helpers.ts`: `shouldSkipLocaleRouting` only skipped `/api/internal`, so `/api/v1/projects` would have been redirected to `/en/api/v1/projects`. It now skips all of `/api`, `/oauth` and `/.well-known`, which stage 2 also needs.
- Recorded the three routes in `docs/engineering/route-inventory.md`.

---

#### Validation Notes

- `tests/api-v1-response.test.ts` (9) and `tests/api-v1-public-routes.test.ts` (18): status mapping, scope challenge, cursor opacity and round-trip, pagination that neither repeats nor skips, unknown-cursor and bad-limit rejection, an internal error that does not leak a connection string, minor-unit stringification including nulls, `data: null` for a project with no closed cycle, 404 for a project that is not publicly listed, and the locale-routing skip list.
- `tsc --noEmit` clean, full `eslint .` clean, full Vitest 205 files / 1198 tests.
- Verified against the live sandbox: `https://dev.fundloop.org/en` answers 200 publicly, and `/api/v1/projects` there currently answers 307, confirming the locale-routing fix is required before WondrBot can reach any `/api/v1`, `/oauth` or `/.well-known` URL.

---

#### Reflections

Two findings shaped the implementation. `monthly_cycles` has RLS with no policies, so `anon` sees nothing there; the public cycle data lives in two `security_barrier` views that are explicitly granted to `anon`. And the public cycle amounts have no currency column, so the fields are named `*_usd_minor` rather than implying a currency field exists; adding `currency` to those views would be a clean follow-up.

---

#### Suggested Next Steps

- Stage 2: the OAuth 2.1 server. Note `docs/mcp/auth-and-scopes.md` already defers a different scope vocabulary (`fundloop:user.read` and friends), which does not match WondrBot's required `resource:action` shape; that doc needs reconciling with the agreed names.
- Sandbox decided: `https://dev.fundloop.org`, wired as configuration in `lib/api/v1/config.ts` (HTTPS-only, origin-normalised, feeding the OpenAPI `servers` list). Stage 2's issuer and redirect allowlist read the same module.

### session v2: Fix the config env type that CI typecheck caught

- **Timestamp:** 2026-10-09T19:00:00Z
- **Agent:** Claude Code (Claude Opus 5)
- **Branch:** `feat/266-api-v1-public-reads`
- **Head before commit:** `303d1df`

---

#### Objective

CI `validate` failed typecheck on `tests/api-v1-config.test.ts`: object literals are not assignable to `NodeJS.ProcessEnv`.

---

#### Actions Taken

- `lib/api/v1/config.ts` now takes `EnvLike = Record<string, string | undefined>` instead of `NodeJS.ProcessEnv`, so callers and tests can pass a literal. No behaviour change.

---

#### Validation Notes

- `tsc --noEmit` clean (this time with the test file present) and the config suite passes.
- `next build` cannot run in this worktree: its `node_modules` is a symlink out of the tree and Turbopack rejects that (`Symlink [project]/node_modules is invalid`). CI installs real dependencies, so the build is verified there.

---

#### Reflections

My own process error: I ran `tsc` before writing the last test file, so the local typecheck never covered it. Run the gates after the final edit, not partway through.

---

#### Suggested Next Steps

- Merge once CI is green, then confirm the dev deploy reaches dev.fundloop.org (`/api/v1/projects` 200, not 307).
