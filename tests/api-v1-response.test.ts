import { describe, expect, it } from "vitest"
import {
  API_V1_DEFAULT_LIMIT,
  API_V1_MAX_LIMIT,
  apiData,
  apiError,
  decodeCursor,
  encodeCursor,
  insufficientScope,
  isoOrNull,
  parseLimit,
  rateLimited,
  requestId,
} from "@/lib/api/v1/response"

describe("api v1 response contract", () => {
  it("wraps data and echoes a request id header", async () => {
    const response = apiData({ projects: [] }, { meta: { next_cursor: null } })
    expect(response.status).toBe(200)
    expect(response.headers.get("Cache-Control")).toBe("no-store")
    expect(response.headers.get("X-Request-Id")).toMatch(/^fl_req_[0-9a-f]{32}$/)
    await expect(response.json()).resolves.toEqual({ data: { projects: [] }, meta: { next_cursor: null } })
  })

  it("omits meta when no pagination applies", async () => {
    await expect(apiData({ id: "x" }).json()).resolves.toEqual({ data: { id: "x" } })
  })

  it("maps each error code to the documented status", async () => {
    const cases: Array<[Parameters<typeof apiError>[0], number]> = [
      ["unauthorized", 401],
      ["insufficient_scope", 403],
      ["forbidden", 403],
      ["not_found", 404],
      ["conflict", 409],
      ["validation_failed", 422],
      ["rate_limited", 429],
      ["internal_error", 500],
    ]
    for (const [code, status] of cases) {
      const response = apiError(code, "message")
      expect(response.status, code).toBe(status)
      const body = (await response.json()) as { error: { code: string; message: string; request_id: string } }
      expect(body.error.code, code).toBe(code)
      expect(body.error.request_id, code).toMatch(/^fl_req_/)
    }
  })

  it("carries field errors in details and reuses a supplied request id", async () => {
    const id = requestId()
    const response = apiError("validation_failed", "limit is invalid.", { details: { limit: "must be an integer" }, requestId: id })
    const body = (await response.json()) as { error: { request_id: string; details: unknown } }
    expect(body.error.request_id).toBe(id)
    expect(body.error.details).toEqual({ limit: "must be an integer" })
    expect(response.headers.get("X-Request-Id")).toBe(id)
  })

  it("names the missing scope in the message and the challenge", async () => {
    const response = insufficientScope("payout-routes:read")
    expect(response.status).toBe(403)
    expect(response.headers.get("WWW-Authenticate")).toBe('Bearer error="insufficient_scope", scope="payout-routes:read"')
    const body = (await response.json()) as { error: { message: string } }
    expect(body.error.message).toContain("payout-routes:read")
  })

  it("sends Retry-After as whole seconds, at least one", () => {
    expect(rateLimited(0.2).headers.get("Retry-After")).toBe("1")
    expect(rateLimited(30).headers.get("Retry-After")).toBe("30")
    expect(rateLimited(1.2).headers.get("Retry-After")).toBe("2")
  })

  it("round-trips opaque cursors and rejects junk", () => {
    const cursor = encodeCursor({ created_at: "2026-10-09T00:00:00.000Z", id: 42 })
    expect(cursor).not.toContain("{")
    expect(decodeCursor(cursor)).toEqual({ created_at: "2026-10-09T00:00:00.000Z", id: 42 })
    expect(decodeCursor(null)).toBeNull()
    expect(decodeCursor("not-base64!")).toBeNull()
    expect(decodeCursor(Buffer.from("[1,2]", "utf8").toString("base64url"))).toBeNull()
    expect(decodeCursor(Buffer.from('{"a":{"b":1}}', "utf8").toString("base64url"))).toBeNull()
  })

  it("clamps and validates limit", () => {
    expect(parseLimit(null)).toEqual({ ok: true, limit: API_V1_DEFAULT_LIMIT })
    expect(parseLimit("")).toEqual({ ok: true, limit: API_V1_DEFAULT_LIMIT })
    expect(parseLimit("10")).toEqual({ ok: true, limit: 10 })
    expect(parseLimit("5000")).toEqual({ ok: true, limit: API_V1_MAX_LIMIT })
    expect(parseLimit("0").ok).toBe(false)
    expect(parseLimit("-3").ok).toBe(false)
    expect(parseLimit("abc").ok).toBe(false)
  })

  it("normalises timestamps to ISO-8601 UTC", () => {
    expect(isoOrNull("2026-10-09 00:00:00+00")).toBe("2026-10-09T00:00:00.000Z")
    expect(isoOrNull(null)).toBeNull()
    expect(isoOrNull("not a date")).toBeNull()
  })
})
