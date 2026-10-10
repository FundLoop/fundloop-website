# Sign in with Cubid (FundLoop as a Login Client)

How a person signs in to FundLoop with their Cubid identity, and how an existing email account gets
linked to one (issue #275). The issuer-side contract is
`cubid-monorepo/docs/engineering/login-with-cubid-oidc-architecture.md`; this document is the
FundLoop half. Delegated access for sibling apps is a separate concern, in
[cubid-cross-app-access.md](./cubid-cross-app-access.md).

## One Cubid client, two roles

FundLoop registers **one** client at Cubid and uses it both for interactive sign-in and as the
cross-app *resource* client of #266. Not two, and this is the decision everything else rests on.

Cubid derives the public `sub` as `HMAC(master_secret, "cubid-sub:v1" || issuer || client_id ||
human_subject_key)`, so `client_id` is part of the derivation and the same person gets a different
`sub` at every client. The mappings this flow writes into `cubid_oidc_subjects` are looked up by the
`sub` an identity assertion carries, which is the resource client's subject. With a second client
for sign-in, every mapping would be under a subject no assertion ever mentions, and delegated access
would verify assertions correctly and then find nobody — silently, and forever.

So `FUNDLOOP_CUBID_CLIENT_ID` is shared between this flow and the event receiver, while
`FUNDLOOP_CROSS_APP_AUDIENCE` stays what it is: the resource audience from the WondrBot pairing,
which only assertions use.

`public.users.cubid_id` is **not** this. That column belongs to the older Cubid Passport API
integration and holds a Cubid user id; the pairwise OIDC subject lives only in
`cubid_oidc_subjects`. Nothing should ever match a person across the two.

## The flow

| Endpoint | What it does |
| --- | --- |
| `GET /auth/cubid/start` | Builds the authorization request and redirects to Cubid |
| `GET /auth/cubid/callback` | Verifies the result and signs the person in, or links the subject |

Authorization Code with PKCE, which is the only grant Cubid offers for human login — implicit and
hybrid are unsupported there. The request carries `response_type=code`, `scope=openid email
profile`, `state`, `nonce`, and an S256 `code_challenge`. There is no consent screen of FundLoop's
own: consent is hosted in Passport, versioned per client and scope.

`start` keeps the verifier, state and nonce in one short-lived httpOnly cookie, and that cookie is
the only thing proving a callback belongs to a request this browser started. **This browser is not
the only writer of its cookie jar**: a sibling host under the registrable domain — `dev.fundloop.org`,
or any subdomain that ever exists — can set a cookie with `Domain=.fundloop.org` that www then
sends. A planted state, nonce and verifier is enough for login CSRF: lure the person to a crafted
callback and they are signed in as somebody else's Cubid identity. So the cookie is defended twice:

- the **`__Host-` prefix**, which a browser accepts only for a Secure, `Path=/`, `Domain`-less
  cookie, so a sibling host cannot set that name at all. Local development over http cannot set one,
  so it falls back to the unprefixed name and reads accept either;
- an **HMAC signature** over the contents with `FUNDLOOP_CUBID_COOKIE_SECRET`, because a browser
  that does not enforce the prefix would still accept a planted cookie, and a signature it cannot
  forge is what makes that cookie useless. Sign-in is unavailable without the secret rather than
  unsigned, and a secret under 32 characters is refused.

The signature is checked before the contents are parsed. The cookie is consumed once the callback's
`state` matches the sealed copy — and not before, so an unsolicited callback cannot erase the
request the person is in the middle of.

`callback` verifies the ID token before trusting any claim — RS256 only, a `kid` the issuer
publishes, `iss`, `aud` equal to our client id, `azp` where present, lifetime inside the contract's
15 minutes, and `nonce` equal to the cookie's. The signature rules are the shared ones in
`lib/cross-app/jws.ts`, so an identity assertion or a Security Event Token cannot pass as an ID
token and the reverse holds too.

The endpoints are derived from the issuer (`{issuer}/authorize`, `{issuer}/token`), which is where
the contract publishes them, with per-endpoint overrides in configuration. Sign-in therefore starts
without a discovery round trip; moving to `/.well-known/openid-configuration` is a follow-up and
would change nothing else.

## The session, and why it is not FundLoop's own

Every RLS policy in this schema is written against `auth.uid()`, so a Cubid sign-in has to end in a
real Supabase session. Supabase Auth has **no generic OIDC provider**: its provider list is fixed and
`signInWithIdToken` accepts only Google, Apple, Azure, Facebook and Kakao. Cubid cannot be plugged
in as one.

The bridge is the admin API, server side: generate a magic link for the resolved account and redeem
it in the same request, so no mail is sent and nothing is left for anyone else to use.

**That call signs in whoever holds the address**, and `generateLink` even creates the account when
the address is unknown. It is therefore called only for an account the subject already maps to, or
one this request just created for that subject — never because an email matched. That rule is the
single most dangerous line in the flow, and `tests/cubid-sign-in-flow.test.ts` pins it.

## What happens to each person

| At the callback | What FundLoop does |
| --- | --- |
| The subject is already mapped | Signs in to that account. No claim can move the mapping |
| The subject is new, and no account holds the email | Creates the account, links the subject, signs in |
| The subject is new, and an account holds the email | **Stops.** Shows "sign in to that account and connect Cubid from your settings" |
| `intent=link`, with a session | Maps the subject to the signed-in person. The session is untouched |
| `intent=link`, without one | Refused |

**An email match is never a link.** Holding an address is not proof of controlling the account that
uses it, which is #275 acceptance 3. Control of a FundLoop account is proven by holding its session,
which is what the `link` intent requires.

**The uniqueness of `auth.users.email` is the check**, not a read of the table. Account creation is
attempted and a refusal with `email_exists` is what says an account exists — so there is no
read-then-write race, and no need to reach into the auth schema at all.

**A created account that cannot be linked is removed again**, profile row first. If
`link_cubid_subject` refuses or fails after the account was created, nobody can reach that account
and nothing points at it; leaving it would take the address for good. The order matters:
`on_auth_user_created` creates a `public.users` row for every new account and `users_user_id_fkey`
references `auth.users(id)` with **no ON DELETE**, so deleting the account first fails on the
constraint and the address stays taken — the cleanup would simply never have worked.
`tests/e2e/support/supabase-fixtures.ts` tears accounts down in the same order for the same reason.
A failure to remove it is logged, because then the address really is held by an account nobody can
use.

**The session is checked against the identity that was resolved, not against the address.** The
admin API addresses an account by email, but what the flow resolved is a user id, so the id is
passed to the bridge and compared both to `generateLink`'s user and to the user `verifyOtp` actually
signed in; a session for anybody else is torn down rather than returned.

**Cubid releases `email` only when it has verified it and the person consented, and a new Cubid
account often has none.** Without an address there is nothing to create a FundLoop account against,
so sign-in is refused with an explanation rather than inventing a placeholder that looks real in
`auth.users` and is not.

How common that is was initially misjudged here, and the correction matters. The default was
recorded on the reasoning that "a Google-federated Cubid account always has one" — but **Cubid has
no Google sign-in at all**. It is passkey-first: its own specification says "a new user may create a
CUBID account using only a passkey. No email, phone, or OAuth stamp is required before account
creation", and the prompt that would later collect one "must not interrupt SIWC relying-party
redirects" — which is exactly our redirect. So a brand-new Cubid account arriving here with no
address is the expected case, not an edge one.

The refusal therefore points at the journey that does work, and the UI says so: sign in with an
email address, then connect Cubid from account settings. Two steps rather than one. Making it one
step needs FundLoop to collect and verify an address itself after a Cubid sign-in, which is tracked
on #275 as the open half of acceptance 1. (HBIC default, 2026-10-10; Noak can override it.)

## Recorded exception to the Edge Function command boundary

`AGENTS.md` §3.2 requires new writes to go through typed Supabase Edge Function commands "unless the
relevant engineering doc explicitly records a temporary exception". This is that record.

**Scope of the exception.** The OIDC callback (`app/auth/cubid/callback/route.ts`) performs its
writes in the Next request: `auth.admin.createUser`, the `link_cubid_subject` RPC, the
`last_seen_at` touch, and the session bridge. Nothing else in this feature is exempt.

**Why it cannot be an Edge Function command.** Establishing the session *is* setting Supabase's auth
cookies on the response Next is building. An Edge Function cannot write cookies onto another
service's HTTP response, so the bridge has to run here whatever else moves. The account creation and
the link cannot then be moved on their own either: if the account were created behind the boundary
and the bridge failed here, the compensating deletion would be on the wrong side of the call, and
the email address — the one thing that must not be taken by an unreachable account — would be
stranded. The sequence is one decision, and splitting it would add a failure mode rather than remove
one.

**What is not exempt, and should go behind the boundary when it is built.** Disconnecting Cubid from
account settings is an ordinary authenticated mutation with no cookie semantics: it belongs in a
typed Edge Function command calling `unlink_cubid_subject`, and the UI follow-up should build it
that way rather than as another route handler. The same applies to any later surface that links or
unlinks outside the callback.

**What would end the exception.** A first-party way to mint a Supabase session from a verified
external identity — a Supabase generic OIDC provider, or a server-side session-issuing API — would
remove the reason for all of it. Until then this stays, scoped to the callback.

## Linking, and criterion 7

`public.link_cubid_subject(issuer, subject, user_id)` is the only thing that writes
`cubid_oidc_subjects`, and it does more than insert a row.

#279's Security Event Token receiver cannot apply a withdrawal for a subject nobody has linked yet —
there is no user to record it against — so it stores the event as `unknown_subject` and nothing more.
Mapping that subject afterwards is the moment those events become applicable. If the mapping were
written without applying them, an identity assertion minted *before* the withdrawal would create a
fresh grant and be honoured. That is **acceptance criterion 7 on #275**, and it is enforced inside
the function so a second caller cannot forget it:

1. a subject a purge event has already arrived for is refused outright — the Cubid account behind it
   is gone, and a new Cubid account would be a new pairwise subject;
2. the mapping is inserted, idempotently for the same person and refused for anyone else;
3. every `cross-app-consent-revoked` already received for that subject is applied through
   `oauth_revoke_grant`, which records the withdrawal even with no grant row — and that tombstone is
   what stops the older assertion;
4. those event rows are backfilled with the user id, so they are explicable from both ends.

All of it in one statement, so there is no window where the subject is linked and the withdrawal is
not.

**Everything that writes about one subject serializes on it.** `link_cubid_subject`,
`unlink_cubid_subject`, `oauth_apply_security_event` and `oauth_redeem_grant` all take a
transaction-scoped advisory lock on `(issuer, subject)` before reading anything. Redemption needs it
as much as the rest: on a client's *first* redemption there is no grant row for a concurrent
disconnect to have locked, so the row lock alone leaves a window in which the mapping is read from a
snapshot taken before the delete committed and a token is issued after the disconnect. Redemption
also checks the **exact** mapping the assertion names rather than "this person has some Cubid
identity", because a grant row survives an unlink and somebody who disconnected one identity and
linked another would otherwise have an assertion from the old one honoured. Unlinking has to read
the mapping before it can know which lock to take, so it re-reads under the lock and refuses if
anything changed. Late withdrawals are ordered by `event_time` (RFC 8417 `toe`) exactly as live delivery is, with
the same dormancy while Cubid sends no `toe` — see "Ordering a late revocation" in the cross-app
document.

`public.unlink_cubid_subject(user_id)` is deliberately not the inverse: it revokes the person's live
grants as well as removing the mapping, because delegated access issued against an identity should
not outlive the link to it.

## Configuration

`CUBID_OIDC_ISSUER`, `FUNDLOOP_CUBID_CLIENT_ID`, `CUBID_OIDC_CLIENT_SECRET`,
`FUNDLOOP_CUBID_REDIRECT_URI`, `FUNDLOOP_CUBID_COOKIE_SECRET`, and optionally `CUBID_OIDC_JWKS_URI`,
`CUBID_OIDC_AUTHORIZATION_ENDPOINT` and `CUBID_OIDC_TOKEN_ENDPOINT`. Unconfigured means sign-in is
unavailable rather than broken, which is the normal state until Cubid is deployed
(cubid-monorepo#179 is the staging rollout).

Every URL is held to the same rule — HTTPS, or a loopback host where there is no network to listen
on — including the endpoint overrides, because the code exchange sends the client secret to the
token endpoint. The redirect URI is matched exactly at Cubid, so it is configuration and never
derived from the request. Preview deployments get a generated hostname per deployment, which cannot be registered, so
**three redirect URIs are registered and no more**: production, the stable development host
`https://dev.fundloop.org/auth/cubid/callback`, and a loopback one for local work. A Vercel preview
therefore cannot complete a Cubid sign-in, by design — testing the flow means using the development
host. (HBIC default, 2026-10-10; Noak can override it.)

## The account page

Two Cubid cards sit on `workspace/account`, and they are different things. `AccountSettingsPanel`
shows the **Cubid Passport API** integration: the identity score, the stamps, `public.users.cubid_id`.
`CubidSignInPanel` shows whether a Cubid **passkey can sign you in** to FundLoop, from
`cubid_oidc_subjects`. Keeping them as separate cards is deliberate; merging them would invite the
conflation this document warns about.

The panel never receives the pairwise subject. `getCubidSignInLinkStatus` returns whether a link
exists and when, because the subject is Cubid's identifier for this person at this client and has no
business in a page.

Disconnecting asks first, and says what it costs: it ends the delegated access of every application
the person approved at Cubid for FundLoop, because access issued against an identity should not
outlive the link to it. It refuses outright if the account has no other way in. That cannot happen
today — every FundLoop account has an email address, including one created by Cubid sign-in — but the
invariant is the point, and it is enforced in the command rather than the UI.

## Still to build

1. ~~The UI~~ — landed: a "Sign in with Cubid" action in the auth modal (shown only where the
   deployment is configured), the `CubidSignInPanel` card on the account page for connecting and
   disconnecting, and `CubidOutcomeNotice` to say what happened after a round trip. Disconnecting
   goes through the `cubid-identity-disconnect` Edge Function command — **not** a route handler,
   because the recorded exception above covers the callback only — and refuses to remove the only
   way into an account.
2. **Terms acceptance at first sign-in** (#275 acceptance 1), deliberately unimplemented.
   `legal_acceptance_records` is the store, but `policyAcknowledgementSources` is a closed
   vocabulary of two payment surfaces today, and FundLoop's Terms are a *review draft* carrying
   "DRAFT - NOT APPROVED - NOT EFFECTIVE" with `noLegalEffect: true`. Adding a sign-in surface to
   that vocabulary is a small change; deciding what it means for a person to accept a non-effective
   document as a condition of signing up is not, and it is a question for counsel rather than for
   engineering. Recording an acceptance that asserts something untrue would be worse than recording
   none, so this records none until the Terms are effective.
3. **Discovery** instead of derived endpoints, if the issuer ever moves them.
4. ~~A provider hint for Google~~ — **settled, and the answer is that there is nothing to send.**
   Cubid has no Google sign-in and no provider-hint parameter; `/authorize` takes `login_hint`,
   which narrows the passkey ceremony rather than choosing a provider. FundLoop sends no hint, which
   is what this implementation already does. Google at Cubid would be a Cubid product request.
   (Answered 2026-10-10 from Cubid's code and its live login page.)
