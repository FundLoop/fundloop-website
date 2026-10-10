import { readFileSync } from "node:fs"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { issueAccessToken, revokeByToken, revokeTokensForGrant } from "@/lib/oauth/store"

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
    rpc.mockResolvedValue({ data: [{ grant_id: 7, outcome: "issued" }], error: null })
  })

  it("writes the grant decision and the token in one database call", async () => {
    // The token insert cannot sit outside the lock: two concurrent redemptions could interleave so
    // that a wider token lands after a narrower redemption's supersession.
    const issuedAt = new Date("2026-10-09T12:00:00.000Z")
    const issued = await issueAccessToken({
      clientId: "wondrbot",
      userId: "user-1",
      assertionScopes: ["profile:read", "awards:read"],
      scopes: ["profile:read"],
      assertionJti: "jag_1",
      assertionIssuedAt: issuedAt,
    })

    expect(issued.ok).toBe(true)
    expect(rpc).toHaveBeenCalledTimes(1)
    const [name, args] = rpc.mock.calls[0]
    expect(name).toBe("oauth_redeem_grant")
    expect(args).toMatchObject({
      p_client_id: "wondrbot",
      p_user_id: "user-1",
      p_assertion_scopes: ["profile:read", "awards:read"],
      p_token_scopes: ["profile:read"],
      p_assertion_issued_at: issuedAt.toISOString(),
      p_assertion_jti: "jag_1",
    })
    // Only a digest crosses into the database.
    expect(args.p_token_sha256).toMatch(/^[0-9a-f]{64}$/)
    if (issued.ok) expect(JSON.stringify(args)).not.toContain(issued.accessToken)
    // And nothing is inserted from application code.
    expect(ops.some((op) => op.table === "oauth_tokens")).toBe(false)
  })

  it("refuses an assertion that predates a withdrawal", async () => {
    rpc.mockResolvedValue({ data: [{ grant_id: 7, outcome: "withdrawn" }], error: null })

    const result = await issueAccessToken({
      clientId: "wondrbot",
      userId: "user-1",
      assertionScopes: ["profile:read"],
      scopes: ["profile:read"],
      assertionJti: "jag_2",
      assertionIssuedAt: new Date("2026-10-01T00:00:00.000Z"),
    })

    expect(result).toEqual({ ok: false, reason: "withdrawn" })
  })
})

describe("revokeTokensForGrant", () => {
  beforeEach(() => {
    ops.length = 0
    rpc.mockReset()
    rpc.mockResolvedValue({ data: [{ grant_id: 7, outcome: "revoked" }], error: null })
  })

  it("goes through the locked function, not two statements", async () => {
    await revokeTokensForGrant("wondrbot", "user-1")
    expect(rpc).toHaveBeenCalledWith("oauth_revoke_grant", { p_client_id: "wondrbot", p_user_id: "user-1" })
    expect(ops.some((op) => op.kind === "update")).toBe(false)
  })
})

describe("the grant state machine in SQL", () => {
  const migration = readFileSync("supabase/migrations/20261009120000_oauth_authorization_server.sql", "utf8")
  const redeem = migration.slice(migration.indexOf("create or replace function public.oauth_redeem_grant"), migration.indexOf("-- A withdrawal, in one statement"))
  const revoke = migration.slice(migration.indexOf("create or replace function public.oauth_revoke_grant"), migration.indexOf("-- Expired single-use rows"))

  it("serialises concurrent redemptions and writes the token under the same lock", () => {
    expect(redeem).toContain("for update")
    expect(redeem).toContain("exception when unique_violation")
    // The insert is inside the function, which is the point.
    expect(redeem).toContain("insert into public.oauth_tokens")
  })

  it("refuses a pre-withdrawal assertion with a margin for clock skew", () => {
    // `iat` is Cubid's clock and `revoked_at` is ours, so an exact comparison would trust that the
    // two agree. The margin errs towards refusing.
    expect(redeem).toContain("p_assertion_issued_at <= v_grant.revoked_at + v_skew")
    expect(redeem).toContain("interval '30 seconds'")
    expect(redeem).toContain("'withdrawn'")
  })

  it("supersedes on revival only, never on a narrower assertion scope", () => {
    expect(redeem).toContain("if v_grant.revoked_at is not null then")
    expect(redeem).toContain("update public.oauth_tokens set revoked_at = now()")
    // Narrowing must not trigger supersession: an assertion's scope is the client's request for
    // that exchange, so a client asking for less would revoke its own parallel calls' tokens.
    expect(redeem).not.toContain("v_narrowed")
    expect(redeem).not.toContain("<> all (")
  })

  it("records a withdrawal even for a person who never redeemed here", () => {
    expect(revoke).toContain("for update")
    expect(revoke).toContain("insert into public.oauth_grants")
    expect(revoke).toContain("revoked_at)")
    expect(revoke).toContain("'recorded'")
    // Which the schema has to allow: a revoked grant may hold no scopes.
    expect(migration).toContain("or (revoked_at is not null and scopes = '{}'::public.oauth_scope[])")
  })

  it("is reachable only by the service role", () => {
    for (const signature of [
      "public.oauth_redeem_grant(text, uuid, public.oauth_scope[], timestamptz, text, public.oauth_scope[], timestamptz, text)",
      "public.oauth_revoke_grant(text, uuid)",
    ]) {
      expect(migration).toContain(`revoke all on function ${signature} from public, anon, authenticated`)
      expect(migration).toContain(`grant execute on function ${signature} to service_role`)
    }
  })
})
