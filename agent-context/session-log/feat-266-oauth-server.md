# Session Log: feat/266-oauth-server

### session v1: OAuth 2.1 authorization server (#266 stage 2)

- **Timestamp:** 2026-10-09T18:30:00Z
- **Agent:** Claude Code (Claude Opus 5)
- **Branch:** `feat/266-oauth-server`
- **Head before commit:** `7473aa4`

---

#### Objective

Stage 2 of #266: the authorization server that issues delegated tokens, so stage 3's `/api/v1/me*`
routes have something to authenticate. Scopes are the three agreed read-only ones.

---

#### Actions Taken

- **Migration `20261009120000_oauth_authorization_server.sql`.** Six tables plus a
  `public.oauth_scope` enum. Codes, access tokens, refresh tokens and client secrets are stored as
  SHA-256 digests with a CHECK on each column's shape. RLS on every table and service-role-only
  grants, because these rows are the credentials. Redirect URIs live in their own table so each is
  validated on its own row — a CHECK cannot contain a subquery, and per-element array validation
  needs one. A `oauth_purge_expired()` function holds the retention rule; scheduling it is stage 5.
- **`lib/oauth/`**: `scopes.ts` (vocabulary, parsing, subset checks, consent copy), `crypto.ts`
  (token generation, digests, PKCE S256, TTLs, constant-time compare), `errors.ts` (RFC 6749 §5.2
  shapes, not our `/api/v1` envelope, because a standard client parses `error`/`error_description`),
  `store.ts` (service-role data access).
- **Endpoints**: `/oauth/authorize`, `/oauth/token`, `/oauth/revoke`, and the RFC 8414 document at
  `/.well-known/oauth-authorization-server` through a rewrite, since Next's router ignores a
  directory whose name starts with a dot. Consent UI at `/{locale}/oauth/consent` with server
  actions for approve and deny.
- **Docs**: `docs/engineering/oauth-authorization-server.md` records the design decisions, how to
  register and withdraw a client, and the Edge Function write-boundary exception. `docs/mcp/auth-and-scopes.md`
  replaces its deferred `fundloop:*` sketch with the implemented vocabulary and says why there is no
  write, founder or operator scope. Route inventory rows for all five surfaces.

---

#### Decisions worth re-reading

- **Single use is the database's job.** Every consume is an `UPDATE` guarded on the row still being
  unconsumed; a zero-row result means someone else won. A read-then-write would let two concurrent
  redemptions of one code both succeed.
- **Reuse is treated as compromise, not staleness.** A rotated refresh token presented again, or a
  code presented with the wrong client or redirect URI, revokes the whole grant (RFC 9700).
- **A refresh cannot widen access**: scopes come from the stored grant, never from the request.
- **Client-controlled values never travel through the UI.** The authorize endpoint stores the
  validated request against an opaque token, so a tampered consent form can only narrow what is
  granted — never redirect the code elsewhere or change the PKCE binding.
- **Errors reach the client only once the client and redirect URI are trusted**; before that the
  person sees an error page, per RFC 6749 §4.1.2.1.
- **Why not Edge Functions.** AGENTS.md section 3.2 makes Edge Function commands the write boundary
  and asks for exceptions to be recorded in an engineering doc; that record is in the new doc. The
  short version: RFC 8414 requires the issuer to equal the origin serving the metadata, the consent
  decision is made behind this app's session cookie, and splitting the decision from code issuance
  across origins adds attack surface for no gain. The tables remain service-role only, which is the
  property the rule protects.

---

#### Validation Notes

- 44 tests across four new suites: primitives (scope vocabulary against the database enum, PKCE,
  digest storage, TTLs), the token endpoint (12 cases, mostly refusals), authorize/metadata/revoke,
  and the consent actions. Typecheck and lint clean.
- Most cases are what the server refuses: identical answers for an unknown client and a wrong
  secret, PKCE required with S256 only, a replayed code, a code for the wrong client or redirect, a
  rotated refresh token, a lost rotation race, a scope the client is not registered for, a tampered
  consent form, and a signed-out decision.
- No local Supabase stack was started. CI's fresh-schema replay validates the migration; the suites
  mock the store, so the SQL logic that cannot be unit-tested locally is the part CI must prove.
- Tests were run with a node-environment vitest config kept outside the repo, because the jsdom
  default makes a local run unaffordable on this host. The permanent fix is its own approved PR
  after #269 and #270 land.

---

#### Reflections

The riskiest part is not the crypto, it is the state machine: which row may be consumed, by whom,
exactly once. That is why every single-use step is a guarded `UPDATE` rather than a check followed by
a write, and why reuse revokes rather than merely refuses. The second-riskiest is the consent screen,
where the temptation is to pass the client's parameters through the UI; storing them server-side
against an opaque token removes that whole class of tampering.

---

#### Suggested Next Steps

