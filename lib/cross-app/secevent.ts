// Verification of a Cubid Security Event Token (SET), for a resource app receiving one.
//
// RFC 8417 defines the token; RFC 8935 defines the push delivery that brings it here. Cubid signs a
// SET with the same RS256 key as its ID tokens and distinguishes it by `typ: secevent+jwt`, so the
// signature rules are shared with the assertion verifier in `jws.ts` and only the claim contract
// differs.
//
// Framework-free on purpose: Web Crypto, TextEncoder and an injected fetch only, so this file runs
// unchanged on Node, Deno and an edge runtime, and can be lifted into a shared kit for the other
// sibling apps. Nothing here reads configuration, touches a database or imports a framework.
//
// Contract: cubid-monorepo docs/engineering/oidc-cross-app-access.md, "Security Event Tokens".
//
// Every check fails closed and returns a reason rather than throwing, so the caller can audit the
// denial and answer in the RFC 8935 error vocabulary without a try/catch around the happy path.

import {
  asNumber,
  asString,
  audienceMatches,
  verifyCompactJws,
  type JsonObject,
  type JsonWebKeySet,
  type JwsDenial,
} from "./jws"

// RFC 8417 §2.3.
const SECEVENT_TYP = "secevent+jwt"

// The event types the contract sends. The URIs are the identifiers; nothing shorter is.
export const CROSS_APP_CONSENT_REVOKED_EVENT = "https://schemas.cubid.me/secevent/cross-app-consent-revoked"
export const CONSENT_REVOKED_EVENT = "https://schemas.cubid.me/secevent/consent-revoked"
export const ACCOUNT_PURGED_EVENT = "https://schemas.openid.net/secevent/risc/event-type/account-purged"

const DEFAULT_CLOCK_SKEW_SECONDS = 30
// Deliberately much wider than the past-side skew, and not the same number.
//
// Cubid re-signs every delivery attempt, so `iat` is always within seconds of the request arriving
// and a retry cannot fix a clock disagreement: if this host lags the issuer, *every* attempt looks
// future-dated, and after the five retries the revocation is lost. The cost of being generous here
// is nothing, because single use of `jti` is the replay control, not freshness. The cost of being
// strict is losing revocations on a host whose clock drifted by half a minute.
const DEFAULT_FUTURE_SKEW_SECONDS = 300
// A SET carries no `exp` (RFC 8417 §2.2 advises against one), so this is the only bound on how old
// a token may be. It is wide on purpose and is *not* a freshness check: `jti` single use is what
// makes a replay a no-op, and this only stops a captured token being replayable forever.
//
// It has to stay wide enough for the fix we have asked Cubid for. Today each attempt is re-signed,
// so a legitimate token is seconds old and an hour would do. If the contract moves to signing once
// at enqueue — which is what would make `toe` ordering meaningful — a legitimate retry becomes up
// to 12 hours old, and a tight bound would then reject exactly the deliveries that matter.
const DEFAULT_MAX_AGE_SECONDS = 7 * 24 * 60 * 60

export type SecurityEvent = {
  /** The event type URI, as it appeared as a key of `events`. */
  type: string
  /** That event's own claims object. Shapes differ per type, so the caller reads what it needs. */
  claims: JsonObject
}

export type SecurityEventTokenClaims = {
  iss: string
  aud: string
  jti: string
  /** When the issuer signed *this delivery attempt*. Cubid re-signs every retry, so it is not when
   *  the event happened and must never be used to order the event against anything. */
  iat: number
  /**
   * RFC 8417 §2.2 `toe`, "time of event": when the thing the token reports actually happened.
   * Optional in the standard, and Cubid does not send it yet (cubid-monorepo
   * `packages/auth/src/securityEvents.ts` builds `iat` only), so this is normally undefined and
   * the receiver has nothing to order a late delivery by. See `docs/engineering/
   * cubid-cross-app-access.md`, "Ordering a late revocation".
   */
  timeOfEvent?: number
  /** This app's own Cubid pairwise subject for the person the event is about. */
  subject: string
  events: SecurityEvent[]
}

export type SecurityEventDenial =
  | JwsDenial
  | "wrong_issuer"
  | "wrong_audience"
  | "missing_claim"
  | "malformed_subject"
  | "subject_mismatch"
  | "no_events"
  | "malformed_event"
  | "malformed_event_time"
  | "expired"
  | "not_yet_valid"
  | "too_old"

export type SecurityEventResult =
  | { ok: true; claims: SecurityEventTokenClaims; keyId: string }
  | { ok: false; reason: SecurityEventDenial; detail?: string }

export type VerifySecurityEventTokenOptions = {
  jwks: JsonWebKeySet
  /** The Cubid issuer URL, compared exactly. */
  issuer: string
  /**
   * This app's **client id at Cubid**. A SET is addressed to the client, not to the resource
   * audience an assertion carries, so this is deliberately a different value from the one
   * `verifyIdJag` checks.
   */
  audience: string
  now?: Date
  /** Tolerance for a token dated in the past. */
  clockSkewSeconds?: number
  /** Tolerance for a token dated in the future, which is usually this host's clock being wrong. */
  futureSkewSeconds?: number
  maxAgeSeconds?: number
}

