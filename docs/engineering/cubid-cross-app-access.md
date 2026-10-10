# Cubid Cross-App Access (FundLoop as a Resource App)

How a sibling app — WondrBot first — reads a person's own FundLoop data on their behalf, without a
FundLoop password and without FundLoop running a consent screen of its own (issue #266, stage 2).

FundLoop is a **resource app**. The requesting client obtains an identity assertion grant (ID-JAG)
from Cubid, where the person's consent is captured and withdrawn, and redeems it here for a FundLoop
access token. The issuer-side contract is
`cubid-monorepo/docs/engineering/oidc-cross-app-access.md`; this document is the FundLoop half.

> **Why not per-app OAuth.** FundLoop briefly had its own authorization endpoint, consent page and
> authorization-code flow with PKCE (commit `27976f6`, before this was reworked). Noak chose Cubid
> cross-app access for sibling apps instead, so a person grants access once, in one place, and sees
> and withdraws every cross-app consent in Passport rather than per app. The earlier work is in the
> branch history if that decision is ever revisited.

## What FundLoop implements

| Endpoint | Contract |
| --- | --- |
| `POST /oauth/token` | Redeems an ID-JAG: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer` |
| `POST /oauth/revoke` | RFC 7009, for a client dropping its own token |
| `POST /oauth/security-events` | RFC 8417 Security Event Tokens, RFC 8935 push delivery |
| `GET /.well-known/oauth-authorization-server` | RFC 8414, describing the redemption endpoint |

Scopes are `profile:read`, `awards:read` and `payout-routes:read`. There is **no** authorization
endpoint, no consent page, no authorization code, no PKCE and no refresh token.

## Verifying an assertion

`lib/cross-app/id-jag.ts` checks, in this order and before trusting any claim:

1. three base64url segments, `typ` is `oauth-id-jag+jwt`, `alg` is RS256;
2. `kid` names a key the issuer currently publishes, and the signature verifies against it;
3. `iss` equals the configured Cubid issuer, `aud` equals this app's configured audience (a string
   or an array containing it), `client_id` is the Cubid client id of the authenticating client;
4. `exp` has not passed and `iat` is not in the future, within a small skew, and the assertion does
   not claim a longer life than the contract's five minutes;
5. `crit` is absent (we understand no JWS extensions, so naming one is a refusal), the key is
   published for signing with RS256, and a `scope` claim, if present, is a string.

The `typ` check is what keeps an ID-JAG and an ID token from being interchangeable. Without it a
requesting client could redeem an ID token it already holds.

Every denial returns a reason for the log and the same `invalid_grant` message to the client: which
check failed is information that helps shape the next attempt. The one exception is an unlinked
Cubid identity, which is stated plainly because it is actionable by the person.

## Decisions worth knowing

**The pairwise subject is the only identifier an assertion carries**, and Cubid derives it per
resource app. `cubid_oidc_subjects` maps it to a FundLoop user. A row is written by Sign in with
Cubid or by linking an existing account — **never inferred from an email address**, because
inferring it would defeat the point of pairwise subjects, which is that sibling apps cannot
correlate a person. An unmapped subject is a denial, not an account creation.

**A replay is a constraint violation, not a race.** Redeeming records the assertion's `jti` as a
primary key before the token is issued, so a second redemption fails on the insert.

**Scope comes from the assertion and nowhere else.** An absent `scope` claim means none was
requested, or the Cubid pairing allows none — it never means "all of them", and reading it as the
client's registered list would grant past the pairing's own limit, since that list is a separate
ceiling an operator keeps here rather than the person's consent. An assertion with no scope is
refused. The registered list still applies as a ceiling, so an operator can withdraw a scope here
without waiting for the pairing to change. A client may narrow its own token further with a `scope`
parameter, which narrows that token only.

**An assertion's `scope` is a per-exchange request, not a consent envelope.** The contract carries
it "only when requested and allowed", so it reflects what the client asked for in that one exchange,
bounded by the pairing. A smaller value therefore says nothing about the person's standing consent,
and FundLoop must not treat it as narrowing: two parallel workers asking for different scopes would
otherwise revoke each other's tokens. **Consent narrowing at Cubid is not observable here at all** —
the contract sends a Security Event Token on withdrawal, not on a scope reduction — so the bound on
a scope the person has removed is the token's 15-minute lifetime, and nothing longer-lived may be
issued without revisiting that.

**An assertion proves consent as of its `iat`, not as of now.** The contract marks outstanding
assertions revoked at Cubid on withdrawal, which a resource app cannot observe, so an assertion
minted before a withdrawal must not revive a revoked grant. `oauth_redeem_grant` refuses one whose
`iat` is at or before the grant's `revoked_at`.

**A redemption is one statement, including the token.** `oauth_redeem_grant` locks the grant row,
decides revival, updates the recorded scopes **and inserts the token**, then returns the id. The
insert has to be inside: with it outside, two concurrent redemptions could interleave so that the
wider one's token landed after the narrower one's supersession, leaving a live token wider than the
grant recording it.

**A withdrawal is also one statement, and is recorded even with no grant row.**
`oauth_revoke_grant` locks, revokes the live tokens and marks the grant — creating a revoked row
with no scopes if the person never redeemed here. Without that row a revocation for an unknown pair
wrote nothing, so a later assertion minted *before* the withdrawal would create a fresh grant and be
honoured. The schema allows an empty scope array only on a revoked grant, for exactly this.

**`iat` and `revoked_at` come from different clocks**, Cubid's and ours, so the pre-withdrawal check
carries a 30-second margin and errs towards refusing.

**No refresh tokens.** A client renews by redeeming a fresh assertion, which re-checks consent at
Cubid. Issuing our own refresh token would keep access alive on FundLoop's say-so after a person
withdrew consent at Cubid.

**Access tokens live 15 minutes.** The Security Event Token receiver ends a withdrawn client's
access as soon as Cubid can tell us; the lifetime is the bound on the gap between the withdrawal and
that delivery, and on a withdrawal Cubid never manages to deliver at all. Renewal costs the client
one round trip.

**An unknown `kid` is retried once against refreshed keys**, because that is what a key rotation
looks like. The JWKS cache has a refresh floor, so a stream of assertions naming unknown keys cannot
turn this endpoint into a request amplifier aimed at Cubid.

**Unconfigured means refused.** With no issuer or audience configured there is nothing to verify
against, so redemption answers `temporarily_unavailable` rather than falling back to a default.

## Receiving a revocation

Cubid pushes an RFC 8417 Security Event Token to `POST /oauth/security-events` when a person
withdraws a cross-app consent, when a pairing or a client is retired, or when a Cubid account is
deleted. RFC 8935 is the delivery: `Content-Type: application/secevent+jwt`, the compact JWS as the
whole body, any 2xx an acknowledgement, and retries after 1, 5, 30, 120 and 720 minutes before
Cubid marks the event failed.

**There is no client authentication on this endpoint, and there is not meant to be.** The contract
authenticates the token, not the connection, so the signature over a key Cubid publishes is the only
thing that makes a delivery credible. `lib/cross-app/secevent.ts` checks, before trusting any claim:
`typ` is `secevent+jwt`, `alg` is RS256, `crit` is absent, `kid` names a published signing key and
the signature verifies; then `iss` is the configured issuer, `aud` is `FUNDLOOP_CUBID_CLIENT_ID`,
`sub_id` is an `iss_sub` identifier minted by that same issuer, and `events` is a non-empty object
of objects. A SET carries no `exp`, so freshness is an `iat` bound of seven days — generous because
delivery retries run most of a day, and wide only because single use of the `jti` is what actually
stops a replay.

**Where the event's own `subject` disagrees with `sub_id`, the token is refused.** Both name a
person; a token where they differ is ambiguous, and acting on either would be a guess.

| Event | What FundLoop does |
| --- | --- |
| `cross-app-consent-revoked` | Revokes that requesting client's grant and live tokens for that person. The client is matched by `requesting_client_id`, its id *at Cubid* |
| `account-purged` | Revokes every client that holds a grant for that person, and drops the Cubid subject mapping |
| `consent-revoked` | Recorded, nothing else: the contract reserves it for Login with Cubid notices, and cross-app access has its own event |
| anything else | Recorded as an unimplemented type |

**Every verified event is acknowledged, including the ones with nothing to do.** An unmapped
subject, an unknown requesting client and an unimplemented event type would never start working on a
retry, so leaving them pending would end with Cubid marking a delivery failed while FundLoop had in
fact decided what to do with it. A row in `oauth_security_events` records which it was, with the
payload verbatim. Only our own failures answer 5xx — unconfigured, unreachable keys, a database
error — because those are the cases where retrying is exactly right. A token that does not verify
answers 400 with the RFC 8935 `err` vocabulary.

**A redelivery is idempotent because the `jti` is the primary key.** `oauth_apply_security_event`
records the receipt and performs every revocation it causes in one statement, so a committed row
means the work happened and a duplicate key means it happened already. Split in two, a crash between
them would leave an event marked applied with access still live.

**An `account-purged` drops the subject mapping and leaves the FundLoop user alone.** The subject
identifies nobody at Cubid any more, and left in place it would tell account linking that this
person is still linked to an account that can never authenticate again. A Cubid deletion is not a
FundLoop deletion, and this event is not authority for one.

**The gap: a revocation for a subject nobody has linked yet.** For a person FundLoop knows,
`oauth_revoke_grant` records a withdrawal even with no grant row, which is what stops an assertion
minted before the withdrawal from reviving access. For an unlinked subject there is nobody to record
it against, so the event is stored as `unknown_subject` and nothing else. If that subject is linked
afterwards, an assertion older than the revocation would be honoured. Closing it belongs to linking
(stage 2c): it must look the subject up in `oauth_security_events` before mapping it, which is what
`oauth_security_events_subject_idx` is for.

## Operating it

**Registering a requesting client** is an operator insert into `oauth_clients`: `client_id` and
secret digest for authenticating to FundLoop, `cubid_client_id` for the `client_id` claim an
assertion carries (the two need not match), and `allowed_scopes`. Set `is_sandbox` for a test
client. There is no dynamic registration.

**Withdrawing a client** is `update oauth_clients set disabled_at = now()`, after which no assertion
from it is redeemable. Revoking one person's access is `revokeTokensForGrant`, which the Security
Event Token receiver will call.

**Configuration**: `CUBID_OIDC_ISSUER`, `FUNDLOOP_CROSS_APP_AUDIENCE` (the resource audience from
the pairing, which an assertion's `aud` must equal), `FUNDLOOP_CUBID_CLIENT_ID` (FundLoop's own
client id at Cubid, which a Security Event Token's `aud` must equal — a different value), and
optionally `CUBID_OIDC_JWKS_URI` when it is not `{issuer}/jwks`.

**Expired rows** are removed by `public.oauth_purge_expired()`: redeemed assertion ids after a day,
dead tokens after 30 days, received events after 180 days. Scheduling it is stage 5.

## The liftable kit

`lib/cross-app/` is framework-free on purpose: Web Crypto, `TextEncoder` and an injected `fetch`
only, no Node or Deno built-ins, no configuration reads, no database access. It runs unchanged on
Node, Deno and an edge runtime, so ChainCrew, SmarTrust and MyPayTag can take `jws.ts`, `id-jag.ts`
and `secevent.ts` plus these migrations as a starting point rather than reimplementing assertion
verification and event receipt four times each. `jws.ts` holds what the two verifiers share — the
signature, the header rules and the JWKS cache — so the half that is easiest to get wrong exists
once.

`lib/oauth/` is the FundLoop side — token issuance, hashing and the store — and uses `node:crypto`.

## When a bearer validator lands, it must check four things

Nothing reads `oauth_tokens` yet. Stage 3's `/api/v1/me*` routes will, and unless that validator
checks all four of these, the revocation and supersession rules above have no effect:

1. the token's own `revoked_at` — supersession sets exactly this;
2. the token's `expires_at` — issuance is not a substitute for checking it on every request;
3. the grant's `revoked_at` — a withdrawal revokes the grant, and tokens under it must stop;
4. `oauth_clients.disabled_at` — a disabled client is refused at `/oauth/token` today, but nothing
   revokes the tokens it already holds, so the validator is where that is enforced.

## Still to build

1. **Sign in with Cubid, and linking an existing email account**, which is what populates
   `cubid_oidc_subjects`. Until it exists, redemption verifies assertions correctly and then has
   nobody to issue a token for, so nothing works end to end.
2. Two operator steps on the Cubid side: FundLoop registered as a Cubid OIDC resource client (which
   is where `FUNDLOOP_CROSS_APP_AUDIENCE` and `FUNDLOOP_CUBID_CLIENT_ID` come from) and a pairing
   with the requesting client. Registering `security_events_uri` is part of the first: it must be
   HTTPS to a public host, so `https://www.fundloop.org/oauth/security-events`.
3. Linking must consult `oauth_security_events` for the subject it is about to map, so a revocation
   that arrived before the link is not forgotten. See "Receiving a revocation" below.