- This branch depends on stage 1's `shouldSkipLocaleRouting` change (#269) so `/oauth/*` is not
  locale-prefixed. Merge `dev` in once #269 lands, then add the locale-bypass assertion to the tests.
- Stage 3: `/api/v1/me`, `/me/award`, `/me/payout-routes` with scope enforcement against these
  tokens.
- Regenerate `types/supabase.ts` and drop the cast in `lib/oauth/store.ts`.

### session v2: Reworked to Cubid cross-app access (ID-JAG)

- **Timestamp:** 2026-10-09T18:50:00Z
- **Agent:** Claude Code (Claude Opus 5)
- **Branch:** `feat/266-oauth-server`
- **Head before commit:** `27976f6`

---

#### Objective

Noak chose Cubid cross-app access over per-app OAuth for sibling apps, so FundLoop becomes a
*resource app*: consent is captured and withdrawn in Cubid Passport, and a requesting client redeems
an identity assertion grant (ID-JAG) here. Drop the authorization endpoint, the consent page and the
authorization-code flow with PKCE; keep the token, hash and scope foundation.

---

#### Actions Taken

- **Removed**: `/oauth/authorize`, the consent page, its server actions and components, and the
  authorization-request and authorization-code tables. All of it remains at `27976f6`, so a single
  revert restores it if the decision is ever revisited.
- **`lib/cross-app/id-jag.ts`** — framework-free assertion verification: Web Crypto, `TextEncoder`
  and an injected `fetch` only, no configuration reads, no database access. Checks `typ`
  (`oauth-id-jag+jwt`, which is what stops an ID token being redeemed here), RS256, `kid` against
  the published JWKS, the signature before any claim is trusted, then `iss`, `aud`, `client_id`,
  `exp`, `iat` and the claimed lifetime. Plus a JWKS cache with a refresh floor.
- **`POST /oauth/token`** now redeems `urn:ietf:params:oauth:grant-type:jwt-bearer` and nothing else.
  Records the `jti` before issuing, maps the pairwise subject through `cubid_oidc_subjects`, narrows
  scope to the assertion and then to the request, and issues a 15-minute access token.
- **Schema**: `cubid_oidc_subjects` (pairwise subject to user, unique both ways per issuer) and
  `oauth_assertion_jtis` (primary key on `jti`, so a replay is a constraint violation). Clients are
  confidential-only with a mandatory secret and carry their Cubid client id explicitly. Tokens are
  access-only.
- **Docs**: `docs/engineering/cubid-cross-app-access.md` replaces the authorization-server doc,
  including why per-app OAuth was dropped and where that code lives. `docs/mcp/auth-and-scopes.md`
  and the route inventory follow.

---

#### Decisions worth re-reading

- **No refresh tokens.** A client renews by redeeming a fresh assertion, so Cubid re-checks consent
  on every renewal. Our own refresh token would keep access alive on FundLoop's say-so after a
  person withdrew consent at Cubid.
- **An unmapped pairwise subject is a denial, never an account creation**, and the mapping is never
  inferred from an email address: that would defeat what pairwise subjects are for.
- **Every assertion denial returns one message**; the specific reason goes to the log only. The
  exception is an unlinked Cubid identity, which is stated plainly because the person can act on it.
- **Access-token lifetime is 15 minutes** precisely because the revocation receiver does not exist
  yet, and that lifetime is currently the only bound on a withdrawn client's access.

---

#### Validation Notes

- 42 tests: the verifier is exercised against **real RS256 signatures from a locally generated
  key**, not a mocked verifier — wrong `typ`, `alg` confusion including `alg: none`, unknown `kid`,
  a foreign key, a tampered payload with a genuine signature, issuer/audience/client mismatches,
  expiry, future `iat`, an over-long claimed lifetime, missing claims, malformed input, and the JWKS
  cache's floor and outage behaviour. The redemption route is tested the same way, end to end
  through the real verifier, with only the store and configuration stubbed.
- Typecheck and lint clean. A test caught a real bug: the RLS loop still named the dropped tables,
  which would have failed the migration in CI.
- CI's fresh-schema replay remains the only proof the migration applies; no local stack was started.

---

#### Reflections

Dropping work that was finished and tested is uncomfortable, but the per-app flow was the wrong
shape for a family of sibling apps: a person would have faced one consent screen per app and had
nowhere to see them together. What survived is the half that was always going to be ours — token
issuance, hashing, scope enforcement — and the verifier is better code than the consent page was,
because it is portable and its failure modes are all enumerated.

The sequencing matters more than the code: without Sign in with Cubid there is no pairwise subject
to map, so this endpoint verifies assertions perfectly and then has nobody to issue a token for.

---

#### Suggested Next Steps

- The Security Event Token receiver, then Sign in with Cubid and account linking.
- Ask the Wondr HBIC for the staging issuer, audience and client ids once cubid-monorepo#179 lands.
