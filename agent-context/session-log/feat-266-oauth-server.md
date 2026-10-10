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

- **Migration `20261010040000_oauth_authorization_server.sql`.** Six tables plus a
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

### session v3: Codex review on #273 — five live findings, eight against deleted code

- **Timestamp:** 2026-10-09T20:05:00Z
- **Head before commit:** `48fa397`

---

#### Objective

Thirteen findings. Codex reviewed `27976f6`, the per-app OAuth version, so eight describe code the
ID-JAG rework deleted. The useful work was checking whether each bug *class* survived into the
replacement rather than reporting the surface as gone.

---

#### Fixed, because they are live on the current head

- **Revocation was not bound to the presenting client.** `/oauth/revoke` authenticated one client
  and then revoked by token value alone, so any registered client that learned another's token could
  disconnect that client's grant (RFC 7009 §2.1). The lookup is now scoped to the authenticated
  client, and an already-revoked or expired row is treated exactly like an unknown token — which
  also closes a denial of service where a long-dead token could kill a person's current connection.
- **Basic credentials were advertised but not accepted** on revocation. The discovery document
  offers `client_secret_basic` for both endpoints; revocation read the form only. `readClientCredentials`
  is now shared by both endpoints, so a client following discovery is understood by each.
- **Re-consent handed old credentials authority over a new connection.** Reviving a revoked grant,
  or narrowing its scopes, left existing token rows tied to the same grant id. Both cases now
  supersede the grant's live tokens first. Re-redeeming with the same or wider scope does not, since
  that is ordinary renewal and dropping a client's current token would break requests in flight.
- **Generated types for all five tables**, with the `unknown` cast and the hand-written query
  interface gone, so every query in the store is checked against the schema. Writing them exposed a
  real schema weakness: `client_secret_sha256` was nullable with a `CHECK (… is not null)`, which is
  a NOT NULL constraint written awkwardly. The column is NOT NULL now and the constraint is gone.

#### Replied, with the class checked in the new code

Refresh-token expiry, rotation-race revocation and refresh scope widening: there are no refresh
tokens — renewal is a fresh assertion. PKCE-before-consume: the ID-JAG path verifies the assertion
fully *before* recording the jti, and no failure path revokes anything, so the variant where an
attacker disconnects a grant without proving possession cannot arise. Consent-action, redirect-binding,
consent-page refresh and deny-race findings: those surfaces are gone with the consent page.

---

#### Validation Notes

- Full node project: 172 files, 1115 tests. Typecheck and lint clean.
- New `tests/oauth-store-grants.test.ts` drives the store against a fake client: grant revival and
  narrowing supersede tokens, ordinary renewal does not, only a digest is stored, and revocation is
  client-scoped and ignores dead rows.

---

#### Reflections

The two findings worth keeping are the ones about *old credentials after a state change*: a revoked
token that can still revoke, and a narrowed grant whose broad token keeps working. Both come from
treating a grant row as a mutable record rather than as a generation, and both are invisible until
someone asks what a credential issued under the previous state can still do.

---

#### Suggested Next Steps

- Independent deep review, then the SET receiver.

### session v4: Independent deep review on #273

- **Timestamp:** 2026-10-10T01:35:00Z
- **Head before commit:** `a5db0c8`

---

#### Objective

Five findings — one P1, one P2, three P3 — from the independent review. The P1 was a consent bypass
I had defended on a Codex thread an hour earlier, which is worth recording as such.

---

#### Actions Taken

- **P1: an absent `scope` claim granted the client's whole registered list.** I had argued this was
  a deliberate default. It is not defensible: the Cubid pairing's `allowedScopes` can be narrower
  than FundLoop's `oauth_clients.allowed_scopes`, or empty, and the contract says the claim appears
  "only when requested and allowed" — so absent means none, never all. A scope-less assertion is now
  refused, and the registered list remains only a ceiling. A `scope` that is present but not a
  string is refused by the verifier rather than read as absent, which was the same bug by another
  route.
- **P2: an assertion minted before a withdrawal revived the grant.** An assertion proves consent as
  of its `iat`; Cubid marks outstanding assertions revoked on withdrawal and a resource app cannot
  see that. `oauth_redeem_grant` now refuses one whose `iat` is at or before `revoked_at`. The
  lifetime cap is 300s, the contract's figure, not the 600 I had allowed.
- **P3: the grant decision was a racy read-compare-write**, and a client narrowing its own request
  counted as the person narrowing consent. Both are fixed by moving the decision into
  `oauth_redeem_grant`: it locks the row, handles the concurrent-first-insert case through
  `unique_violation`, and records the *assertion's* scopes while the token carries the client's own
  narrowing.