// RFC 8417 §1.2 and RFC 8485: a subject identifier is a typed object, and the only format the
// contract sends is `iss_sub`. An unrecognised format is refused rather than guessed at, because
// reading the wrong field would attribute an event to the wrong person.
function readIssSubSubject(value: unknown, issuer: string): { sub: string } | { error: SecurityEventDenial; detail?: string } {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { error: "malformed_subject", detail: "sub_id is not an object" }
  }
  const record = value as JsonObject
  if (record.format !== "iss_sub") return { error: "malformed_subject", detail: String(record.format ?? "absent") }
  // The subject is pairwise *per issuer*, so a subject claiming another issuer identifies nobody
  // here and must not be matched against our mapping table.
  if (asString(record.iss) !== issuer) return { error: "malformed_subject", detail: "subject issuer does not match" }
  const sub = asString(record.sub)
  if (!sub) return { error: "malformed_subject", detail: "no sub" }
  return { sub }
}

export async function verifySecurityEventToken(
  token: string,
  options: VerifySecurityEventTokenOptions,
): Promise<SecurityEventResult> {
  const verified = await verifyCompactJws(token, { jwks: options.jwks, typ: SECEVENT_TYP })
  if (!verified.ok) return verified
  const { payload, keyId } = verified

  const iss = asString(payload.iss)
  const jti = asString(payload.jti)
  const iat = asNumber(payload.iat)
  if (!iss || !jti || iat === null) {
    return { ok: false, reason: "missing_claim", detail: "iss, aud, jti, iat, sub_id and events are all required" }
  }

  if (iss !== options.issuer) return { ok: false, reason: "wrong_issuer", detail: iss }
  if (!audienceMatches(payload.aud, options.audience)) return { ok: false, reason: "wrong_audience" }

  const nowSeconds = Math.floor((options.now ?? new Date()).getTime() / 1000)
  const skew = options.clockSkewSeconds ?? DEFAULT_CLOCK_SKEW_SECONDS
  const futureSkew = options.futureSkewSeconds ?? DEFAULT_FUTURE_SKEW_SECONDS
  if (iat - futureSkew > nowSeconds) return { ok: false, reason: "not_yet_valid" }
  if (nowSeconds - iat > (options.maxAgeSeconds ?? DEFAULT_MAX_AGE_SECONDS)) {
    return { ok: false, reason: "too_old", detail: String(nowSeconds - iat) }
  }
  // The contract sends no `exp`, but one that is present and past is a refusal rather than
  // something to ignore: the transmitter said when the token stops being valid.
  const exp = asNumber(payload.exp)
  if (exp !== null && exp + skew <= nowSeconds) return { ok: false, reason: "expired" }

  // `toe` is optional, so absent is fine — but present and unusable is not, because the receiver
  // would otherwise fall back to "unordered" on a claim the issuer meant to be read.
  let timeOfEvent: number | undefined
  if (payload.toe !== undefined) {
    const toe = asNumber(payload.toe)
    if (toe === null) return { ok: false, reason: "malformed_event_time", detail: "toe is not a number" }
    // An event cannot have happened after the token reporting it was signed, beyond clock slop.
    if (toe - skew > iat) return { ok: false, reason: "malformed_event_time", detail: "toe is after iat" }
    timeOfEvent = toe
  }

  const subject = readIssSubSubject(payload.sub_id, options.issuer)
  if ("error" in subject) return { ok: false, reason: subject.error, detail: subject.detail }

  if (!payload.events || typeof payload.events !== "object" || Array.isArray(payload.events)) {
    return { ok: false, reason: "missing_claim", detail: "events is not an object" }
  }
  const events: SecurityEvent[] = []
  for (const [type, claims] of Object.entries(payload.events as JsonObject)) {
    // RFC 8417 §2.2: each value is a JSON object, which may legitimately be empty.
    if (!claims || typeof claims !== "object" || Array.isArray(claims)) {
      return { ok: false, reason: "missing_claim", detail: `event ${type} is not an object` }
    }
    const eventClaims = claims as JsonObject
    // The contract repeats the subject inside the event. Where it does, it must be the same person:
    // a token whose two subjects disagree is ambiguous, and acting on either would be a guess.
    if (eventClaims.subject !== undefined) {
      const eventSubject = readIssSubSubject(eventClaims.subject, options.issuer)
      if ("error" in eventSubject) return { ok: false, reason: eventSubject.error, detail: eventSubject.detail }
      if (eventSubject.sub !== subject.sub) return { ok: false, reason: "subject_mismatch", detail: type }
    }
    // An event of a type we know has a payload shape the contract defines, and a delivery that
    // does not conform to it is malformed — not a valid event there happens to be nothing to do
    // about. Acknowledging one would lose the revocation it was meant to carry, so it is refused
    // and retried instead. Types we do not implement are left alone: we do not know their shapes.
    if (type === CROSS_APP_CONSENT_REVOKED_EVENT && asString(eventClaims.requesting_client_id) === null) {
      return { ok: false, reason: "malformed_event", detail: `${type} without requesting_client_id` }
    }

    events.push({ type, claims: eventClaims })
  }
  // An event-less SET says nothing. Acknowledging one would hide a transmitter bug; refusing it
  // makes the delivery retry and then fail visibly at Cubid.
  if (events.length === 0) return { ok: false, reason: "no_events" }

  return { ok: true, keyId, claims: { iss, aud: options.audience, jti, iat, timeOfEvent, subject: subject.sub, events } }
}

/** The requesting client's id *at Cubid*, from a `cross-app-consent-revoked` event. */
export function readRequestingClientId(event: SecurityEvent): string | null {
  return asString(event.claims.requesting_client_id)
}

/** Why the consent ended, as the contract's `reason` vocabulary. Advisory: it gates nothing. */
export function readEventReason(event: SecurityEvent): string | null {
  return asString(event.claims.reason)
}
