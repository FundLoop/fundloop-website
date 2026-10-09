# OAuth 2.1 Authorization Server

FundLoop's authorization server for delegated third-party access (issue #266, stage 2). It lets a
person grant an application — WondrBot first — read access to their own FundLoop data, without
handing over their FundLoop sign-in.

Stage 1 shipped the tokenless public reads. Stage 3 adds the `/api/v1/me*` routes that consume these
tokens. Stage 4 makes MCP accept them. Stage 5 adds the Connected Apps UI.

## What it implements

| Endpoint | Contract |
| --- | --- |
| `GET /oauth/authorize` | RFC 6749 §4.1.1 with mandatory PKCE (RFC 7636, S256 only) |
| `POST /oauth/token` | RFC 6749 §4.1.3 and §6; rotating single-use refresh tokens |
| `POST /oauth/revoke` | RFC 7009 |
| `GET /.well-known/oauth-authorization-server` | RFC 8414 (served through a rewrite) |
| `GET /{locale}/oauth/consent` | The consent screen, inside the localized layout |

Scopes are `profile:read`, `awards:read` and `payout-routes:read`. There is no implicit grant, no
password grant, and no dynamic client registration.

## Decisions worth knowing

**Nothing bearer-shaped is stored in the clear.** Authorization codes, access tokens, refresh tokens
and client secrets are kept as SHA-256 digests, with a CHECK constraint on the shape of each column.
Whoever reads the database cannot replay what they find there.

**Single use is enforced by the database.** Every consume is an `UPDATE` guarded on the row still
being unconsumed, and a zero-row result means someone else got there first. A read-then-write in
application code would let two concurrent redemptions of one code both succeed.

**A rotated refresh token presented again revokes the whole grant.** A legitimate client never
presents a token it has already exchanged, so the second presentation means two parties hold it
(RFC 9700). The same applies to an authorization code presented with the wrong client or redirect
URI: the grant is revoked rather than salvaged.

**Scopes on refresh come from the stored grant, never from the request.** A refresh cannot widen
access, and a request that asks for more is answered with what the grant holds.

**Redirect URIs are matched exactly**, from their own table so each one is validated on its own row.
No prefix matching, no patterns, no wildcard subdomains. HTTPS only, apart from an IPv4 or IPv6
loopback for a native development client, and never a fragment.

**Client-controlled values never travel through the consent UI.** `/oauth/authorize` validates the
request and stores it against an opaque token; the consent page carries only that token. A tampered
form can therefore narrow what is granted — a person may untick a scope — but cannot change where
the code is sent, which client receives it, or the PKCE challenge it is bound to.

**Errors go back to the client only once the client and redirect URI are trusted.** Before that,
there is nowhere trustworthy to send them, so the person sees an error page instead. This is
RFC 6749 §4.1.2.1, and it is why the authorization endpoint has an HTML response at all.

**Sign-in happens on the consent page.** The person signs in with the existing OTP flow, which
returns to the same URL, so the request token survives and they come back to the same decision. A
request can only ever be approved by an account that authenticated for that decision.

## Why these endpoints are not Edge Functions

`AGENTS.md` section 3.2 makes typed Supabase Edge Function commands the write boundary, and asks for
any exception to be recorded in the relevant engineering doc. This is that record.

The authorization server is not application state behind a command boundary; it *is* the identity
boundary, and it has to live at the origin that serves it:

- RFC 8414 requires the issuer to equal the origin the metadata was fetched from. Edge Functions are
  served from `*.supabase.co`, so an OAuth server hosted there would have to claim a different
  issuer from the host a person sees in their address bar while consenting.
- The consent screen is a page in this app, behind this app's session cookie. Splitting the decision
  (here) from the code issuance (there) would mean passing the authenticated decision across an
  origin boundary, which is a new attack surface for no gain.
- A third-party OAuth library fetches `/.well-known/oauth-authorization-server` relative to the
  issuer and expects `authorization_endpoint`, `token_endpoint` and `revocation_endpoint` on that
  same host.

The tables are still reachable only by the service role, which is the property the write-boundary
rule exists to protect: no browser and no client role can read or write them, and RLS is enabled on
every one. If the Edge runtime later serves the web origin directly, this exception should be
revisited rather than inherited.

## Operating it

**Registering a client** is an operator insert, by design: there is no dynamic registration. A row
in `oauth_clients` plus one row per redirect URI in `oauth_client_redirect_uris`. A confidential
client stores `sha256(secret)`; a public client stores no secret at all, which the
`oauth_clients_secret_matches_type` constraint enforces. Set `is_sandbox` for a test client, which
the consent screen states to the person.

**Withdrawing a client's access** is `update oauth_clients set disabled_at = now()`. The
authorization endpoint then treats it as unregistered, and no new code or token is issued.

**Expired rows** are removed by `public.oauth_purge_expired()`, which keeps revoked and expired
tokens for 30 days so a revocation stays explicable. Scheduling it is stage 5; the function exists so
the schedule is a one-liner and the retention rule has one definition.

## Known follow-ups

- `types/supabase.ts` predates these tables, so `lib/oauth/store.ts` carries one documented cast.
  Regenerate the types against the migration and remove it.
- No rate limiting on `/oauth/token` yet. It needs shared state across instances to be worth
  anything, so it belongs with the API-wide limiter rather than as a per-instance counter here.
- `/oauth/authorize` and `/oauth/token` must not be locale-prefixed, which depends on the
  `shouldSkipLocaleRouting` change in stage 1 (#269).
