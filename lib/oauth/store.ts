import "server-only"

import { getAdminSupabaseClient } from "@/lib/supabase-admin"
import { OAUTH_TTL_SECONDS, constantTimeEquals, expiresAt, randomToken, sha256Hex } from "./crypto"
import { sortScopes, type OAuthScope } from "./scopes"

// Database access for redeeming a Cubid identity assertion (#266 stage 2).
//
// These tables are credentials, so they are service-role only and never reachable from a browser.
// Replay protection is the database's job: redeeming records the assertion's jti, and a second
// redemption violates the primary key rather than racing a read.
//
// types/supabase.ts predates these tables; regenerate it against the migration and drop the cast
// below (`supabase gen types typescript`). The row types here mirror the migration exactly.

export type RequestingClientRecord = {
  client_id: string
  cubid_client_id: string
  client_secret_sha256: string
  name: string
  allowed_scopes: OAuthScope[]
  is_sandbox: boolean
  disabled_at: string | null
}

type MinimalQuery = {
  select: (columns: string) => MinimalQuery
  eq: (column: string, value: unknown) => MinimalQuery
  is: (column: string, value: unknown) => MinimalQuery
  insert: (values: Record<string, unknown>) => MinimalQuery
  update: (values: Record<string, unknown>) => MinimalQuery
  limit: (count: number) => MinimalQuery
  maybeSingle: () => PromiseLike<{ data: unknown; error: { message: string; code?: string } | null }>
  then: <T>(resolve: (value: { data: unknown; error: { message: string; code?: string } | null }) => T) => PromiseLike<T>
}

function oauthDb() {
  return getAdminSupabaseClient() as unknown as { from: (table: string) => MinimalQuery }
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
  return (data as RequestingClientRecord | null) ?? null
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
  return (data as { user_id: string } | null)?.user_id ?? null
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

async function upsertGrant(input: { clientId: string; userId: string; scopes: OAuthScope[] }): Promise<number> {
  const scopes = sortScopes(input.scopes)
  const existing = await oauthDb()
    .from("oauth_grants")
    .select("id")
    .eq("client_id", input.clientId)
    .eq("user_id", input.userId)
    .limit(1)
    .maybeSingle()
  fail("read-grant", existing.error)

  const current = existing.data as { id: number } | null
  if (current) {
    // A fresh assertion means consent is live at Cubid right now, so a locally revoked grant is
    // revived deliberately: Cubid is the authority on consent, not this row.
    const updated = await oauthDb()
      .from("oauth_grants")
      .update({ scopes, revoked_at: null, updated_at: new Date().toISOString() })
      .eq("id", current.id)
      .select("id")
      .maybeSingle()
    fail("update-grant", updated.error)
    return current.id
  }

  const inserted = await oauthDb()
    .from("oauth_grants")
    .insert({ client_id: input.clientId, user_id: input.userId, scopes })
    .select("id")
    .maybeSingle()
  fail("insert-grant", inserted.error)
  return (inserted.data as { id: number }).id
}

export async function issueAccessToken(input: {
  clientId: string
  userId: string
  scopes: OAuthScope[]
  assertionJti: string
}): Promise<{ accessToken: string; expiresIn: number }> {
  const grantId = await upsertGrant({ clientId: input.clientId, userId: input.userId, scopes: input.scopes })
  const accessToken = randomToken()
  const { error } = await oauthDb().from("oauth_tokens").insert({
    token_sha256: sha256Hex(accessToken),
    token_type: "access",
    client_id: input.clientId,
    user_id: input.userId,
    grant_id: grantId,
    scopes: sortScopes(input.scopes),
    issued_from_assertion_jti: input.assertionJti,
    expires_at: expiresAt(OAUTH_TTL_SECONDS.accessToken),
  })
  fail("insert-token", error)
  return { accessToken, expiresIn: OAUTH_TTL_SECONDS.accessToken }
}

// Used by the revocation endpoint and, next, by the Security Event Token receiver.
export async function revokeTokensForGrant(clientId: string, userId: string): Promise<void> {
  const now = new Date().toISOString()
  const tokens = await oauthDb()
    .from("oauth_tokens")
    .update({ revoked_at: now })
    .eq("client_id", clientId)
    .eq("user_id", userId)
    .is("revoked_at", null)
  fail("revoke-tokens", tokens.error)

  const grant = await oauthDb()
    .from("oauth_grants")
    .update({ revoked_at: now, updated_at: now })
    .eq("client_id", clientId)
    .eq("user_id", userId)
    .is("revoked_at", null)
  fail("revoke-grant", grant.error)
}

export async function revokeByToken(token: string): Promise<void> {
  const { data, error } = await oauthDb()
    .from("oauth_tokens")
    .select("client_id, user_id")
    .eq("token_sha256", sha256Hex(token))
    .limit(1)
    .maybeSingle()
  fail("revoke-lookup", error)
  const record = data as { client_id: string; user_id: string } | null
  // RFC 7009 §2.2: an unknown token is not an error, so this cannot be used to test for one.
  if (!record) return
  await revokeTokensForGrant(record.client_id, record.user_id)
}
