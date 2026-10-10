import { crossAppReceiverConfig, cubidJwksCache } from "@/lib/cross-app/config"
import { verifySecurityEventToken, type SecurityEventDenial } from "@/lib/cross-app/secevent"
import { applySecurityEvent } from "@/lib/oauth/store"

// POST /oauth/security-events — receives a Cubid Security Event Token (#266 stage 2b).
//
// RFC 8417 defines the token, RFC 8935 the push delivery. Registered at Cubid as this client's
// `security_events_uri`, which is why the path is stable and must stay so.
//
// There is no client authentication on this endpoint and there is not meant to be: the contract
// authenticates the *token*, not the connection, so the signature over the issuer's key is the only
// thing that makes a request credible. Nothing here acts before that signature verifies, and a
// request that fails verification changes nothing and reveals nothing about who exists.
//
// Contract: cubid-monorepo docs/engineering/oidc-cross-app-access.md, "Security Event Tokens".
export const dynamic = "force-dynamic"

const SECEVENT_CONTENT_TYPE = "application/secevent+jwt"

// RFC 8935 §2.4 defines the error codes a receiver may answer with, and nothing wider. A denial
// that does not map onto one is reported as invalid_request rather than invented.
const ERROR_CODE_BY_DENIAL: Record<SecurityEventDenial, string> = {
  malformed: "invalid_request",
  wrong_type: "invalid_request",
  missing_claim: "invalid_request",
  malformed_subject: "invalid_request",
  subject_mismatch: "invalid_request",
  no_events: "invalid_request",
  expired: "invalid_request",
  not_yet_valid: "invalid_request",
  too_old: "invalid_request",
  unsupported_algorithm: "invalid_key",
  unknown_key: "invalid_key",
  bad_signature: "invalid_key",
  unsupported_critical_header: "invalid_key",
  wrong_issuer: "invalid_issuer",
  wrong_audience: "invalid_audience",
}

// RFC 8935 §2.3: a failure is a 400 carrying `err` and `description`.
function setError(err: string, description: string, options?: { status?: number; headers?: Record<string, string> }) {
  return Response.json({ err, description }, {
    status: options?.status ?? 400,
    headers: { "Cache-Control": "no-store", ...options?.headers },
  })
}

// Our own unavailability is not the transmitter's error, so it is a 5xx: the delivery stays pending
// at Cubid and is retried, rather than being acknowledged or marked failed.
function unavailable(description: string) {
  return Response.json({ description }, { status: 503, headers: { "Cache-Control": "no-store" } })
}

export async function POST(request: Request) {
  try {
    return await receive(request)
  } catch (error) {
    // A 5xx is the honest answer to an unhandled failure: the event has not been applied, and
    // acknowledging it would lose the revocation for good.
    console.error(`[oauth/security-events] delivery failed: ${error instanceof Error ? error.message : "unknown"}`)
    return Response.json({ description: "The event could not be processed. Please retry." }, {
      status: 500,
      headers: { "Cache-Control": "no-store" },
    })
  }
}

async function receive(request: Request) {
  // RFC 8935 §2.1 fixes the media type. Parameters such as a charset are tolerated; a different
  // type means this is not a SET delivery and nothing here would know how to read it.
  const contentType = request.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase()
  if (contentType !== SECEVENT_CONTENT_TYPE) {
    return setError("invalid_request", `The request body must be ${SECEVENT_CONTENT_TYPE}.`)
  }

  const token = (await request.text()).trim()
  if (!token) return setError("invalid_request", "The request body must be a Security Event Token.")

  const config = crossAppReceiverConfig()
  // Unconfigured means there is no issuer to verify against and no audience this token could be
  // addressed to, so there is nothing safe to do with it.
  if (!config) return unavailable("Cross-app access is not configured on this deployment.")

  const jwks = await cubidJwksCache(config).get()
  if (!jwks) return unavailable("The issuer's signing keys are unavailable.")

  const options = { jwks, issuer: config.issuer, audience: config.clientId }
  let verified = await verifySecurityEventToken(token, options)

  // An unknown key is the one denial worth retrying: it is what a key rotation looks like. The
  // cache's own refresh floor stops this from becoming a request amplifier aimed at Cubid.
  if (!verified.ok && verified.reason === "unknown_key") {
    const refreshed = await cubidJwksCache(config).get({ force: true })
    if (refreshed) verified = await verifySecurityEventToken(token, { ...options, jwks: refreshed })
  }

  if (!verified.ok) {
    console.warn(`[oauth/security-events] refused: ${verified.reason}${verified.detail ? ` (${verified.detail})` : ""}`)
    return setError(ERROR_CODE_BY_DENIAL[verified.reason], "The Security Event Token was not accepted.")
  }

  const { claims } = verified
  const outcomes = await applySecurityEvent({
    jti: claims.jti,
    issuer: claims.iss,
    audience: claims.aud,
    subject: claims.subject,
    issuedAt: new Date(claims.iat * 1000),
    // Only the verified shape is passed on: the events the verifier returned, keyed by type.
    events: Object.fromEntries(claims.events.map((event) => [event.type, event.claims])),
  })

  // Every outcome is an acknowledgement, including "nothing to do". An unmapped subject, an unknown
  // requesting client and an event type we do not implement would never start working on a retry,
  // and leaving them pending would end with the event marked failed at Cubid while FundLoop had in
  // fact decided what to do. The row records which it was.
  console.info(
    `[oauth/security-events] applied ${claims.jti}: ${outcomes.map((outcome) => `${outcome.eventType ?? "-"}=${outcome.outcome}`).join(", ") || "no outcome"}`,
  )

  // RFC 8935 §2.2: an accepted SET is answered with 202 and no body.
  return new Response(null, { status: 202, headers: { "Cache-Control": "no-store" } })
}

export async function GET() {
  return setError("invalid_request", "The security event endpoint accepts POST only.", {
    status: 405,
    headers: { Allow: "POST" },
  })
}
