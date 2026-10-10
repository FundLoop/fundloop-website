import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest"
import type { JsonWebKeySet } from "@/lib/cross-app/jws"

// Sign in with Cubid, and linking an existing account (#275, stage 2c).
//
// The ID tokens here are really signed by a locally generated key and checked by the real verifier,
// because Cubid is not deployed yet (cubid-monorepo#179 is the staging rollout). Only the database,
// the token endpoint and the session bridge are stubbed.

const ISSUER = "https://id.cubid.test"
const CLIENT_ID = "cubid_fundloop"
const SUBJECT = "pairwise-subject-for-fundloop"
const NONCE = "nonce-from-the-cookie"
const KID = "test-key-1"
const USER_ID = "11111111-1111-4111-8111-111111111111"

let privateKey: CryptoKey
let jwks: JsonWebKeySet

const jwksGet = vi.fn()
const jwksRefresh = vi.fn()
const config = {
  crossAppSignInConfig: vi.fn(),
  cubidJwksCache: vi.fn(() => ({ get: jwksGet, refresh: jwksRefresh })),
}

const subjects = { maybeSingle: vi.fn() }
const subjectUpdate = vi.fn()
const rpc = vi.fn()
const createUser = vi.fn()
const getUserById = vi.fn()
const deleteUser = vi.fn()

const profileDelete = vi.fn()

const admin = {
  from: vi.fn((table: string) => ({
    select: () => ({ eq: () => ({ eq: () => ({ limit: () => ({ maybeSingle: subjects.maybeSingle }) }) }) }),
    update: () => ({ eq: subjectUpdate }),
    delete: () => ({ eq: (column: string, value: string) => profileDelete({ table, column, value }) }),
  })),
  rpc,
  auth: { admin: { createUser, getUserById, deleteUser } },
}

vi.mock("@/lib/cross-app/config", () => config)
vi.mock("@/lib/supabase-admin", () => ({ getAdminSupabaseClient: () => admin }))

const flow = async () => (await import("@/lib/auth/cubid-sign-in")).completeCubidSignIn

function toBase64Url(bytes: Uint8Array) {
  let binary = ""
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
}

async function signIdToken(overrides: Record<string, unknown> = {}, headerOverrides: Record<string, unknown> = {}) {
  const issuedAt = Math.floor(Date.now() / 1000)
  const header = { alg: "RS256", kid: KID, typ: "JWT", ...headerOverrides }
  const payload = {
    iss: ISSUER,
    sub: SUBJECT,
    aud: CLIENT_ID,
    iat: issuedAt,
    exp: issuedAt + 900,
    nonce: NONCE,
    email: "person@example.com",
    ...overrides,
  }
  const encode = (value: Record<string, unknown>) => toBase64Url(new TextEncoder().encode(JSON.stringify(value)))
  const signingInput = `${encode(header)}.${encode(payload)}`
  const signature = await crypto.subtle.sign({ name: "RSASSA-PKCS1-v1_5" }, privateKey, new TextEncoder().encode(signingInput))
  return `${signingInput}.${toBase64Url(new Uint8Array(signature))}`
}

function tokenEndpoint(idToken: string | null, status = 200) {
  return vi.fn(async () =>
    idToken === null
      ? new Response(JSON.stringify({ error: "invalid_grant" }), { status })
      : new Response(JSON.stringify({ id_token: idToken, token_type: "Bearer" }), { status }),
  ) as unknown as typeof fetch
}

const establishSession = vi.fn()

async function run(
  idToken: string | null,
  options: { intent?: "sign_in" | "link"; currentUserId?: string | null; fetchImpl?: typeof fetch } = {},
) {
  const complete = await flow()
  return complete(
    { code: "authorization-code", codeVerifier: "verifier", nonce: NONCE, intent: options.intent ?? "sign_in" },
    {
      establishSession,
      currentUserId: options.currentUserId ?? null,
      fetchImpl: options.fetchImpl ?? tokenEndpoint(idToken),
    },
  )
}