- **P3: failures after the `jti` was spent.** Bookkeeping (`noteSubjectSeen`) can no longer cost a
  credential, and any unexpected error answers `server_error` in the OAuth shape instead of Next's
  generic 500.
- **P3: the JWKS fetch** now has a 5s deadline, refuses redirects, bounds staleness to an hour so a
  removed key stops being trusted even while the endpoint fails, and treats `{"keys": []}` as a
  valid empty set rather than an outage that keeps old keys alive. `crit`, `use` and `alg` on the
  key are checked.
- Documented the four checks a future bearer validator must make, since without them none of the
  revocation work above has any effect.

---

#### Validation Notes

- OAuth suites green (53 + 19 tests across the five files); typecheck and lint clean.

---

#### Reflections

The P1 is the one to remember: I had reasoned my way to "absent means the registered default" and
written that reasoning into a thread reply as if it settled the matter. The reviewer went to the
contract instead, where absent explicitly means none was requested or allowed. A default that grants
more than the person consented to is not a default, and my argument for it was exactly the sort that
sounds careful while quietly widening access.

### session v5: Second deep review on #273 — four P3s, one of them a design correction

- **Timestamp:** 2026-10-10T03:10:00Z
- **Head before commit:** `7f632d1`

---

#### The one that changed the design

**An assertion's `scope` is a per-exchange request, not a consent envelope.** The contract carries
it "only when requested and allowed", so it is what the client asked for in that one exchange,
bounded by the pairing. I had been recording it as "consented scopes" and superseding live tokens
whenever it narrowed — which means two parallel workers asking for different scopes would revoke
each other's tokens. Narrowing-based supersession is gone, the parameter is named
`assertionScopes`, and the doc now states plainly that consent narrowing at Cubid **is not
observable by a resource app at all**: the contract sends an event on withdrawal, not on a scope
reduction, so the only bound on a removed scope is the 15-minute token lifetime.

That also retires a fix I made two rounds ago for a finding written against the per-app OAuth model,
where consent genuinely was captured here. Carrying it into the ID-JAG model turned a real
protection into a self-inflicted denial of service.

#### The other three

- **The token insert moved inside `oauth_redeem_grant`.** It ran after the locked statement
  committed, so a wider redemption's token could land after a narrower one's supersession, leaving a
  live token wider than the grant recording it. The lock now covers the decision and the write.
- **A 30-second skew margin** on the pre-withdrawal check. `iat` is Cubid's clock and `revoked_at`
  is ours; an exact comparison trusted that they agree. The margin errs towards refusing.
- **A withdrawal is recorded even with no grant row.** `revokeTokensForGrant` was two unlocked
  statements and wrote nothing when no grant existed, so a revocation for a person who never
  redeemed here vanished — and a later assertion minted *before* that withdrawal would have created
  a fresh grant and been honoured. New `oauth_revoke_grant` locks, revokes and inserts a revoked row
  with no scopes when needed; the schema permits an empty scope array only on a revoked grant.

---

#### Validation Notes

- OAuth suites green; full node project green; typecheck and lint clean.
- The SQL contract tests now assert the insert is inside the locked function, the skew margin, that
  narrowing no longer triggers supersession, and that a withdrawal is recordable without a grant row.

---

#### Reflections

Three rounds of review on this file and the most damaging bug was not a missing check — it was a
wrong model of what a field means. I read `scope` as consent because that is what it meant in the
flow we deleted, and every correct-looking protection I built on top of it inherited the error.

### session v6: The migration had to be renumbered after #269 deployed

- **Timestamp:** 2026-10-10T04:10:00Z

`Supabase dry-run` and `Supabase execution` failed at `8b1727f` with migration history drift, and it
was not a SQL error. This branch's migration was timestamped `20261009120000`, while #269's
`20261009130000` had already merged and deployed to Dev. The remote history therefore could not be a
prefix of the expected list — the expected order put `…120000` *before* a migration the remote had
already applied — so the parity check refused, correctly.

Renamed to `20261010040000_oauth_authorization_server.sql`, after the last applied migration, and
updated the three files that referenced the old name. The expected list is now the remote history
plus one pending migration, which is the forward-pending case the verifier is built to validate.

Worth keeping in mind for any long-lived branch: a migration timestamp is only safe while nothing
else lands ahead of it. Allocate it when the branch is about to merge, not when the work starts, or
expect to renumber.
