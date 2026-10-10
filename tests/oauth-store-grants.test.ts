import { readFileSync } from "node:fs"
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

const rpc = vi.fn()

vi.mock("@/lib/supabase-admin", () => ({
  getAdminSupabaseClient: () => ({ from: (table: string) => builder(table), rpc: (name: string, args: Record<string, unknown>) => rpc(name, args) }),
}))

function updatesOn(table: string) {
  return ops.filter((op) => op.table === table && op.kind === "update")
}

describe("a redemption's effect on the grant", () => {
  beforeEach(() => {
    ops.length = 0
    responses.clear()
    rpc.mockReset()
    rpc.mockResolvedValue({ data: [{ grant_id: 7, outcome: "updated" }], error: null })
  })

  it("hands the whole grant decision to one database call", async () => {
    // Read-compare-write in application code let two redemptions interleave and leave a live token
    // wider than the grant recording it, so the decision belongs in one statement.
    const issuedAt = new Date("2026-10-09T12:00:00.000Z")
    await issueAccessToken({
      clientId: "wondrbot",
      userId: "user-1",
      consentedScopes: ["profile:read", "awards:read"],
      scopes: ["profile:read"],
      assertionJti: "jag_1",
      assertionIssuedAt: issuedAt,
    })

    expect(rpc).toHaveBeenCalledWith("oauth_redeem_grant", {
      p_client_id: "wondrbot",
      p_user_id: "user-1",
      // The grant records what the person consented to, not what the client narrowed itself to.
      p_consented_scopes: ["profile:read", "awards:read"],
      p_assertion_issued_at: issuedAt.toISOString(),
    })
  })

  it("refuses an assertion that predates a withdrawal", async () => {
    // An assertion proves consent as of its iat. Cubid marks outstanding assertions revoked on
    // withdrawal, which a resource app cannot see, so one minted earlier must not revive the grant.
    rpc.mockResolvedValue({ data: [{ grant_id: 7, outcome: "withdrawn" }], error: null })

    const result = await issueAccessToken({
      clientId: "wondrbot",
      userId: "user-1",
      consentedScopes: ["profile:read"],
      scopes: ["profile:read"],
      assertionJti: "jag_2",
      assertionIssuedAt: new Date("2026-10-01T00:00:00.000Z"),
    })

    expect(result).toEqual({ ok: false, reason: "withdrawn" })
    // And no token is written.
    expect(ops.some((op) => op.table === "oauth_tokens" && op.kind === "insert")).toBe(false)
  })

  it("stores only a digest, and the token's own narrower scope", async () => {
    const issued = await issueAccessToken({
      clientId: "wondrbot",
      userId: "user-1",
      consentedScopes: ["profile:read", "awards:read"],
      scopes: ["profile:read"],
      assertionJti: "jag_3",
      assertionIssuedAt: new Date(),
    })

    expect(issued.ok).toBe(true)
    const insert = ops.find((op) => op.table === "oauth_tokens" && op.kind === "insert")!
    expect(insert.values!.token_sha256).toMatch(/^[0-9a-f]{64}$/)
    if (issued.ok) expect(JSON.stringify(insert.values)).not.toContain(issued.accessToken)
    expect(insert.values!.scopes).toEqual(["profile:read"])
    expect(insert.values!.grant_id).toBe(7)
    expect(insert.values!.issued_from_assertion_jti).toBe("jag_3")
  })
})

describe("the grant state machine in SQL", () => {
  const migration = readFileSync("supabase/migrations/20261009120000_oauth_authorization_server.sql", "utf8")
  const fn = migration.slice(migration.indexOf("create or replace function public.oauth_redeem_grant"), migration.indexOf("revoke all on function public.oauth_redeem_grant"))

  it("serialises concurrent redemptions for one client and person", () => {
    expect(fn).toContain("for update")
    // A concurrent first redemption loses the insert; it must then lock the winner's row rather
    // than failing the request.
    expect(fn).toContain("exception when unique_violation")
  })

  it("refuses to revive a grant with an assertion older than the withdrawal", () => {
    expect(fn).toContain("v_grant.revoked_at is not null and p_assertion_issued_at <= v_grant.revoked_at")
    expect(fn).toContain("'withdrawn'")
  })

  it("supersedes live tokens when reviving or narrowing, and only then", () => {
    expect(fn).toContain("existing <> all (p_consented_scopes)")
    expect(fn).toContain("update public.oauth_tokens set revoked_at = now()")
    expect(fn).toContain("if v_grant.revoked_at is not null or v_narrowed then")
  })

  it("is reachable only by the service role", () => {
    expect(migration).toContain("revoke all on function public.oauth_redeem_grant(text, uuid, public.oauth_scope[], timestamptz) from public, anon, authenticated")
    expect(migration).toContain("grant execute on function public.oauth_redeem_grant(text, uuid, public.oauth_scope[], timestamptz) to service_role")
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
