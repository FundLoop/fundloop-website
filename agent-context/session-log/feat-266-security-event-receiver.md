# Session Log: feat/266-security-event-receiver

### session v1: The Security Event Token receiver (#266 stage 2b)

- **Timestamp:** 2026-10-10T04:20:53Z
- **Agent:** Claude Code (Claude Opus 5)
- **Branch:** `feat/266-security-event-receiver` (on top of `feat/266-oauth-server`, PR #273)
- **Head before commit:** `8215b04`

---

#### Objective

Stage 2 left a hole it documented: nothing on the FundLoop side could hear that a person had
withdrawn a cross-app consent at Cubid, so the only bound on a withdrawn client's access was the
15-minute access-token lifetime. This is the thing that hears — the RFC 8417 / RFC 8935 receiver —
so a withdrawal ends access in seconds instead of minutes, and a deleted Cubid account does not
leave live tokens behind.

---

#### Actions Taken

- Re-read the issuer-side contract from `Cubid-Me/cubid-monorepo`
  (`docs/engineering/oidc-cross-app-access.md`, "Security Event Tokens") rather than working from
  notes. Two things in it would have been wrong from memory: a SET's `aud` is the receiving
  client's **Cubid client id**, not the resource audience an assertion carries, and the event type
  identifiers are full URIs, one of them under `schemas.openid.net` rather than `schemas.cubid.me`.
- `lib/cross-app/jws.ts` (new): extracted the half of verification that an assertion and an event
  share — segment decoding, `typ`/`alg`/`crit` rules, `kid` resolution against published signing
  keys, the signature, and the JWKS cache. `id-jag.ts` now calls it and keeps only the assertion's
  claim contract. The alternative was a second copy of the security-critical half.
- `lib/cross-app/secevent.ts` (new): the SET verifier. `typ: secevent+jwt`, `iss`, `aud` =
  FundLoop's Cubid client id, an `iss_sub` `sub_id` minted by that issuer, a non-empty `events`
  object of objects, and an `iat` age bound. Refuses a token whose per-event `subject` disagrees
  with its `sub_id`.
- `lib/cross-app/config.ts`: added `crossAppReceiverConfig` for `FUNDLOOP_CUBID_CLIENT_ID`, kept
  separate from `crossAppConfig` so the receiver does not depend on a resource audience that comes
  from a pairing, and vice versa. The issuer rules are now shared by both.
- `supabase/migrations/20261010050000_oauth_security_event_receiver.sql`: `oauth_security_events`
  keyed by the token's `jti`, and `oauth_apply_security_event`, which records the receipt and
  performs every revocation it causes in one statement. `cross-app-consent-revoked` revokes one
  client's grant; `account-purged` revokes every client holding a grant and drops the subject
  mapping; `consent-revoked` is recorded as reserved; an unimplemented type is recorded as such.
  `oauth_purge_expired` replaced to carry the 180-day retention for received events.
- `app/oauth/security-events/route.ts`: `POST` only, `application/secevent+jwt`, 202 on an
  acknowledgement, 400 with the RFC 8935 `err` vocabulary when the token does not verify, 5xx only
  for our own failures. One forced JWKS refresh on an unknown `kid`, as redemption does.
- Docs: a "Receiving a revocation" section in `docs/engineering/cubid-cross-app-access.md`, the
  route in `docs/engineering/route-inventory.md`, and `docs/mcp/auth-and-scopes.md` no longer says
  the receiver is still to come.

---

#### Decisions worth recording

- **Every verified event is acknowledged, including the ones with nothing to do.** An unmapped
  subject, an unknown requesting client and an unimplemented event type would never start working on
  a retry; leaving them pending would end with Cubid marking the delivery failed while FundLoop had
  in fact decided what to do. Only our own failures answer 5xx, because those are the ones where
  retrying is right.
- **No client authentication on the endpoint, deliberately.** The contract authenticates the token,
  not the connection. Nothing acts before the signature verifies, and a request that fails
  verification changes nothing and reveals nothing about who exists.
- **The `jti` is the primary key, and the insert commits with the revocations.** A redelivery
  collides and is a no-op; split in two, a crash between them would mark an event applied with
  access still live.
- **`account-purged` drops the Cubid subject mapping and leaves the FundLoop user alone.** The
  subject identifies nobody at Cubid any more and would otherwise tell stage 2c's linking that this
  person is still linked. A Cubid deletion is not authority to delete a FundLoop account.
- **A seven-day `iat` bound, not a tight one.** Delivery retries run 1, 5, 30, 120 and 720 minutes
  after the first attempt, so a legitimate event can arrive most of a day late. Single use of the
  `jti` is what stops a replay; the age bound only stops a captured token being replayable forever.

---

#### Known gap, recorded on purpose

A revocation for a subject **nobody has linked yet** is stored as `unknown_subject` and nothing
else. For a person FundLoop knows, `oauth_revoke_grant` records the withdrawal even with no grant
row, which is what stops an older assertion from reviving access; for an unlinked subject there is
nobody to record it against. If that subject is linked afterwards, an assertion minted before the
revocation would be honoured. Closing it belongs to linking (stage 2c), which must consult
`oauth_security_events` before mapping a subject — `oauth_security_events_subject_idx` exists for
that lookup. Both the migration and the engineering doc say so at the point where it matters.

---

#### Tests and Validation

- `tests/cross-app-secevent.test.ts` (25 cases): real RS256 tokens signed by a locally generated
  key and checked by the real verifier. Covers an assertion presented as an event, an unsigned
  token, `crit`, a rotated-away `kid`, a signature from another key, wrong issuer and audience, an
  audience array, each missing claim, an unrecognised subject format, a subject from another issuer,
  a per-event subject that disagrees with `sub_id`, no events, malformed events, a future `iat`, a
  day-old token (accepted), an eight-day-old one (refused), and a past `exp`.
- `tests/oauth-security-events-endpoint.test.ts` (14 cases): the route with the database and
  configuration stubbed and verification real. Covers the acknowledgement path and what it applies,
  an unactionable event, a redelivery, media-type handling, the 400 error codes, the forced JWKS
  refresh, 503 when unconfigured or keyless, 500 when applying fails, and 405 on GET.
- `tests/oauth-security-event-migration.test.ts` (17 cases): the schema decisions, including that
  the SQL's three event-type constants are byte-identical to the verifier's.
- `tests/cross-app-config.test.ts` (9 cases): new, because the config refactor had no direct
  coverage before — only mocks.
- Full node project green, typecheck and lint clean.

---

#### Suggested Next Steps

1. Stage 2c: Sign in with Cubid and linking an existing account, which populates
   `cubid_oidc_subjects`. Nothing works end to end until it exists, and it is where the unlinked-
   subject gap above gets closed.
2. Register `security_events_uri` and `FUNDLOOP_CUBID_CLIENT_ID` on the Cubid side (operator work,
   Cubid staging is cubid-monorepo#179).
3. Stage 3's bearer validator still has to check all four things stage 2 recorded; the grant's
   `revoked_at` is what this receiver sets, so without check 3 none of this has any effect.

### session v2: Codex review on #279 — six findings, six fixes

- **Timestamp:** 2026-10-10T04:57:45Z
- **Agent:** Claude Code (Claude Opus 5)
- **Branch:** `feat/266-security-event-receiver` (PR #279)
- **Head before commit:** `313b754`

---

#### Objective

Address Codex's first pass on #279. All six were P2 and all six were real; two were security
correctness, not polish. Two of them also applied to code #273 already merged, which I fixed here
rather than leaving the same bug half-fixed.

---

#### What each finding was, and what it took

- **A forced JWKS refresh could not say whether it had actually refreshed.** Inside the 60-second
  floor, or after a failed fetch, `get({force: true})` returned the *previous* key set — which is
  indistinguishable from a conclusive "that kid does not exist". So a token signed by a key rotated
  in moments ago was answered with a terminal 400 `invalid_key` on the strength of a check we had
  not made. The cache now has `refresh()`, returning `refreshed` / `throttled` / `failed`, and both
  callers answer retryably when the check was inconclusive. The token endpoint from #273 had the
  identical bug and now answers `temporarily_unavailable` instead of `invalid_grant`.
- **A late revocation could revoke a grant the person had since re-authorized.** Delivery retries
  run for most of a day, so: withdraw, reconsent, redeem a fresh assertion, *then* the original
  event arrives and kills live, legitimate access. Fixed by recording
  `oauth_grants.last_assertion_issued_at` (the `iat` of the newest assertion redeemed, set
  monotonically by a replaced `oauth_redeem_grant`) and recording an older event as `superseded`.
  Both timestamps are Cubid's clock, so they compare with no skew margin; equal timestamps revoke.
  An `account-purged` event is deliberately exempt: a deleted account cannot consent again, and
  erring towards keeping access alive for one would be the wrong direction.
- **A known event type with an incomplete payload was acknowledged.** A signed
  `cross-app-consent-revoked` with no `requesting_client_id` names nobody to revoke; the SQL
  classified it `unknown_client` and the route answered 202, losing the revocation. It is now
  `malformed_event` → `invalid_request` → retried. Unimplemented types are still left alone,
  because their payload shapes are not ours to police.
- **RFC 8935 §2.3 requires `Content-Language` on a 400.** I checked the RFC text rather than taking
  it on faith: it is a MUST, alongside `application/json`. Added, with a fixed `en-US` since the
  descriptions are always English.
- **A revocation that arrived before its client was registered stayed unapplied.** Same shape as the
  unlinked-subject gap, but for clients: registration is an operator insert, and nothing consulted
  the stored events afterwards, so an assertion predating the withdrawal would have been honoured
  once the row existed. New `oauth_apply_pending_revocations_for_client(cubid_client_id)`, which
  registration now runs as its second step; it re-resolves the subject, applies the same ordering
  guard, and is safe to run again.
- **`.env.example` listed none of the cross-app variables.** #273 omitted all three and this PR
  added a fourth. All four are now in the tracked inventory, with a note on the two that are easy to
  confuse (`FUNDLOOP_CROSS_APP_AUDIENCE` is the resource audience; `FUNDLOOP_CUBID_CLIENT_ID` is our
  client id at Cubid).

---

#### Tests and Validation

- 24 new cases: throttled/failed/first-call `refresh()` outcomes, both endpoints answering retryably
  on an inconclusive key check, a conclusive refresh still refusing a genuinely unknown key, the
  malformed known-event payload at both the verifier and the route, `Content-Language` and
  `Content-Type` on a 400, and the SQL contract for the ordering guard and the catch-up function.
- One test asserts the catch-up function's output columns are named apart from the columns it reads.
  A `RETURNS TABLE` column becomes a plpgsql variable, so `subject` or `user_id` would have made
  every unqualified read of those columns ambiguous — and that fails at *execution*, not at
  `create function`, so CI's fresh-schema replay would not have caught it.
- 181 files, 1293 tests passing; typecheck and lint clean.

---

#### Reflections

Two of these were cases of a function that could not express its own uncertainty: the JWKS cache
returning keys when it meant "I could not check", and a grant that recorded when we acted but not
when the person last authorized. Both produced confident wrong answers rather than errors, which is
the failure mode worth hunting for in the rest of this feature.

---

#### Suggested Next Steps

1. HBIC's Claude deep review, then stage 2c per the design on #275.
2. When the bearer validator lands (stage 3), `last_assertion_issued_at` is also the field that
   would let it reason about authorization recency, if that ever becomes useful.
