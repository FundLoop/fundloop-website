import "server-only"

import { getAdminSupabaseClient } from "@/lib/supabase-admin"
import { OAUTH_TTL_SECONDS, constantTimeEquals, expiresAt, hasExpired, randomToken, sha256Hex } from "./crypto"
import { sortScopes, type OAuthScope } from "./scopes"

// Database access for redeeming a Cubid identity assertion (#266 stage 2).
//
// These tables are credentials, so they are service-role only and never reachable from a browser.
// Replay protection is the database's job: redeeming records the assertion's jti, and a second
// redemption violates the primary key rather than racing a read.
//
// The tables are declared in types/supabase.ts, so every query here is checked against the schema:
// a renamed column or a changed payload shape fails typechecking rather than at runtime.

export type RequestingClientRecord = {
  client_id: string
  cubid_client_id: string
  client_secret_sha256: string
  name: string
  allowed_scopes: OAuthScope[]
  is_sandbox: boolean
  disabled_at: string | null
}

function oauthDb() {
  return getAdminSupabaseClient()
}

function fail(scope: string, error: { message: string } | null) {
  if (error) throw new Error(`oauth-store:${scope}: ${error.message}`)
}

// Postgres unique-violation. A redemption that hits this is a replay, not an outage.
const UNIQUE_VIOLATION = "23505"

export async function findRequestingClient(clientId: string): Promise<RequestingClientRecord | null> {
  const { data, error } = await oauthDb()
    .from("oauth_clients")
    .select("client_id, cubid_client_id, client_secret_sha256, name, allowed_scopes, is_sandbox, disabled_at")
    .eq("client_id", clientId)
    .is("disabled_at", null)
    .limit(1)
    .maybeSingle()
  fail("find-client", error)
  return data ?? null
}

export function authenticateClient(client: RequestingClientRecord, presentedSecret: string | null): boolean {
  if (!presentedSecret) return false
  return constantTimeEquals(sha256Hex(presentedSecret), client.client_secret_sha256)
}

// The pairwise subject is the only identifier an assertion carries, so an unmapped subject is a
// denial rather than an account creation: FundLoop must never invent a user from an assertion.
export async function findUserForCubidSubject(issuer: string, subject: string): Promise<string | null> {
  const { data, error } = await oauthDb()
    .from("cubid_oidc_subjects")
    .select("user_id")
    .eq("issuer", issuer)
    .eq("subject", subject)
    .limit(1)
    .maybeSingle()
  fail("find-subject", error)
  return data?.user_id ?? null
}

export async function noteSubjectSeen(issuer: string, subject: string): Promise<void> {
  const { error } = await oauthDb()
    .from("cubid_oidc_subjects")
    .update({ last_seen_at: new Date().toISOString() })
    .eq("issuer", issuer)
    .eq("subject", subject)
  fail("note-subject", error)
}

// The insert is the replay check.
export async function recordAssertionJti(input: {
  jti: string
  issuer: string
  clientId: string
  subject: string
  expiresAt: string
}): Promise<{ ok: true } | { ok: false; reason: "replayed" }> {
  const { error } = await oauthDb().from("oauth_assertion_jtis").insert({
    jti: input.jti,
    issuer: input.issuer,
    client_id: input.clientId,
    subject: input.subject,
    expires_at: input.expiresAt,
  })
  if (error?.code === UNIQUE_VIOLATION) return { ok: false, reason: "replayed" }
  fail("record-jti", error)
  return { ok: true }
}

// One statement decides the grant's fate *and* writes the token, under one lock. The insert cannot
// live out here: two concurrent redemptions could interleave so that a wider token lands after a
// narrower redemption's supersession, leaving a live token wider than the grant recording it.
export async function issueAccessToken(input: {
  clientId: string
  userId: string
  // What the assertion carried. Under the Cubid contract this is what the client requested for this
  // exchange, bounded by the pairing — it is not the person's standing consent, so a smaller value
  // here never means consent narrowed.
  assertionScopes: OAuthScope[]
  // What this token carries, which the client may have narrowed for itself.
  scopes: OAuthScope[]
  assertionJti: string
  assertionIssuedAt: Date
}): Promise<{ ok: true; accessToken: string; expiresIn: number } | { ok: false; reason: "withdrawn" }> {
  const accessToken = randomToken()
  const { data, error } = await oauthDb().rpc("oauth_redeem_grant", {
    p_client_id: input.clientId,
    p_user_id: input.userId,
    p_assertion_scopes: sortScopes(input.assertionScopes),
    p_assertion_issued_at: input.assertionIssuedAt.toISOString(),
    p_token_sha256: sha256Hex(accessToken),
    p_token_scopes: sortScopes(input.scopes),
    p_token_expires_at: expiresAt(OAUTH_TTL_SECONDS.accessToken),
    p_assertion_jti: input.assertionJti,
  })
  fail("redeem-grant", error)
  const row = data?.[0]
  if (!row) throw new Error("oauth-store:redeem-grant: no outcome returned")
  if (row.outcome === "withdrawn") return { ok: false, reason: "withdrawn" }
  return { ok: true, accessToken, expiresIn: OAUTH_TTL_SECONDS.accessToken }
}

// Used by the revocation endpoint and, next, by the Security Event Token receiver.
//
// One locked statement, and it records the withdrawal even when no grant row exists: otherwise a
// revocation for a person who never redeemed here wrote nothing, and a later assertion minted
// *before* that withdrawal would create a fresh grant and be honoured.
export async function revokeTokensForGrant(clientId: string, userId: string): Promise<void> {
  const { error } = await oauthDb().rpc("oauth_revoke_grant", { p_client_id: clientId, p_user_id: userId })
  fail("revoke-grant", error)
}

export async function revokeByToken(token: string, clientId: string): Promise<void> {
  const { data, error } = await oauthDb()
    .from("oauth_tokens")
    .select("client_id, user_id, revoked_at, expires_at")
    .eq("token_sha256", sha256Hex(token))
    .eq("client_id", clientId)
    .is("revoked_at", null)
    .limit(1)
    .maybeSingle()
  fail("revoke-lookup", error)
  const record = data
  // RFC 7009 §2.2: an unknown token is not an error, so this cannot be used to test for one. A
  // token belonging to another client, or one already revoked, reaches here as null and is treated
  // the same way — otherwise a client holding a long-dead token could disconnect a person's current
  // connection, or probe for another client's tokens.
  if (!record || hasExpired(record.expires_at)) return
  await revokeTokensForGrant(record.client_id, record.user_id)
}
