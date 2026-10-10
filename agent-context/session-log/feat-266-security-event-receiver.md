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