beforeAll(async () => {
  const pair = await crypto.subtle.generateKey(
    { name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" },
    true,
    ["sign", "verify"],
  )
  privateKey = pair.privateKey
  const exported = (await crypto.subtle.exportKey("jwk", pair.publicKey)) as { kty: string; n: string; e: string }
  jwks = { keys: [{ kty: exported.kty, n: exported.n, e: exported.e, kid: KID, alg: "RS256", use: "sig" }] }
}, 30_000)

beforeEach(() => {
  vi.resetModules()
  for (const fn of [subjects.maybeSingle, subjectUpdate, profileDelete, rpc, createUser, getUserById, deleteUser, establishSession, jwksGet, jwksRefresh]) {
    fn.mockReset()
  }
  config.crossAppSignInConfig.mockReset()
  vi.spyOn(console, "warn").mockImplementation(() => {})
  vi.spyOn(console, "error").mockImplementation(() => {})

  config.crossAppSignInConfig.mockReturnValue({
    issuer: ISSUER,
    jwksUri: `${ISSUER}/jwks`,
    clientId: CLIENT_ID,
    clientSecret: "s3cret",
    redirectUri: "https://www.fundloop.org/auth/cubid/callback",
    authorizationEndpoint: `${ISSUER}/authorize`,
    tokenEndpoint: `${ISSUER}/token`,
  })
  jwksGet.mockResolvedValue(jwks)
  jwksRefresh.mockResolvedValue({ outcome: "failed" })
  subjects.maybeSingle.mockResolvedValue({ data: null, error: null })
  subjectUpdate.mockResolvedValue({ error: null })
  establishSession.mockResolvedValue({ ok: true })
  rpc.mockResolvedValue({ data: [{ outcome: "linked", revoked_clients: 0 }], error: null })
  createUser.mockResolvedValue({ data: { user: { id: USER_ID } }, error: null })
  getUserById.mockResolvedValue({ data: { user: { id: USER_ID, email: "person@example.com" } }, error: null })
  deleteUser.mockResolvedValue({ data: { user: null }, error: null })
  profileDelete.mockResolvedValue({ error: null })
})

describe("signing in with a subject this deployment already knows", () => {
  it("establishes a session for the mapped account and nothing else", async () => {
    subjects.maybeSingle.mockResolvedValue({ data: { user_id: USER_ID }, error: null })
    const outcome = await run(await signIdToken())

    expect(outcome).toEqual({ kind: "signed_in", userId: USER_ID, created: false, revokedClients: 0 })
    expect(createUser).not.toHaveBeenCalled()
    expect(rpc).not.toHaveBeenCalled()
    // The address is how the admin API addresses an account; the identity that was resolved is a
    // user id, and the bridge is given both so the session it establishes can be checked.
    expect(establishSession).toHaveBeenCalledWith({ email: "person@example.com", expectedUserId: USER_ID })
  })

  it("refuses when the mapped account has no address to bridge a session with", async () => {
    subjects.maybeSingle.mockResolvedValue({ data: { user_id: USER_ID }, error: null })
    getUserById.mockResolvedValue({ data: { user: { id: USER_ID, email: null } }, error: null })

    expect(await run(await signIdToken())).toMatchObject({ kind: "refused", reason: "account_without_email" })
    expect(establishSession).not.toHaveBeenCalled()
  })
})

describe("signing in with a subject nobody has linked", () => {
  it("creates the account, links the subject, and signs in", async () => {
    const outcome = await run(await signIdToken())

    expect(outcome).toEqual({ kind: "signed_in", userId: USER_ID, created: true, revokedClients: 0 })
    expect(createUser).toHaveBeenCalledWith(expect.objectContaining({ email: "person@example.com", email_confirm: true }))
    expect(rpc).toHaveBeenCalledWith("link_cubid_subject", {
      p_issuer: ISSUER,
      p_subject: SUBJECT,
      p_user_id: USER_ID,
    })
  })

  it("refuses to touch an account that already holds the address", async () => {
    // Acceptance 3 on #275: holding an address is not proof of controlling the account, so this is
    // the case that must never become a silent merge.
    createUser.mockResolvedValue({ data: { user: null }, error: { code: "email_exists", message: "already registered" } })

    expect(await run(await signIdToken())).toEqual({ kind: "email_taken", email: "person@example.com" })
    expect(rpc).not.toHaveBeenCalled()
    expect(establishSession).not.toHaveBeenCalled()
  })

  it("refuses when Cubid released no verified address, rather than inventing one", async () => {
    expect(await run(await signIdToken({ email: undefined }))).toEqual({ kind: "no_email" })
    expect(createUser).not.toHaveBeenCalled()
  })

  it("applies a revocation that arrived before the link, which is criterion 7", async () => {
    rpc.mockResolvedValue({ data: [{ outcome: "linked", revoked_clients: 2 }], error: null })
    expect(await run(await signIdToken())).toMatchObject({ kind: "signed_in", revokedClients: 2 })
  })

  it("removes the account it just created when the subject cannot be linked to it", async () => {
    rpc.mockResolvedValue({ data: [{ outcome: "subject_claimed", revoked_clients: 0 }], error: null })

    expect(await run(await signIdToken())).toEqual({ kind: "conflict", reason: "subject_claimed" })
    // Otherwise an account nobody can reach is left behind: no session, and nothing pointing at it.
    expect(deleteUser).toHaveBeenCalledWith(USER_ID)
    expect(establishSession).not.toHaveBeenCalled()

    // The profile row has to go first. `on_auth_user_created` creates one for every new account and
    // `users_user_id_fkey` has no ON DELETE, so deleting the account first fails on the constraint
    // and the address stays taken — the cleanup would never have worked.
    expect(profileDelete).toHaveBeenCalledWith({ table: "users", column: "user_id", value: USER_ID })
    expect(profileDelete.mock.invocationCallOrder[0]).toBeLessThan(deleteUser.mock.invocationCallOrder[0])
  })

  it("removes the created account when linking fails outright, not only when it refuses", async () => {
    // A transient database failure would otherwise leave the address taken by an account nobody
    // can reach, and the person's next attempt would be told the email is in use.
    rpc.mockRejectedValue(new Error("deadlock detected"))

    await expect(run(await signIdToken())).rejects.toThrow("deadlock detected")
    expect(deleteUser).toHaveBeenCalledWith(USER_ID)
  })

  it("refuses a subject a purge event has already been received for", async () => {
    rpc.mockResolvedValue({ data: [{ outcome: "purged_subject", revoked_clients: 0 }], error: null })
    expect(await run(await signIdToken())).toEqual({ kind: "purged_subject" })
    expect(deleteUser).toHaveBeenCalledWith(USER_ID)
  })
})

describe("linking from account settings", () => {
  it("maps the subject to the signed-in person without touching their session", async () => {
    const outcome = await run(await signIdToken(), { intent: "link", currentUserId: USER_ID })

    expect(outcome).toEqual({ kind: "linked", userId: USER_ID, revokedClients: 0 })
    expect(createUser).not.toHaveBeenCalled()
    expect(establishSession).not.toHaveBeenCalled()
  })

  it("refuses to link when nobody is signed in", async () => {
    // Control of the FundLoop account is proven by holding its session. Picking one by email here
    // would reintroduce the merge the sign-in path refuses.
    expect(await run(await signIdToken(), { intent: "link", currentUserId: null })).toMatchObject({
      kind: "refused",
      reason: "not_signed_in",
    })
    expect(rpc).not.toHaveBeenCalled()
  })

  it("is idempotent when the subject is already this person's", async () => {
    subjects.maybeSingle.mockResolvedValue({ data: { user_id: USER_ID }, error: null })
    expect(await run(await signIdToken(), { intent: "link", currentUserId: USER_ID })).toEqual({
      kind: "already_linked",
      userId: USER_ID,
    })
  })

  it("refuses when the subject belongs to another account", async () => {
    subjects.maybeSingle.mockResolvedValue({ data: { user_id: "22222222-2222-4222-8222-222222222222" }, error: null })
    expect(await run(await signIdToken(), { intent: "link", currentUserId: USER_ID })).toEqual({
      kind: "conflict",
      reason: "subject_claimed",
    })
    expect(establishSession).not.toHaveBeenCalled()
  })
})

describe("what it refuses before touching an account", () => {
  it("refuses an ID token for another audience", async () => {
    expect(await run(await signIdToken({ aud: "cubid_chaincrew" }))).toMatchObject({ kind: "refused", reason: "wrong_audience" })
    expect(createUser).not.toHaveBeenCalled()
  })

  it("refuses an ID token whose nonce is not the one this browser sent", async () => {
    expect(await run(await signIdToken({ nonce: "somebody-elses-nonce" }))).toMatchObject({
      kind: "refused",
      reason: "nonce_mismatch",
    })
  })

  it("refuses an identity assertion presented as an ID token", async () => {
    const assertion = await signIdToken({}, { typ: "oauth-id-jag+jwt" })
    expect(await run(assertion)).toMatchObject({ kind: "refused", reason: "wrong_type" })
  })

  it("reports a refused authorization code without signing anybody in", async () => {
    const outcome = await run(null, { fetchImpl: tokenEndpoint(null, 400) })
    expect(outcome).toMatchObject({ kind: "refused", reason: "code_rejected", detail: "invalid_grant" })
  })

  it("reports an unreachable issuer as retryable rather than as a refusal", async () => {
    const failing = vi.fn(async () => {
      throw new Error("network")
    }) as unknown as typeof fetch
    expect(await run(null, { fetchImpl: failing })).toEqual({ kind: "unavailable", reason: "issuer_unreachable" })
  })

  it("is unavailable, not broken, on a deployment with no Cubid configured", async () => {
    config.crossAppSignInConfig.mockReturnValue(null)
    expect(await run(await signIdToken())).toEqual({ kind: "unavailable", reason: "not_configured" })
  })

  it("does not refuse a sign-in because a key check was inconclusive", async () => {
    jwksGet.mockResolvedValue({ keys: [] })
    jwksRefresh.mockResolvedValue({ outcome: "throttled" })
    expect(await run(await signIdToken())).toEqual({ kind: "unavailable", reason: "issuer_keys_unavailable" })
  })
})
