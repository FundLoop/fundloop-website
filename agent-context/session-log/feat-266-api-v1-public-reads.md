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

### session v3: Review findings on PR #269 (#266 stage 1)

- **Timestamp:** 2026-10-09T15:15:00Z
- **Agent:** Claude Code (Claude Opus 5)
- **Branch:** `feat/266-api-v1-public-reads`
- **Head before commit:** `31a69d1`

---

#### Objective

Codex review left nine findings on PR #269 — one P1 and eight P2 — and `dev` requires conversation resolution, so the merge is blocked until each is addressed. Three were correctness bugs in what the API publishes.

---

#### Actions Taken

- **Provisional cycle data (P1).** Both public views select `WHERE NOT production_enabled AND status = 'payout_readying'`, so every row they can return is a pre-payout figure from shadow mode, and `fundloop.org` shows them on non-production deployments only (`loadPublicProjectEpochClose` is gated). The endpoint published them unconditionally as the "latest closed cycle". New `lib/monthly-cycles/epoch-close-visibility.ts` holds that gate for both callers; the route now answers `data: null` where the website withholds, marks every response `provisional: true`, and the OpenAPI document and route inventory say so.
- **Monetary precision (P2).** `funded_minor` and friends are `numeric(78,0)` but the generated view types expose `number`, so a value above 2^53 was already rounded before `String()` — and a large enough one stringified in exponent notation and was replaced with `"0"`. The reads now cast in the database (`funded_minor::text`), which postgrest-js 2.104 types as `string`.
- **Withheld values (P2).** Aggregates are null for cohorts below the publication threshold; `?? 0` and `minor(null) === "0"` reported a real zero-member, zero-funded cycle. The response type, the helpers and the OpenAPI schema now keep every count and amount nullable.
- **Swallowed database failures (P2).** `getPublicProjectsDirectoryData` catches and returns `{projects: []}`, so a failed read looked like an empty directory. Extracted `loadPublicProjectsDirectory` (throws) with the catching wrapper kept for pages; the API uses the throwing path and answers 500.
- **Pagination (P2).** New `loadPublicProjectsPage` reads one keyset page: `order("id", desc)`, `limit + 1`, `lt("id", cursor)`, and member counts and categories for that page's rows only. A searched listing still ranges over the filtered directory, because the website matches category names and detailed descriptions in application code and narrowing that to database filters would silently change which projects a search finds.
- **Project resolution (P2).** New `loadPublicProjectRef` queries by exact slug first, then by numeric id, so a numeric id can no longer shadow a project whose slug is that same string. It also replaces the full-directory load the cycle route did for one project.
- **Malformed cursors (P2).** `parseCursor` requires a positive integer `after_id`; anything else is 422 instead of silently restarting the list.
- **Bare `/api` (P2).** `shouldSkipLocaleRouting` now exempts the `/api/` and `/oauth/` prefixes only. Bare `/api` and `/oauth` have no handler, so they keep the locale handling every other unrouted path gets.

---

#### Validation Notes

- `npx tsc --noEmit` clean; `pnpm lint` clean; full `vitest run` green, 1216 tests across 206 files (34 of them on this surface: 26 route tests, 8 new tests for the read path).
- New `tests/public-discovery-public-api-reads.test.ts` drives the query builder, so the public filters, `order`/`limit + 1`/`lt` keyset, page-scoped member counts, slug-before-id resolution and error propagation are each asserted.
- Route tests now cover an amount beyond IEEE-754 range surviving as text, withheld nulls staying null, a failed network read answering 500, and provisional figures being withheld on a production deployment.
- `next build` still cannot run in this worktree (Turbopack rejects the `node_modules` symlink); CI verifies the build.

---

#### Reflections

The P1 was a real contract error, not a naming quibble: the endpoint would have published pre-payout numbers as settled ones, in production, where the website deliberately shows nothing. Mirroring the website's own gate is the rule this surface needs — a public API must publish less than the website, never more.

---

#### Suggested Next Steps

- Resolve the nine threads on #269 with what changed, merge into `dev`, then confirm `/api/v1/projects` answers 200 (not 307) on dev.fundloop.org.
- Stage 2: the OAuth 2.1 server, validated through the CI fresh-schema replay.

### session v4: Second review round on PR #269

- **Timestamp:** 2026-10-09T17:05:00Z
- **Agent:** Claude Code (Claude Opus 5)
- **Branch:** `feat/266-api-v1-public-reads`
- **Head before commit:** `db38ac9`

---

#### Objective

Two reviews landed on the same head: five more Codex findings and an independent Claude deep review.
Twelve threads, two of them P2. One was a disclosure I had argued against myself.

---

#### Actions Taken

- **Dropped the `network` block.** `epoch_close_public_view` is anon-readable, but nothing in `app/`,
  `components/` or `lib/` renders it — I verified this rather than taking the finding on trust. So the
  endpoint was publishing network-wide pre-payout aggregates that fundloop.org never shows, on every
  preview deployment including the dev.fundloop.org sandbox. That contradicts the one rule this
  surface has. Exposing network totals deserves its own decision, not a side effect of shipping the
  project endpoint.
- **Replaced the application-side page with a database read model.** New migration
  `20261009130000_api_v1_public_projects_page.sql`: a SECURITY INVOKER function that does the keyset
  page, the search predicate (the same four fields the website matches, with the caller's `%` and `_`
  escaped) and the member count in one statement. PostgREST caps every read at 1,000 rows
  (`supabase/config.toml:96`), so the previous approach silently truncated once the directory passed
  the cap: a match beyond it could never appear, and member counts assembled from a capped
  membership read would understate or read zero. This fixes three findings at once and removes the
  unauthenticated full-table path.
