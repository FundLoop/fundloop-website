import { describe, expect, it, vi } from "vitest"
import {
  classifyReadinessFailure,
  probeAppIdentity,
  recoverLocalGateway,
  requiredPersonaFunctions,
  waitForReadinessProbe,
} from "../scripts/persona-readiness.mjs"

describe("persona readiness race", () => {
  it("binds the required Edge inventory to the selected personas", () => {
    expect(requiredPersonaFunctions(["returning-member"])).toEqual([])
    expect(requiredPersonaFunctions(["new-founder", "returning-operator"])).toEqual(expect.arrayContaining([
      "project-onboarding-publish",
      "project-invitation-accept",
      "project-invitation-revoke",
      "monthly-cycle-lock",
      "monthly-cycle-bookkeeping-credits-create",
    ]))
  })

  it("recovers from bounded delayed and stale readiness", async () => {
    const probe = vi.fn()
      .mockRejectedValueOnce(new TypeError("connection refused"))
      .mockRejectedValueOnce(new Error("app-identity-mismatch"))
      .mockResolvedValue({ ready: true })
    const result = await waitForReadinessProbe({ id: "test", probe, attempts: 3, intervalMs: 1 })
    expect(result).toMatchObject({ attempt: 3, evidence: { ready: true } })
    expect(classifyReadinessFailure(new Error("app-identity-mismatch"))).toBe("stale")
  })

  it("fails a dead service with a precise classified timeout", async () => {
    await expect(waitForReadinessProbe({
      id: "edge-functions",
      probe: async () => { throw new Error("http-404") },
      attempts: 2,
      intervalMs: 1,
    })).rejects.toThrow("persona-readiness-edge-functions-partial-timeout")
  })

  it("rejects a stale app and accepts the exact run identity", async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({
      runtime: "fundloop-next", environment: "local", readinessNonce: "old", commitSha: "abc",
    }), { status: 200, headers: { "content-type": "application/json" } })) as unknown as typeof fetch
    await expect(probeAppIdentity("http://127.0.0.1:3002", { readinessNonce: "new", commitSha: "abc" }, fetcher))
      .rejects.toThrow("app-identity-mismatch")
  })

  it("recovers only the exact validated local gateway container", async () => {
    const runner = vi.fn(async () => "")
    await expect(recoverLocalGateway("fundloop", runner)).resolves.toBe("supabase_kong_fundloop")
    expect(runner).toHaveBeenCalledWith("docker", ["restart", "supabase_kong_fundloop"])
    await expect(recoverLocalGateway("../../remote", runner)).rejects.toThrow("persona-local-project-id-invalid")
  })
})
