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

`start` keeps the verifier, state and nonce in one short-lived httpOnly cookie scoped to
`/auth/cubid`. The cookie **is** the trusted copy, so no signing secret is involved: comparing the
callback's `state` against it is what detects a request this browser did not begin, and tampering
with your own cookie only breaks your own sign-in. The cookie is cleared before anything else in the
callback, so a replayed callback finds nothing to match.

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

**A created account that cannot be linked is removed again.** If `link_cubid_subject` refuses after
the account was created, nobody can reach that account and nothing points at it; leaving it would
take the address for good. A failure to remove it is logged, because then the address is held by an
account nobody can use.

**Cubid releases `email` only when it has verified it and the person consented.** Without one there
is no address to create an account against, and sign-in is refused with an explanation rather than
inventing a placeholder address that looks real in `auth.users` and is not — a placeholder would be
indistinguishable from a real address later, and FundLoop sends real mail. A Google-federated Cubid
account always has one; a passkey-only account may not. The refusal should offer email sign-in as
the way through, which is part of the UI follow-up. (HBIC default, 2026-10-10; Noak can override
it.)

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
not. Late withdrawals are ordered by `event_time` (RFC 8417 `toe`) exactly as live delivery is, with
the same dormancy while Cubid sends no `toe` — see "Ordering a late revocation" in the cross-app
document.

`public.unlink_cubid_subject(user_id)` is deliberately not the inverse: it revokes the person's live
grants as well as removing the mapping, because delegated access issued against an identity should
not outlive the link to it.

## Configuration

`CUBID_OIDC_ISSUER`, `FUNDLOOP_CUBID_CLIENT_ID`, `CUBID_OIDC_CLIENT_SECRET`,
`FUNDLOOP_CUBID_REDIRECT_URI`, and optionally `CUBID_OIDC_JWKS_URI`,
`CUBID_OIDC_AUTHORIZATION_ENDPOINT` and `CUBID_OIDC_TOKEN_ENDPOINT`. Unconfigured means sign-in is
unavailable rather than broken, which is the normal state until Cubid is deployed
(cubid-monorepo#179 is the staging rollout).

The redirect URI is matched exactly at Cubid, so it is configuration and never derived from the
request. Preview deployments get a generated hostname per deployment, which cannot be registered, so
**three redirect URIs are registered and no more**: production, the stable development host
`https://dev.fundloop.org/auth/cubid/callback`, and a loopback one for local work. A Vercel preview
therefore cannot complete a Cubid sign-in, by design — testing the flow means using the development
host. (HBIC default, 2026-10-10; Noak can override it.)

## Still to build

1. **The UI**: a "Sign in with Cubid" action in the auth modal, and connect/disconnect in
   `settings/account`. The routes take an `intent=link` already, and disconnecting must refuse to
   leave an account with no way back in — a Cubid-only account cannot disconnect Cubid until it has
   an email method.
2. **Terms acceptance at first sign-in** (#275 acceptance 1), deliberately unimplemented.
   `legal_acceptance_records` is the store, but `policyAcknowledgementSources` is a closed
   vocabulary of two payment surfaces today, and FundLoop's Terms are a *review draft* carrying
   "DRAFT - NOT APPROVED - NOT EFFECTIVE" with `noLegalEffect: true`. Adding a sign-in surface to
   that vocabulary is a small change; deciding what it means for a person to accept a non-effective
   document as a condition of signing up is not, and it is a question for counsel rather than for
   engineering. Recording an acceptance that asserts something untrue would be worse than recording
   none, so this records none until the Terms are effective.
3. **Discovery** instead of derived endpoints, if the issuer ever moves them.
4. **A provider hint for Google**, if Cubid's `/authorize` takes one. Acceptance 1 on #275 reads as
   though FundLoop offers the choice, but the login architecture document describes no such
   parameter. Until Cubid answers, the assumption is that **Cubid's own login page owns that
   choice** and FundLoop sends no parameter — which is what this implementation does, so a `provider`
   or `idp_hint` parameter would be additive if one turns out to exist. (HBIC default, 2026-10-10,
   with the question open to the Cubid side.)
