import { beforeEach, describe, expect, it, vi } from "vitest"
import { issueAccessToken, revokeByToken } from "@/lib/oauth/store"

// The grant and revocation logic in lib/oauth/store.ts (#266 stage 2), which the route tests mock
// away. These are the rules that decide whether an old credential can still act.

type Op = { table: string; kind: "select" | "insert" | "update"; filters: Record<string, unknown>; values?: Record<string, unknown> }

const ops: Op[] = []
const responses = new Map<string, { data: unknown; error: unknown }>()

function key(table: string, kind: string) {
  return `${table}:${kind}`
}

function builder(table: string) {
  const op: Op = { table, kind: "select", filters: {}, values: undefined }
  const settle = () => {
    ops.push(op)
    return Promise.resolve(responses.get(key(table, op.kind)) ?? { data: null, error: null })
  }
  const api: Record<string, unknown> = {
    select: () => api,
    eq: (column: string, value: unknown) => {
      op.filters[`eq:${column}`] = value
      return api
    },
    is: (column: string, value: unknown) => {
      op.filters[`is:${column}`] = value
      return api
    },
    insert: (values: Record<string, unknown>) => {
      op.kind = "insert"
      op.values = values
      return api
    },
    update: (values: Record<string, unknown>) => {
      op.kind = "update"
      op.values = values
      return api
    },
    limit: () => api,
    maybeSingle: () => settle(),
    then: (resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) => settle().then(resolve, reject),
  }
  return api
}

vi.mock("@/lib/supabase-admin", () => ({ getAdminSupabaseClient: () => ({ from: (table: string) => builder(table) }) }))

function updatesOn(table: string) {
  return ops.filter((op) => op.table === table && op.kind === "update")
}

describe("a redemption that revives or narrows a grant", () => {
  beforeEach(() => {
    ops.length = 0
    responses.clear()
    responses.set(key("oauth_grants", "update"), { data: { id: 7 }, error: null })
  })

  it("supersedes the old tokens when a revoked grant is revived", async () => {
    // Cubid is the authority on consent, so a fresh assertion revives the grant — but a token
    // issued under the earlier authorization must not act against the new connection.
    responses.set(key("oauth_grants", "select"), { data: { id: 7, scopes: ["profile:read"], revoked_at: "2026-10-01T00:00:00Z" }, error: null })

    await issueAccessToken({ clientId: "wondrbot", userId: "user-1", scopes: ["profile:read"], assertionJti: "jag_1" })

    const superseded = updatesOn("oauth_tokens").find((op) => op.filters["eq:grant_id"] === 7)
    expect(superseded).toBeDefined()
    expect(superseded!.values).toMatchObject({ revoked_at: expect.any(String) })
    expect(superseded!.filters["is:revoked_at"]).toBeNull()
  })

  it("supersedes the old tokens when the person removes a scope", async () => {
    // An access token already issued with awards:read would otherwise keep it until it expired.
    responses.set(key("oauth_grants", "select"), { data: { id: 7, scopes: ["profile:read", "awards:read"], revoked_at: null }, error: null })

    await issueAccessToken({ clientId: "wondrbot", userId: "user-1", scopes: ["profile:read"], assertionJti: "jag_2" })

    expect(updatesOn("oauth_tokens").some((op) => op.filters["eq:grant_id"] === 7)).toBe(true)
  })

  it("leaves a live grant's tokens alone when nothing was removed", async () => {
    // Re-redeeming with the same or wider scope is ordinary renewal; dropping the client's current
    // token for no reason would break requests in flight.
    responses.set(key("oauth_grants", "select"), { data: { id: 7, scopes: ["profile:read"], revoked_at: null }, error: null })

    await issueAccessToken({ clientId: "wondrbot", userId: "user-1", scopes: ["profile:read", "awards:read"], assertionJti: "jag_3" })

    expect(updatesOn("oauth_tokens").some((op) => op.filters["eq:grant_id"] === 7)).toBe(false)
  })

  it("stores only a digest of the token it issues", async () => {
    responses.set(key("oauth_grants", "select"), { data: { id: 7, scopes: ["profile:read"], revoked_at: null }, error: null })

    const issued = await issueAccessToken({ clientId: "wondrbot", userId: "user-1", scopes: ["profile:read"], assertionJti: "jag_4" })

    const insert = ops.find((op) => op.table === "oauth_tokens" && op.kind === "insert")!
    expect(insert.values!.token_sha256).toMatch(/^[0-9a-f]{64}$/)
    expect(JSON.stringify(insert.values)).not.toContain(issued.accessToken)
    expect(insert.values!.issued_from_assertion_jti).toBe("jag_4")
  })
})

describe("revokeByToken", () => {
  beforeEach(() => {
    ops.length = 0
    responses.clear()
  })

  it("looks the token up as the authenticated client's, and acts only on a live one", async () => {
    responses.set(key("oauth_tokens", "select"), {
      data: { client_id: "wondrbot", user_id: "user-1", expires_at: new Date(Date.now() + 60_000).toISOString() },
      error: null,
    })

    await revokeByToken("some-token", "wondrbot")

    const lookup = ops.find((op) => op.table === "oauth_tokens" && op.kind === "select")!
    // RFC 7009 §2.1: bound to the presenting client, and already-revoked rows are excluded, so a
    // dead token cannot disconnect a person's current connection.
    expect(lookup.filters["eq:client_id"]).toBe("wondrbot")
    expect(lookup.filters["is:revoked_at"]).toBeNull()
    expect(updatesOn("oauth_tokens").length).toBeGreaterThan(0)
  })

  it("does nothing for a token that is not this client's", async () => {
    // The lookup is scoped to the client, so another client's token simply is not found.
    responses.set(key("oauth_tokens", "select"), { data: null, error: null })

    await revokeByToken("another-clients-token", "wondrbot")

    expect(updatesOn("oauth_tokens").length).toBe(0)
    expect(updatesOn("oauth_grants").length).toBe(0)
  })

  it("does nothing for an expired token", async () => {
    responses.set(key("oauth_tokens", "select"), {
      data: { client_id: "wondrbot", user_id: "user-1", expires_at: new Date(Date.now() - 60_000).toISOString() },
      error: null,
    })

    await revokeByToken("stale-token", "wondrbot")

    expect(updatesOn("oauth_tokens").length).toBe(0)
  })
})
