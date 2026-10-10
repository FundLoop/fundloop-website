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

### session v2: Codex review on #280 — seven findings, three of them races

- **Timestamp:** 2026-10-10T05:56:13Z
- **Agent:** Claude Code (Claude Opus 5)
- **Branch:** `feat/275-sign-in-with-cubid` (PR #280)
- **Head before commit:** `6b0924d`

---

#### Objective

Address Codex's first pass on #280: three P1 and four P2, all real. Two of the P1s were concurrency
holes in exactly the thing this PR exists to guarantee.

---

#### The three P1s

- **Linking raced event receipt.** `oauth_apply_security_event` could read "no mapping" while
  `link_cubid_subject` read "no events"; both then wrote, leaving a linked subject with an
  unapplied withdrawal — the precise state criterion 7 exists to prevent, reachable by interleaving
  two functions that each looked correct alone. Both now take a transaction-scoped advisory lock on
  `('cubid_subject:' || issuer || ':' || subject)` before reading anything, and so does
  `unlink_cubid_subject`. `oauth_apply_security_event` is replaced in this migration to add it.
- **A disconnect could be outrun.** Unlinking revoked the live grants and deleted the mapping, but
  left previously revoked grant rows untouched and unlocked. A redemption that had already read the
  mapping could resume afterwards and *revive* such a grant, because `oauth_redeem_grant` allows
  revival for an assertion minted after the recorded `revoked_at` — the right rule for a withdrawal
  the person reversed at Cubid, the wrong one for an identity they detached here. Two changes:
  unlinking now locks **every** grant for the person, and `oauth_redeem_grant` refuses when no
  `cubid_oidc_subjects` row exists, inside its locked statement, returning a new `unlinked`
  outcome. Codex suggested recording an unlink timestamp; requiring a live mapping is simpler and
  strictly stronger, since the mapping's absence *is* what disconnecting means.
- **The Edge Function command boundary.** AGENTS.md §3.2 allows an exception only where an
  engineering doc explicitly records one, and mine described the implementation without recording
  it. Now recorded, with scope: the callback's writes only, because establishing the session *is*
  setting Supabase's cookies on the Next response and an Edge Function cannot do that — and the
  account creation cannot move alone either, or the compensating deletion ends up on the wrong side
  of the call with the email address stranded. Disconnecting from settings is explicitly **not**
  exempt and should be an Edge Function command in the UI follow-up.

---

#### The four P2s

- A throwing `link_cubid_subject` left the created account behind, so the person's next attempt was
  told the address was in use. Extracted `removeUnreachableAccount` and called it on both paths.
- A link was bound to whoever was signed in *after* the round trip, so a browser that switched
  accounts in another tab would attach the identity to the wrong account. The start route now
  records the initiating user id in the request cookie and the callback refuses a mismatch.
- `CUBID_OIDC_TOKEN_ENDPOINT` accepted plain http, which would have put the client secret in a
  Basic header on the wire. One `isHttpsOrLoopback` helper now gates the issuer, the key set, the
  redirect URI and both endpoint overrides. A test covers `localhost.evil.test`, which a looser
  prefix check would have allowed.
- The callback deleted the pending cookie before validating `state`, so an unsolicited callback
  could erase a live sign-in's state. Validation now comes first, and the cookie is consumed only
  once the state matches — still before the code is exchanged.

---

#### Tests and Validation

- 21 new cases: the shared subject lock in all three functions and that it is taken before any read;
  unlinking locking every grant before deleting the mapping; redemption requiring a live mapping
  inside its lock; the replaced redemption keeping every rule the two earlier reviews settled; the
  linking account recorded and required; plain-http refused for each endpoint; and the created
  account removed when linking throws.
- 186 files, 1394 tests passing; typecheck and lint clean.

---

#### Reflections

Both races came from the same habit: two functions that each check a condition and then act, with
nothing making the pair atomic. #279 had the same shape and I fixed it there with one locked
statement; here I wrote a second function that reads what the first one writes and did not ask what
happens if they interleave. The question to carry forward is not "is this statement atomic" but
"which other statement reads what this one writes".

### session v3: the deep review — a cleanup that never ran, and a lock that was missing

- **Timestamp:** 2026-10-10T06:30:03Z
- **Agent:** Claude Code (Claude Opus 5)
- **Branch:** `feat/275-sign-in-with-cubid` (PR #280)
- **Head before commit:** `7580a77`

---

#### Objective

The independent deep review found three P2s and a P3 on `7580a77`, no P1s. Two of them were cases
where the code I had written to close a hole did not actually close it.

---

#### What each one was

- **The compensating `deleteUser` could never have worked.** `on_auth_user_created` creates a
  `public.users` row for every new account, and `users_user_id_fkey` references `auth.users(id)`
  with **no ON DELETE**, so deleting the account while that row exists fails on the constraint. The
  address therefore stayed taken and the next attempt got `email_taken` — the exact outcome the
  cleanup existed to prevent. I verified the constraint in `initial_remote.sql` rather than taking
  it on trust. Fixed by deleting the profile row first, which is the order
  `tests/e2e/support/supabase-fixtures.ts` already uses for the same reason. The test now asserts
  the call order, not just that both calls happen.
- **`oauth_redeem_grant` was outside the lock.** I had added the advisory lock to linking,
  unlinking and event receipt but not to redemption, reasoning that the grant row lock would
  serialize it. On a client's *first* redemption there is no grant row to lock, so the mapping check
  could read a snapshot from before an unlink committed and issue a token after the disconnect;
  `account-purged` deletes the mapping the same way. Redemption now takes the same subject lock
  before anything, and checks the **exact** (issuer, subject, user) mapping rather than "this person
  has some Cubid identity" — otherwise disconnecting one identity and linking another leaves an
  assertion from the old one honourable, because the grant row survives an unlink. That needed two
  new parameters, so the function is dropped and re-created, with its grants re-stated.
  `unlink_cubid_subject` cannot know which lock to take without reading the mapping first, so it
  re-reads under the lock and refuses if anything moved.
- **The pending-request cookie was plantable.** Unsigned and without the `__Host-` prefix, a
  sibling host under the registrable domain can set `Domain=.fundloop.org` and www will send it —
  login CSRF, and the only reason it was not account takeover is the `linkingUserId` check added in
  the previous round. Now both: the `__Host-` prefix on https (unprefixed on http for local
  development, reads accept either), and an HMAC signature with a new
  `FUNDLOOP_CUBID_COOKIE_SECRET` that sign-in is unavailable without, refusing a secret under 32
  characters. The signature is verified before the contents are parsed.
- **The bridge trusted the address.** It looked the account up by email and never compared what
  `verifyOtp` signed in against the identity the flow had resolved. It now takes the expected user
  id, checks it against `generateLink`'s user and against the established session, and signs out
  rather than returning a session for anybody else.

---

#### Tests and Validation

- The migration test file now asserts its own slices are non-empty first. Three assertions had
  started passing against an empty string when `create or replace` became `create`, which looks
  exactly like the SQL changing — the guard makes the real cause obvious.
- New: the profile deletion and its ordering; the subject lock in redemption and that it precedes
  the row lock; the exact-mapping check; the drop-and-recreate with re-stated grants; unlinking's
  re-read under the lock; sealing and opening a request; a planted request with the wrong secret and
  an edited payload refused; the `__Host-` prefix on https; the cookie secret length floor; the
  `unlinked` outcome; and the issuer and subject reaching the RPC.
- 186 files, 1409 tests passing; typecheck and lint clean.

---

#### Reflections

Two of the four were protections I had written and not checked: a deletion that could not succeed,
and a lock I argued was redundant. The argument was wrong for one case I had not enumerated — the
first redemption, where the row I was relying on does not exist yet. "Which row am I relying on, and
when does it not exist" is the question that would have caught it.
