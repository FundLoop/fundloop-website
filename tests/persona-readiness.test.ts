import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import os from "node:os"
import path from "node:path"
import { describe, expect, it, vi } from "vitest"
import {
  classifyReadinessFailure,
  derivePersonaReadiness,
  probeAppIdentity,
  probeEdgeFunctions,
  probeSupabaseFoundation,
  recoverLocalGateway,
  requiredPersonaFunctions,
  waitForReadinessProbe,
} from "../scripts/persona-readiness.mjs"

const foundationEnv = {
  supabaseUrl: "http://127.0.0.1:55321",
  mailpitUrl: "http://127.0.0.1:55324",
  anonKey: "anon",
  serviceRoleKey: "service",
}

function json(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), { status, headers: { "content-type": "application/json" } })
}

const currentSchema = {
  contractVersion: "fundloop.persona-goal2-schema-readiness.v1",
  migrationVersion: "20260813133000",
  featureCount: 18,
  missingFeatures: [],
  ready: true,
  productionValueFlowEnabled: false,
}

describe("persona readiness race", () => {
  it("derives the exact selected command inventory from reviewable journey checkpoints", () => {
    expect(requiredPersonaFunctions(["new-member"])).toEqual([
      "profile-publication-choice-record",
      "user-onboarding-draft-clear",
      "user-onboarding-draft-upsert",
      "user-onboarding-publish",
    ])
    expect(requiredPersonaFunctions(["new-founder"])).toEqual([
      "profile-publication-choice-record", "project-attribution-dataset-submit", "project-invitation-accept",
      "project-invitation-create", "project-invitation-inspect", "project-invitation-list", "project-invitation-revoke",
      "project-monthly-contribution-submit", "project-onboarding-draft-clear", "project-onboarding-draft-upsert",
      "project-onboarding-publish", "user-onboarding-draft-clear", "user-onboarding-draft-upsert", "user-onboarding-publish",
    ])
    expect(requiredPersonaFunctions(["returning-founder"])).toEqual([
      "project-attribution-dataset-submit", "project-invitation-accept", "project-invitation-create",
      "project-invitation-inspect", "project-invitation-list", "project-invitation-revoke", "project-monthly-contribution-submit",
    ])
    expect(requiredPersonaFunctions(["returning-operator"])).toEqual([
      "monthly-cycle-approval", "monthly-cycle-bookkeeping-credits-create", "monthly-cycle-calculation-package",
      "monthly-cycle-lock", "monthly-cycle-verification-review",
    ])
    const readOnly = derivePersonaReadiness(["returning-member"])
    expect(readOnly.functions).toEqual([])
    expect(readOnly.functionContractDigest).toMatch(/^[0-9a-f]{64}$/)
    expect(readFileSync("tests/e2e/personas/readiness-boundaries.json", "utf8")).toContain('"readOnlyRoutes"')
  })

  it("rejects silent or mutating no-function persona coverage", () => {
    const root = mkdtempSync(path.join(os.tmpdir(), "fundloop-persona-readiness-"))
    try {
      mkdirSync(path.join(root, "tests/e2e/personas"), { recursive: true })
      mkdirSync(path.join(root, "app"), { recursive: true })
      mkdirSync(path.join(root, "supabase/functions/persona-readiness-identity"), { recursive: true })
      writeFileSync(path.join(root, "supabase/functions/persona-readiness-identity/source-contracts.json"),
        JSON.stringify({ contractVersion: "fundloop.persona-selected-function-contracts.v1", functions: {} }))
      writeFileSync(path.join(root, "tests/e2e/personas/journeys.ts"), "export const journeys = []\n")
      const writeRegistry = (definition: object) => writeFileSync(path.join(root, "tests/e2e/personas/readiness-boundaries.json"), JSON.stringify({ quiet: definition }))
      writeRegistry({ journeySource: "tests/e2e/personas/journeys.ts", commandBoundaries: {}, readOnlyRoutes: ["/quiet"] })
      expect(() => derivePersonaReadiness(["quiet"], root)).toThrow("persona-readiness-empty-unjustified:quiet")
      writeFileSync(path.join(root, "app/quiet.tsx"), 'import x from "@/lib/edge-functions/write"\n')
      writeRegistry({ journeySource: "tests/e2e/personas/journeys.ts", commandBoundaries: {}, readOnlyRoutes: ["/quiet"], readOnlySources: ["app/quiet.tsx"] })
      expect(() => derivePersonaReadiness(["quiet"], root)).toThrow("persona-readiness-read-only-source-mutates:quiet")
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it("rejects a stale selected-function source contract before runtime startup", () => {
    const root = mkdtempSync(path.join(os.tmpdir(), "fundloop-persona-contract-"))
    try {
      mkdirSync(path.join(root, "tests/e2e/personas"), { recursive: true })
      mkdirSync(path.join(root, "supabase/functions/persona-readiness-identity"), { recursive: true })
      mkdirSync(path.join(root, "supabase/functions/write"), { recursive: true })
      writeFileSync(path.join(root, "tests/e2e/personas/journeys.ts"), 'export const journeys = [{ id: "quiet.write" }]\n')
      writeFileSync(path.join(root, "tests/e2e/personas/readiness-boundaries.json"), JSON.stringify({ quiet: {
        journeySource: "tests/e2e/personas/journeys.ts", readOnlyRoutes: [], commandBoundaries: { "quiet.write": ["write"] },
      } }))
      writeFileSync(path.join(root, "supabase/functions/write/index.ts"), "export const current = true\n")
      writeFileSync(path.join(root, "supabase/functions/persona-readiness-identity/source-contracts.json"), JSON.stringify({
        contractVersion: "fundloop.persona-selected-function-contracts.v1", functions: { write: "0".repeat(64) },
      }))
      expect(() => derivePersonaReadiness(["quiet"], root)).toThrow("persona-readiness-source-contract-stale:write")
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it("binds the schema identity to every Goal 2 feature without response-header inference", async () => {
    const fetcher = vi.fn(async (input: string | URL) => {
      const url = String(input)
      if (url.includes("/rpc/persona_goal2_schema_readiness")) return json(currentSchema)
      return json({ ok: true })
    }) as unknown as typeof fetch
    await expect(probeSupabaseFoundation(foundationEnv, fetcher)).resolves.toMatchObject({
      auth: 200, rest: 200, storage: 200, mailpit: 200, schemaIdentity: currentSchema,
    })
    const rpcCall = vi.mocked(fetcher).mock.calls.find(([url]) => String(url).includes("persona_goal2_schema_readiness"))
    expect(rpcCall?.[1]).toMatchObject({ method: "POST" })
    expect(rpcCall?.[1]?.headers).toMatchObject({ apikey: "service", authorization: "Bearer service" })
  })

  it.each([
    [{ ...currentSchema, migrationVersion: "20260813130000" }, "schema-identity-stale-version"],
    [{ ...currentSchema, ready: false, missingFeatures: ["relation:monthly_cycle_report_artifacts"] }, "schema-identity-partial-features"],
  ])("rejects stale or partial schema identity", async (identity, error) => {
    const fetcher = vi.fn(async (input: string | URL) => String(input).includes("/rpc/") ? json(identity) : json({ ok: true })) as unknown as typeof fetch
    await expect(probeSupabaseFoundation(foundationEnv, fetcher)).rejects.toThrow(error)
  })

  it("requires selected OPTIONS inventory plus exact restarted runtime identity", async () => {
    const expected = { secret: "secret", readinessNonce: "run-1", commitSha: "a".repeat(40),
      functionContracts: { "project-onboarding-publish": "c".repeat(64), "user-onboarding-publish": "d".repeat(64) },
      functionContractDigest: "b".repeat(64) }
    const fetcher = vi.fn(async (input: string | URL, init?: RequestInit) => {
      if (!String(input).endsWith("persona-readiness-identity")) return new Response("ok", { status: 200 })
      expect(JSON.parse(String(init?.body))).toEqual({ selectedFunctions: ["user-onboarding-publish", "project-onboarding-publish"] })
      return json({ ok: true, contractVersion: "fundloop.persona-runtime-readiness.v1", environment: "local",
        sourceContractVersion: "fundloop.persona-selected-function-contracts.v1",
        readinessNonce: expected.readinessNonce, commitSha: expected.commitSha,
        selectedFunctionContracts: expected.functionContracts, selectedFunctionContractDigest: expected.functionContractDigest,
        productionValueFlowEnabled: false })
    }) as unknown as typeof fetch
    await expect(probeEdgeFunctions({ supabaseUrl: foundationEnv.supabaseUrl, anonKey: "anon" },
      ["user-onboarding-publish", "project-onboarding-publish"], expected, fetcher)).resolves.toMatchObject({
      statuses: { "user-onboarding-publish": 200, "project-onboarding-publish": 200 },
      identity: { readinessNonce: "run-1" },
    })
  })

  it("rejects partial inventory and stale runtime identity precisely", async () => {
    const expected = { secret: "secret", readinessNonce: "run-1", commitSha: "a".repeat(40), functionContracts: {}, functionContractDigest: "b".repeat(64) }
    await expect(probeEdgeFunctions({ supabaseUrl: foundationEnv.supabaseUrl, anonKey: "anon" }, ["missing"], expected,
      async () => new Response("missing", { status: 404 }))).rejects.toThrow("http-404")
    await expect(probeEdgeFunctions({ supabaseUrl: foundationEnv.supabaseUrl, anonKey: "anon" }, [], expected,
      async () => json({ contractVersion: "fundloop.persona-runtime-readiness.v1", environment: "local",
        sourceContractVersion: "fundloop.persona-selected-function-contracts.v1",
        readinessNonce: "old", commitSha: expected.commitSha, selectedFunctionContractDigest: expected.functionContractDigest,
        selectedFunctionContracts: {}, productionValueFlowEnabled: false }))).rejects.toThrow("runtime-identity-stale-mismatch")
  })

  it("recovers from bounded delayed and stale readiness", async () => {
    const probe = vi.fn()
      .mockRejectedValueOnce(new TypeError("connection refused"))
      .mockRejectedValueOnce(new Error("runtime-identity-stale-mismatch"))
      .mockResolvedValue({ ready: true })
    const result = await waitForReadinessProbe({ id: "test", probe, attempts: 3, intervalMs: 1 })
    expect(result).toMatchObject({ attempt: 3, evidence: { ready: true } })
    expect(classifyReadinessFailure(new Error("schema-identity-stale-version"))).toBe("stale")
    expect(classifyReadinessFailure(new Error("schema-identity-partial-features"))).toBe("partial")
    expect(classifyReadinessFailure(new Error("runtime-identity-stale-mismatch"))).toBe("stale")
  })

  it("fails a dead service with a precise classified timeout", async () => {
    await expect(waitForReadinessProbe({
      id: "edge-functions",
      probe: async () => { throw new Error("runtime-identity-partial-json") },
      attempts: 2,
      intervalMs: 1,
    })).rejects.toThrow("persona-readiness-edge-functions-partial-timeout")
  })

  it("rejects a stale app and accepts the exact run identity", async () => {
    const fetcher = vi.fn(async () => json({ runtime: "fundloop-next", environment: "local", readinessNonce: "old", commitSha: "abc" })) as unknown as typeof fetch
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
