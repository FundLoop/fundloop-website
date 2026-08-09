import { describe, expect, it } from "vitest"
import { validateEpochProjectPackageWorkflowInput } from "@/lib/edge-functions/epoch-project-package-contract"

const valid = {
  action: "validate" as const, projectSlug: "civic-mesh", cycleKey: "2026-08",
  kybStatus: "passed" as const, kycStatus: "passed" as const, sanctionsStatus: "passed" as const,
  complianceEvidenceHash: "a".repeat(64), complianceValidUntil: "2026-12-01T00:00:00Z",
  maximumCubidScore: "20", cubidTtlHours: 24,
}

describe("epoch project package contract", () => {
  it("accepts exact validation and founder decision shapes", () => {
    expect(validateEpochProjectPackageWorkflowInput(valid)).toMatchObject({ ok: true })
    expect(validateEpochProjectPackageWorkflowInput({ action: "approve", packageId: 1, evidenceHash: "b".repeat(64) })).toMatchObject({ ok: true })
    expect(validateEpochProjectPackageWorkflowInput({ action: "opt_out", packageId: 1, evidenceHash: "b".repeat(64), reason: "Roll forward" })).toMatchObject({ ok: true })
  })
  it("rejects unknown fields, invalid compliance, hashes, time, and maximum score", () => {
    expect(validateEpochProjectPackageWorkflowInput({ ...valid, deploymentEnvironment: "production" })).toMatchObject({ ok: false })
    expect(validateEpochProjectPackageWorkflowInput({ ...valid, kybStatus: "skipped" })).toMatchObject({ ok: false })
    expect(validateEpochProjectPackageWorkflowInput({ ...valid, complianceEvidenceHash: "raw" })).toMatchObject({ ok: false })
    expect(validateEpochProjectPackageWorkflowInput({ ...valid, complianceValidUntil: "later" })).toMatchObject({ ok: false })
    expect(validateEpochProjectPackageWorkflowInput({ ...valid, maximumCubidScore: "0" })).toMatchObject({ ok: false })
  })
  it("requires a reason for opt out and constrains package IDs", () => {
    expect(validateEpochProjectPackageWorkflowInput({ action: "opt_out", packageId: 1, evidenceHash: "b".repeat(64), reason: "" })).toMatchObject({ ok: false })
    expect(validateEpochProjectPackageWorkflowInput({ action: "approve", packageId: 0, evidenceHash: "b".repeat(64) })).toMatchObject({ ok: false })
  })
  it("keeps runtime environment and actor identity server-owned", () => {
    expect(validateEpochProjectPackageWorkflowInput({ action: "finalize_silent", actorUserId: "crafted" })).toMatchObject({ ok: false })
    expect(validateEpochProjectPackageWorkflowInput({ action: "finalize_silent", observedAt: "2030-01-01T00:00:00Z" })).toMatchObject({ ok: false })
    expect(validateEpochProjectPackageWorkflowInput({ ...valid, observedAt: "2030-01-01T00:00:00Z" })).toMatchObject({ ok: false })
    expect(validateEpochProjectPackageWorkflowInput({ action: "approve", packageId: 4, evidenceHash: "b".repeat(64), decidedAt: "2030-01-01T00:00:00Z" })).toMatchObject({ ok: false })
    expect(validateEpochProjectPackageWorkflowInput({ action: "send_reconciliation_email", packageId: 4, providerKey: "resend" })).toMatchObject({ ok: false })
  })
})
