import { describe, expect, it, vi } from "vitest"
import { commandFailure, handleRequest } from "@/lib/edge-functions/authenticated-command-http"

function dependencies(auth: unknown) {
  return { authenticateRequest: vi.fn().mockResolvedValue(auth) }
}

function adminAuth(email = "person@example.com") {
  return { ok: true, user: { id: "user-1", email }, adminClient: {} }
}

const accepted = () => Promise.resolve(new Response("accepted", { status: 200 }))

describe("epoch-allocation-close HTTP boundary", () => {
  it("authenticates unauthenticated GET before method handling", async () => {
    const auth = dependencies({ ok: false, code: "not_authenticated", error: "provider secret detail", user: null })
    const response = await handleRequest(new Request("https://example.test", { method: "GET" }), auth.authenticateRequest, accepted)
    expect(response.status).toBe(401)
    expect(response.headers.get("allow")).toBeNull()
    expect(auth.authenticateRequest).toHaveBeenCalledOnce()
    expect(await response.clone().text()).not.toContain("provider secret detail")
  })

  it("does not parse or validate an unauthenticated POST body", async () => {
    const auth = dependencies({ ok: false, code: "not_authenticated", error: "User not authenticated.", user: null })
    const parsePayload = vi.fn().mockResolvedValue(commandFailure("invalid_payload", "invalid", 400))
    const response = await handleRequest(new Request("https://example.test", { method: "POST", body: "not-json" }), auth.authenticateRequest, parsePayload)
    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toMatchObject({ error: { code: "not_authenticated" } })
    expect(parsePayload).not.toHaveBeenCalled()
  })

  it("returns 405 with Allow only after authentication", async () => {
    const auth = dependencies(adminAuth())
    const response = await handleRequest(new Request("https://example.test", { method: "GET" }), auth.authenticateRequest, accepted)
    expect(response.status).toBe(405)
    expect(response.headers.get("allow")).toBe("POST")
  })

  it("preserves unauthenticated OPTIONS and rejects invalid authenticated payloads", async () => {
    const auth = dependencies(adminAuth())
    const options = await handleRequest(new Request("https://example.test", { method: "OPTIONS" }), auth.authenticateRequest, accepted)
    expect(options.status).toBe(200)
    expect(auth.authenticateRequest).not.toHaveBeenCalled()
    const invalid = await handleRequest(new Request("https://example.test", { method: "POST", body: "not-json" }), auth.authenticateRequest, async () => commandFailure("invalid_payload", "invalid", 400))
    expect(invalid.status).toBe(400)
  })

  it("supports an explicit 403 response from the authenticated authorization handler", async () => {
    const auth = dependencies(adminAuth())
    const response = await handleRequest(new Request("https://example.test", { method: "POST" }), auth.authenticateRequest,
      async () => commandFailure("forbidden", "Internal operator access is required.", 403))
    expect(response.status).toBe(403)
  })

  it("returns 500 when authentication infrastructure fails", async () => {
    const auth = { authenticateRequest: vi.fn().mockRejectedValue(new Error("provider failure")) }
    const response = await handleRequest(new Request("https://example.test", { method: "GET" }), auth.authenticateRequest, accepted)
    expect(response.status).toBe(500)
    await expect(response.json()).resolves.toMatchObject({ error: { code: "authentication_failed" } })
  })

  it("does not expose provider-controlled authentication failures", async () => {
    const auth = dependencies({ ok: false, code: "provider_failure", error: "sensitive provider detail", user: null })
    const response = await handleRequest(new Request("https://example.test", { method: "GET" }), auth.authenticateRequest, accepted)
    expect(response.status).toBe(500)
    expect(await response.text()).not.toContain("sensitive provider detail")
  })
})
