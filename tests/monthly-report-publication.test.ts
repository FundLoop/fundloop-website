import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import { describe, expect, it, vi } from "vitest"
import { validateMonthlyReportPublicationInput } from "@/lib/edge-functions/monthly-report-publication-contract"
import { createMonthlyReportPublicationHandler, type MonthlyReportPublicationOperations } from "@/lib/reporting/monthly-report-publication-handler"
import { buildMonthlyCycleReportPublicationPath } from "@/lib/storage/artifacts"

const migration = readFileSync("supabase/migrations/20260813140000_monthly_report_storage_and_version_integrity.sql", "utf8")
const operator = { id: "00000000-0000-4000-8000-000000000001", email: "operator@example.com" }
const member = { id: "00000000-0000-4000-8000-000000000002", email: "member@example.com" }

function digest(value: string) { return createHash("sha256").update(value).digest("hex") }
function request(body: unknown) { return new Request("http://local/functions/v1/monthly-report-publication", { method: "POST", body: JSON.stringify(body) }) }
async function body(response: Response) { return response.json() as Promise<any> }

function harness(options: { user?: typeof member | null; internal?: boolean; founder?: boolean; finalizeError?: boolean; auditError?: boolean } = {}) {
  const bytes = '{"audience":"public","schemaVersion":2}'
  const hash = digest(bytes)
  const path = buildMonthlyCycleReportPublicationPath({ cycleKey: "2026-07", closePackageId: 7, audience: "public", version: 1, artifactHash: hash })
  const artifact = { artifactId: "11", cycleKey: "2026-07", closePackageId: "7", audience: "public" as const,
    subjectUserId: null, subjectProjectId: null, version: 1, artifactBytes: bytes, artifactHash: hash, artifactPath: path }
  const objects = new Map<string, Uint8Array>()
  const calls: Array<[string, unknown]> = []
  const operations: MonthlyReportPublicationOperations = {
    rpc: vi.fn(async (name, args) => {
      calls.push([name, args])
      if (name === "prepare_monthly_cycle_report_publication") return { data: { artifacts: [artifact] }, error: null }
      if (name === "finalize_monthly_cycle_report_publication" && options.finalizeError) return { data: null, error: { message: "finalize failed" } }
      if (name === "record_monthly_report_publication_failure" && options.auditError) return { data: null, error: { message: "audit failed" } }
      if (name === "prepare_monthly_cycle_report_tombstone") return { data: { artifactPath: path }, error: null }
      return { data: { recorded: true }, error: null }
    }),
    upload: vi.fn(async (objectPath, value) => {
      if (objects.has(objectPath)) return { data: null, error: { message: "already exists" } }
      objects.set(objectPath, Uint8Array.from(value));return { data: { path: objectPath }, error: null }
    }),
    download: vi.fn(async (objectPath) => objects.has(objectPath)
      ? { data: new Blob([Uint8Array.from(objects.get(objectPath)!).buffer], { type: "application/json" }), error: null }
      : { data: null, error: { message: "missing" } }),
    remove: vi.fn(async (paths) => { for (const objectPath of paths) objects.delete(objectPath);return { data: {}, error: null } }),
    read: vi.fn(async (input) => ({ data: [{ audience: input.audience, subject_user_id: input.subjectUserId, subject_project_id: input.subjectProjectId }], error: null })),
    isFounder: vi.fn(async () => ({ data: options.founder ?? false, error: null })),
  }
  const user = options.user === undefined ? operator : options.user
  const handler = createMonthlyReportPublicationHandler({
    authenticate: async () => user ? { ok: true, user, adminClient: {} } : { ok: false, user: null, adminClient: {}, code: "not_authenticated", error: "login" },
    environment: () => "local",
    isInternal: () => options.internal ?? user?.id === operator.id,
    operations: () => operations,
  })
  return { handler, operations, objects, calls, artifact, path }
}

