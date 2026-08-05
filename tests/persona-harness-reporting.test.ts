import { mkdtemp, readFile } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { describe, expect, it } from "vitest"
import { aggregateStatus, boundedPersonaFailureReason, buildHarnessSummary, deriveCheckpointResult, exitCodeFor, sanitizeEvidence, writeJsonAtomic } from "@/tests/e2e/support/persona-reporting"

describe("persona capability reporting", () => {
  it("derives pass, expected-pending, and stale/undeclared failures", () => {
    const required = { id: "member.view-profile", mode: "required" as const, capabilityId: "member-profile" }
    expect(deriveCheckpointResult(required, { outcome: "observed", evidence: { "profile-visible": true } }).status).toBe("pass")
    expect(deriveCheckpointResult(required, { outcome: "capability-unavailable", evidence: {} }).status).toBe("fail")

    const pending = { id: "cadence.await-operator-distribution", mode: "expected-pending" as const, capabilityId: "founder-distribution-after-operator-cadence" as const }
    expect(deriveCheckpointResult(pending, {
      outcome: "capability-unavailable", evidence: { "distribution-visible": false }, reasonCode: "operator-cadence-owned-by-task-102",
    }).status).toBe("expected-pending")
    expect(deriveCheckpointResult(pending, { outcome: "observed", evidence: {} }).reasonCode).toBe("stale-pending-declaration")

    const undeclared = { ...pending, capabilityId: "unknown-gap" as never }
    expect(deriveCheckpointResult(undeclared, { outcome: "capability-unavailable", evidence: {}, reasonCode: "unknown" }).reasonCode)
      .toBe("undeclared-capability-gap")
  })

  it("aggregates deterministically and maps incomplete to exit 2", () => {
    expect(aggregateStatus(["pass", "expected-pending"])).toBe("incomplete")
    expect(exitCodeFor("incomplete")).toBe(2)
    expect(aggregateStatus(["expected-pending", "fail"])).toBe("failed")
    expect(exitCodeFor("failed")).toBe(1)
  })

  it("rejects secret-shaped evidence", () => {
    expect(() => sanitizeEvidence({ "otp-code": 123 })).toThrow("evidence-key-rejected")
    expect(() => sanitizeEvidence({ detail: "person@example.com" })).toThrow("evidence-value-rejected")
    expect(() => sanitizeEvidence({ detail: "arbitrary private payload" })).toThrow("evidence-value-rejected")
    expect(() => sanitizeEvidence({ count: 123456 })).toThrow("evidence-value-rejected")
    expect(sanitizeEvidence({ "row-count": 2, visible: true })).toEqual({ "row-count": 2, visible: true })
  })

  it("bounds complete persona failure reasons to 80 safe characters", () => {
    const reason = boundedPersonaFailureReason("persona-attribution", `invalid_payload_${"unsafe detail ".repeat(20)}`, "not-persisted")
    expect(reason).toMatch(/^[a-z0-9-]+$/)
    expect(reason.length).toBe(80)
    expect(boundedPersonaFailureReason("persona-attribution", undefined, "not-persisted")).toBe("persona-attribution-not-persisted")
  })

  it("fails an aggregate with a missing selected persona and writes atomically", async () => {
    const summary = buildHarnessSummary({
      run: { runId: "persona-test", selectedPersonas: ["new-member"], startedAt: "2035-01-01T00:00:00.000Z" },
      durationMs: 1,
      services: { supabase: "caller", mailpit: "caller", next: "runner", nextPid: 1 },
      personas: [],
      cleanup: { status: "clean", deletedCount: 0, residualCount: 0, reasonCode: null },
    })
    expect(summary.status).toBe("failed")
    const directory = await mkdtemp(path.join(os.tmpdir(), "persona-report-"))
    const file = path.join(directory, "summary.json")
    await writeJsonAtomic(file, summary)
    expect(JSON.parse(await readFile(file, "utf8"))).toEqual(summary)
  })
})
