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
   not claim a longer life than the contract gives it.

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

**No refresh tokens.** A client renews by redeeming a fresh assertion, which re-checks consent at
Cubid. Issuing our own refresh token would keep access alive on FundLoop's say-so after a person
withdrew consent at Cubid.

**Access tokens live 15 minutes.** Until the Security Event Token receiver lands, that lifetime is
the only bound on a withdrawn client's remaining access. It is deliberately short for that reason,
and renewal costs the client one round trip.

**An unknown `kid` is retried once against refreshed keys**, because that is what a key rotation
looks like. The JWKS cache has a refresh floor, so a stream of assertions naming unknown keys cannot
turn this endpoint into a request amplifier aimed at Cubid.

**Unconfigured means refused.** With no issuer or audience configured there is nothing to verify
against, so redemption answers `temporarily_unavailable` rather than falling back to a default.

## Operating it

**Registering a requesting client** is an operator insert into `oauth_clients`: `client_id` and
secret digest for authenticating to FundLoop, `cubid_client_id` for the `client_id` claim an
assertion carries (the two need not match), and `allowed_scopes`. Set `is_sandbox` for a test
client. There is no dynamic registration.

**Withdrawing a client** is `update oauth_clients set disabled_at = now()`, after which no assertion
from it is redeemable. Revoking one person's access is `revokeTokensForGrant`, which the Security
Event Token receiver will call.

**Configuration**: `CUBID_OIDC_ISSUER`, `FUNDLOOP_CROSS_APP_AUDIENCE`, and optionally
`CUBID_OIDC_JWKS_URI` when it is not `{issuer}/jwks`.

**Expired rows** are removed by `public.oauth_purge_expired()`. Scheduling it is stage 5.

## The liftable kit

`lib/cross-app/` is framework-free on purpose: Web Crypto, `TextEncoder` and an injected `fetch`
only, no Node or Deno built-ins, no configuration reads, no database access. It runs unchanged on
Node, Deno and an edge runtime, so ChainCrew, SmarTrust and MyPayTag can take `id-jag.ts` plus this
migration as a starting point rather than reimplementing assertion verification four times.

`lib/oauth/` is the FundLoop side — token issuance, hashing and the store — and uses `node:crypto`.

## Still to build

1. **The Security Event Token receiver** for `cross-app-consent-revoked`, killing that person's
   tokens for that client. Also `account-purged`, which the contract sends to every client with an
   active relationship: ignoring it would leave tokens alive for a deleted Cubid account.
2. **Sign in with Cubid, and linking an existing email account**, which is what populates
   `cubid_oidc_subjects`. Until it exists, redemption verifies assertions correctly and then has
   nobody to issue a token for, so nothing works end to end.
3. Two operator steps on the Cubid side: FundLoop registered as a Cubid OIDC resource client (which
   is where `FUNDLOOP_CROSS_APP_AUDIENCE` comes from) and a pairing with the requesting client.
4. `types/supabase.ts` predates these tables, so `lib/oauth/store.ts` carries one documented cast.