describe("monthly report publication", () => {
  it("validates explicit action and audience/subject contracts", () => {
    expect(validateMonthlyReportPublicationInput({ action: "generate", closePackageId: "7" }).ok).toBe(true)
    expect(validateMonthlyReportPublicationInput({ action: "regenerate", closePackageId: "7", expectedCurrentVersion: 1,
      regenerationKey: "a".repeat(64), reason: "corrected_close" }).ok).toBe(true)
    expect(validateMonthlyReportPublicationInput({ action: "read", audience: "mcp", cycleKey: "2026-07" }).ok).toBe(true)
    expect(validateMonthlyReportPublicationInput({ action: "read", audience: "user" }).ok).toBe(false)
    expect(validateMonthlyReportPublicationInput({ action: "read", audience: "public", subjectUserId: member.id }).ok).toBe(false)
    expect(validateMonthlyReportPublicationInput({ action: "publish", closePackageId: "7", rootHash: "a".repeat(64), subjectUserId: member.id }).ok).toBe(false)
    expect(validateMonthlyReportPublicationInput({ action: "read", audience: "public", unknown: true }).ok).toBe(false)
    expect(validateMonthlyReportPublicationInput({ action: "tombstone", artifactId: "11", reason: "subject_erasure" }).ok).toBe(true)
  })

  it("uploads immutable canonical bytes, reads them back, then finalizes", async () => {
    const test = harness()
    const result = await body(await test.handler(request({ action: "publish", closePackageId: "7", rootHash: "a".repeat(64) })))
    expect(result.ok).toBe(true)
    expect(vi.mocked(test.operations.upload).mock.calls[0]?.[0]).toBe(test.path)
    expect(Array.from(vi.mocked(test.operations.upload).mock.calls[0]?.[1] ?? [])).toEqual(Array.from(new TextEncoder().encode(test.artifact.artifactBytes)))
    expect(test.operations.download).toHaveBeenCalledWith(test.path)
    expect(test.calls.map(([name]) => name)).toEqual(["prepare_monthly_cycle_report_publication", "finalize_monthly_cycle_report_publication"])
  })

  it("accepts only a byte-identical existing object as idempotent", async () => {
    const test = harness();test.objects.set(test.path, new TextEncoder().encode(test.artifact.artifactBytes))
    expect((await body(await test.handler(request({ action: "publish", closePackageId: "7", rootHash: "a".repeat(64) })))).ok).toBe(true)
    test.objects.set(test.path, new TextEncoder().encode("stale"))
    const mismatch = await body(await test.handler(request({ action: "publish", closePackageId: "7", rootHash: "a".repeat(64) })))
    expect(mismatch.error.code).toBe("monthly_report_upload_failed")
    expect(test.calls.some(([name]) => name === "record_monthly_report_publication_failure")).toBe(true)
  })

  it("keeps verified immutable objects for retry when database finalization fails", async () => {
    const test = harness({ finalizeError: true })
    const result = await body(await test.handler(request({ action: "publish", closePackageId: "7", rootHash: "a".repeat(64) })))
    expect(result.error.code).toBe("monthly_report_finalize_failed")
    expect(test.objects.has(test.path)).toBe(true)
    expect(test.calls.at(-1)?.[0]).toBe("record_monthly_report_publication_failure")
  })

  it("fails loudly when a publication failure cannot be durably audited", async () => {
    const test = harness({ finalizeError: true, auditError: true })
    const result = await body(await test.handler(request({ action: "publish", closePackageId: "7", rootHash: "a".repeat(64) })))
    expect(result.error.code).toBe("monthly_report_failure_audit_failed")
    expect(test.objects.has(test.path)).toBe(true)
  })

  it("removes only newly uploaded objects after a readback mismatch", async () => {
    const test = harness()
    vi.mocked(test.operations.download).mockResolvedValue({ data: new Blob(["wrong"]), error: null })
    const result = await body(await test.handler(request({ action: "publish", closePackageId: "7", rootHash: "a".repeat(64) })))
    expect(result.error.code).toBe("monthly_report_readback_mismatch")
    expect(test.operations.remove).toHaveBeenCalledWith([test.path])
    expect(test.objects.has(test.path)).toBe(false)
  })

  it("rolls back prior objects when a later artifact upload fails", async () => {
    const test = harness()
    const secondBytes = '{"audience":"mcp","schemaVersion":2}'
    const secondHash = digest(secondBytes)
    const secondPath = buildMonthlyCycleReportPublicationPath({ cycleKey: "2026-07", closePackageId: 7, audience: "mcp", version: 1, artifactHash: secondHash })
    const second = { ...test.artifact, artifactId: "12", audience: "mcp" as const, artifactBytes: secondBytes, artifactHash: secondHash, artifactPath: secondPath }
    vi.mocked(test.operations.rpc).mockImplementation(async (name, args) => {
      test.calls.push([name, args])
      if (name === "prepare_monthly_cycle_report_publication") return { data: { artifacts: [test.artifact, second] }, error: null }
      return { data: { recorded: true }, error: null }
    })
    vi.mocked(test.operations.upload).mockImplementation(async (path, value) => {
      if (path === secondPath) return { data: null, error: { message: "storage unavailable" } }
      test.objects.set(path, Uint8Array.from(value));return { data: {}, error: null }
    })
    const result = await body(await test.handler(request({ action: "publish", closePackageId: "7", rootHash: "a".repeat(64) })))
    expect(result.error.code).toBe("monthly_report_upload_failed")
    expect(test.operations.remove).toHaveBeenCalledWith([test.path])
    expect(test.objects.has(test.path)).toBe(false)
  })

  it("rejects a prepared path that is not the deterministic content path", async () => {
    const test = harness();test.artifact.artifactPath = "wrong/report.json"
    const result = await body(await test.handler(request({ action: "publish", closePackageId: "7", rootHash: "a".repeat(64) })))
    expect(result.error.code).toBe("monthly_report_artifact_mismatch")
    expect(test.operations.upload).not.toHaveBeenCalled()
  })

  it("authorizes anonymous public, exact self, exact founder project, and internal scopes", async () => {
    expect((await body(await harness({ user: null }).handler(request({ action: "read", audience: "public" })))).ok).toBe(true)
    expect((await body(await harness({ user: member }).handler(request({ action: "read", audience: "user", subjectUserId: member.id })))).ok).toBe(true)
    expect((await body(await harness({ user: member, founder: true }).handler(request({ action: "read", audience: "founder", subjectProjectId: "9" })))).ok).toBe(true)
    expect((await body(await harness().handler(request({ action: "read", audience: "operator" })))).ok).toBe(true)
    expect((await body(await harness().handler(request({ action: "read", audience: "mcp" })))).ok).toBe(true)
  })

  it("denies unauthenticated private, cross-user, cross-project, and non-operator reads", async () => {
    expect((await body(await harness({ user: null }).handler(request({ action: "read", audience: "user", subjectUserId: member.id })))).error.code).toBe("not_authenticated")
    expect((await body(await harness({ user: member }).handler(request({ action: "read", audience: "user", subjectUserId: operator.id })))).error.code).toBe("forbidden")
    expect((await body(await harness({ user: member, founder: false }).handler(request({ action: "read", audience: "founder", subjectProjectId: "9" })))).error.code).toBe("forbidden")
    expect((await body(await harness({ user: member }).handler(request({ action: "read", audience: "operator" })))).error.code).toBe("forbidden")
  })

  it("routes generate/regenerate and storage-backed tombstone through explicit RPCs", async () => {
    const test = harness()
    await test.handler(request({ action: "generate", closePackageId: "7" }))
    await test.handler(request({ action: "regenerate", closePackageId: "7", expectedCurrentVersion: 1, regenerationKey: "b".repeat(64), reason: "correction" }))
    const tombstone = await body(await test.handler(request({ action: "tombstone", artifactId: "11", reason: "subject_erasure" })))
    expect(tombstone.ok).toBe(true)
    expect(test.calls.map(([name]) => name)).toEqual([
      "generate_monthly_cycle_reports", "regenerate_monthly_cycle_reports", "prepare_monthly_cycle_report_tombstone", "finalize_monthly_cycle_report_tombstone",
    ])
    expect(test.operations.remove).toHaveBeenCalledWith([test.path])
  })

  it("encodes forward-only storage/version/tombstone integrity", () => {
    for (const text of ["artifact_bytes", "storage_verified_at", "monthly_cycle_reports_regenerate.v2", "regenerated", "superseded",
      "prepare_monthly_cycle_report_publication", "finalize_monthly_cycle_report_publication", "monthly_report_storage_publication_requires_edge",
      "subject_evidence_hash", "subject_tombstoned", "7 years", "productionValueFlowEnabled", "false"]) expect(migration).toContain(text)
    expect(migration).not.toContain("ON CONFLICT DO NOTHING RETURNING")
  })
})