- **Stateless anon client for public reads** (`lib/supabase-public-read.ts`). The SSR client is bound
  to the caller's cookies, so a signed-in browser ran these reads as `authenticated`, a token refresh
  could attach `Set-Cookie` to an API response, and a cookie-varying response cannot be cached.
- **Cacheable tokenless reads**: `public, s-maxage=60, stale-while-revalidate=300` on both public
  endpoints, which is what keeps an unauthenticated endpoint from turning every request into database
  work. The advertised 429 is gone: nothing returns it, and documenting a rate limit that does not
  exist is a promise the API cannot keep.
- **Public id is the slug, with no numeric alias.** `epoch_close_public_project_view` keys on the
  slug, so a slug-less project was listed under a numeric id that could never resolve to its cycle —
  and the website's own project page cannot render it either. The read model excludes projects
  without a slug, and `loadPublicProjectRef` resolves slugs only.
- Cursor keys must be safe integers (`1e21` passed `Number.isInteger` and became a 500); any digit
  string clamps to the maximum limit rather than 101-9999 clamping and 10000 failing; unknown
  `/api/v1` paths and unsupported methods answer inside the error envelope
  (`app/api/v1/[...unmatched]/route.ts`, `methodNotAllowed`); `openapi.json` carries `X-Request-Id`;
  the cycle payload carries a constant `currency: "USD"`; `website` and `logo_url` lost `format: uri`,
  which the stored values do not guarantee; the OpenAPI documents 405, 422 and 500.
- Removed `isSandboxDeployment`, `insufficientScope` and `rateLimited`: no callers, and the sandbox
  environment list disagreed with `isEpochClosePreviewEnabled`. Stage 2 adds them where they are used.

---

#### Validation Notes

- Typecheck and lint clean. Suites rewritten for the read model and the new behaviours.
- `types/supabase.ts` does not know the new function, so the RPC call carries one documented cast.
  Regenerating the types needs a Supabase stack, which this host cannot host right now; CI's
  fresh-schema replay validates the migration itself.
- Workers capped at 2 per the host rule; no full jsdom suite locally.

---

#### Reflections

The `network` block is the one worth remembering. I wrote the rule into the module header — never
publish more than fundloop.org already shows — and then broke it in the same file, because the view
was anon-readable and the data looked harmless. Readable by anon is not the same as published.

---

#### Suggested Next Steps

- Reply to and resolve all twelve threads, then merge when the six conditions hold.
- Stage 2 (the OAuth server) resumes after #269 lands; its branch is already cut.

### session v5: Third review round on PR #269

- **Timestamp:** 2026-10-09T19:58:00Z
- **Head before commit:** `265a934`

---

#### Objective

Seven findings from Codex's third pass. Two were correctness bugs in things I had already "fixed"
once, which is the useful part of a third pass.

---

#### Actions Taken

- **The search read model did not preserve the website's match set.** `projectMatchesSearch`
  concatenates name, description, category name and detailed description with spaces and then calls
  `includes`, so a term spanning two fields matches on the site. My four independent `ILIKE` clauses
  required the whole term inside one field: a project named "Alpha" described as "Beta" matches a
  website search for "alpha beta" and was missing from the API. Now one predicate over
  `concat_ws(' ', …)` in the same field order, so the claim I made in the previous round is actually
  true.
- **Noncanonical cursors were still accepted.** `Buffer.from(value, "base64url")` discards
  characters outside the alphabet, so appending `!` to a valid cursor decoded to the same payload
  and returned 200 — the 422 I had just added did not fire. `decodeCursor` now requires the
  base64url alphabet and that re-encoding reproduces the input exactly.
- **Request ids were being cached.** A shared cache stores headers with the body, so the first
  caller's `X-Request-Id` was replayed to every hit for the whole `stale-while-revalidate` window
  and could not correlate anything. Cacheable answers now carry no request id; every error is
  `no-store` and still carries one, which is what a caller actually needs to report.
- **Generated types for the RPC.** Hand-wrote the `api_v1_public_projects_page` entry in
  `types/supabase.ts`, mirroring the migration's signature and `RETURNS TABLE`, and removed the cast.
  The call is now typechecked against a declared contract.
- Unsupported methods on all three v1 routes answer in the envelope rather than Next's empty 405;
  the catch-all is optional (`[[...unmatched]]`) so the bare `/api/v1` path is covered, which a
  required catch-all does not match; and `search` and `projectId` lengths are counted in code points
  so validation matches the published `maxLength`.

---

#### Validation Notes

- Full node project: 171 files, 1119 tests passing. Typecheck and lint clean.
- New tests: the concatenated search order and single predicate, wildcard escaping, cursors with
  appended punctuation and whitespace, the absent request id on a cacheable response, 200 vs 201
  emoji against the character limit, and every unsupported method on every v1 route.

---

#### Reflections

Two of these were second attempts at things I had reported as fixed: the search parity and the
cursor validation. Both looked right and were wrong in a way only a careful reader would catch —
per-field matching reads as equivalent to concatenated matching until you think about a term that
spans a boundary, and `Buffer.from` silently tolerating junk is invisible unless you try it. Worth
remembering that "I added validation" is not the same as "invalid input is rejected".

---

#### Suggested Next Steps

- Merge in HBIC's order once the conditions hold.
