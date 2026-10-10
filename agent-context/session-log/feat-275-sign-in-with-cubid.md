# Session Log: feat/275-sign-in-with-cubid

### session v1: Sign in with Cubid — the server side (#275, stage 2c)

- **Timestamp:** 2026-10-10T05:40:33Z
- **Agent:** Claude Code (Claude Opus 5)
- **Branch:** `feat/275-sign-in-with-cubid`
- **Head before commit:** `6981399`

---

#### Objective

Stage 2c of the Cubid work: the flow that populates `cubid_oidc_subjects`, without which #266
verifies identity assertions correctly and then has nobody to issue a token for. Built from the
design on #275, with acceptance criterion 7 as a hard requirement.

Scoped to the server side. The UI — a sign-in action in the auth modal, connect and disconnect in
account settings — is a second PR with almost no security surface; the routes already take
`intent=link` for it. Said so on the PR rather than quietly narrowing.

---

#### The decision everything rests on

**One Cubid client, both roles.** Cubid derives the pairwise `sub` from `client_id`, so a separate
sign-in client would mint a different subject for the same person and every mapping this flow writes
would be under a subject no assertion ever carries — delegated access would verify correctly and
find nobody, silently and forever. `FUNDLOOP_CUBID_CLIENT_ID` is therefore shared with the event
receiver, while `FUNDLOOP_CROSS_APP_AUDIENCE` stays the resource audience from the pairing.

---

#### Actions Taken

- `lib/cross-app/id-token.ts`: the ID token verifier, on the shared `jws.ts`. `iss`, `aud`, `azp`
  where present, the contract's 15-minute lifetime, and `nonce` against the cookie's.
- `lib/cross-app/jws.ts`: `verifyCompactJws` now accepts several `typ` spellings, with `undefined`
  meaning no header — an ID token's `typ` is optional in OpenID Connect Core, while the artefacts
  that carry a distinguishing one still cannot pass as it. The alternative was a retry loop in the
  caller or a cast, both worse.
- `lib/auth/cubid-oidc-request.ts`: state, nonce and PKCE verifier, the authorization URL, and the
  same-origin guard on the destination. The S256 derivation is checked against RFC 7636's own
  worked example in the tests.
- `lib/auth/cubid-sign-in.ts`: the decisions, outside the route handlers so they are testable
  without Next's plumbing and so sign-in and linking cannot drift apart.
- `lib/auth/cubid-session-bridge.ts`: admin `generateLink` plus `verifyOtp` in one request, so no
  mail is sent and nothing is left for anyone else to use.
- `supabase/migrations/20261010060000_link_cubid_subject.sql`: `link_cubid_subject` and
  `unlink_cubid_subject`.
- `app/auth/cubid/start/route.ts` and `app/auth/cubid/callback/route.ts`, both thin.
- `docs/engineering/sign-in-with-cubid.md`, the route inventory, `.env.example`, and the cross-app
  doc's "Still to build".

---

#### Decisions worth recording

- **Supabase Auth has no generic OIDC provider.** Its provider list is fixed and `signInWithIdToken`
  takes only Google, Apple, Azure, Facebook and Kakao, so Cubid cannot be plugged in. Since every
  RLS policy is written against `auth.uid()`, sign-in has to bridge into a real Supabase session
  through the admin API. That bridge signs in whoever holds the address — and `generateLink` even
  creates the account when the address is unknown — so it is called only for an account the subject
  already maps to, or one this request just created for that subject. Never because an email
  matched. That is the most dangerous line in the flow and a test pins it.
- **The uniqueness of `auth.users.email` is the existence check.** Attempting creation and reading
  `email_exists` beats reading the table first: no race, and no reaching into the auth schema from
  PostgREST, which does not expose it. Same shape as the `jti` primary key in #279.
- **A created account that cannot be linked is deleted again**, because nobody could reach it and
  the address would be taken for good. A failure to delete is logged rather than swallowed.
- **No email, no account.** Cubid releases `email` only when it has verified it and the person
  consented. Refusing with an explanation beats synthesising a placeholder that looks real in
  `auth.users` and is not. This is one of the four decisions I asked Noak for on #275; I built my
  recommendation and flagged it rather than blocking.
- **Criterion 7 lives in the database**, not in a route handler, so a second caller cannot forget
  it. The mapping and the withdrawals it makes applicable commit together.
- **No SECURITY DEFINER.** The caller is the service role, and the function never reads the auth
  schema, so there is nothing definer would be needed for.

---

#### Tests and Validation

- `tests/cubid-sign-in-flow.test.ts` (19): real RS256 ID tokens and the real verifier, with the
  database, token endpoint and session bridge stubbed. Covers the mapped-subject path, account
  creation, the email-already-taken refusal, the missing-email refusal, criterion 7's revocations
  surfacing, the orphan deletion, a purged subject, all four linking cases, and what is refused
  before any account is touched — wrong audience, wrong nonce, an assertion presented as an ID
  token, a rejected code, an unreachable issuer, an unconfigured deployment, and an inconclusive
  key check.
- `tests/cubid-id-token.test.ts` (20) and `tests/cubid-oidc-request.test.ts` (13).
- `tests/cubid-subject-link-migration.test.ts` (14), asserting on the SQL with comments stripped —
  a `statementsOnly` helper, after the deep review on #279 showed how easily a guard ends up
  testing its own prose. My first run of it failed on exactly that: the no-SECURITY-DEFINER
  assertion matched a comment saying there is none.
- 185 files, 1373 tests passing; typecheck and lint clean. The migration has run nowhere; CI's
  fresh-schema replay is its first execution.

---

#### Suggested Next Steps

1. The UI PR: sign-in action, connect and disconnect. Disconnect must refuse to leave an account
   with no way back in.
2. Terms acceptance at first sign-in. `legal_acceptance_records` is the store, but the source
   vocabulary is two payment surfaces and the Terms are a review draft with no legal effect — the
   second half of that is a counsel question, not an engineering one.
3. Noak's four decisions on #275 remain open; three of them change little, and the Google provider
   hint needs an answer from Cubid.
