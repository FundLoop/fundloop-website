import { describe, expect, it } from "vitest"
import {
  buildAuditProofArtifactPath,
  buildBookkeepingExportArtifactPath,
  buildMonthlyCycleReportArtifactPath,
  buildOnboardingUploadArtifactPath,
  buildProjectAssetArtifactPath,
  buildZkasDatasetArtifactPath,
  buildZkasIdentityArtifactPath,
  buildZkasRunArtifactPath,
  normalizeStorageArtifactReference,
  STORAGE_BUCKETS,
} from "@/lib/storage/artifacts"

describe("storage artifact paths", () => {
  it("builds canonical zkAS artifact paths", () => {
    expect(
      buildZkasDatasetArtifactPath({
        cycleKey: "2026-04",
        projectId: 7,
        fileHash: "abc123",
        format: "csv",
      }),
    ).toBe("2026-04/project-7/dataset-abc123.csv")

    expect(buildZkasIdentityArtifactPath({ cycleKey: "2026-04", artifactHash: "identity-hash" })).toBe(
      "2026-04/identity-identity-hash.json",
    )

    expect(buildZkasRunArtifactPath({ cycleKey: "2026-04", cycleId: 1, artifact: "calculation-package" })).toBe(
      "2026-04/cycle-1/calculation-package.v1.json",
    )

    expect(buildZkasRunArtifactPath({ cycleKey: "2026-04", runId: 12, artifact: "run-manifest" })).toBe(
      "2026-04/run-12/run-manifest.v1.json",
    )

    expect(buildZkasRunArtifactPath({ cycleKey: "2026-04", runId: 12, artifact: "run-result" })).toBe(
      "2026-04/run-12/run-result.v1.json",
    )
  })

  it("builds canonical report and operational artifact paths", () => {
    expect(
      buildMonthlyCycleReportArtifactPath({
        cycleKey: "2026-04",
        audience: "founder",
        subjectId: 7,
        fileName: "Founder Report.md",
      }),
    ).toBe("2026-04/founder/7/Founder-Report.md")

    expect(buildProjectAssetArtifactPath({ projectId: 7, fileName: "Logo Final.svg" })).toBe("project-7/Logo-Final.svg")
    expect(buildOnboardingUploadArtifactPath({ userId: "User 1", flow: "project", fileName: "Proof.pdf" })).toBe(
      "user-user-1/project/Proof.pdf",
    )
    expect(buildBookkeepingExportArtifactPath({ cycleKey: "2026-04", fileName: "Payouts.csv" })).toBe("2026-04/Payouts.csv")
    expect(buildAuditProofArtifactPath({ cycleKey: "2026-04", proofType: "Lock Override", fileName: "Reason.txt" })).toBe(
      "2026-04/lock-override/Reason.txt",
    )
  })

  it("rejects invalid cycle keys and empty file names", () => {
    expect(() => buildZkasRunArtifactPath({ cycleKey: "2026-13", runId: 1, artifact: "run-result" })).toThrow("YYYY-MM")
    expect(() => buildMonthlyCycleReportArtifactPath({ cycleKey: "2026-04", audience: "public", fileName: "  " })).toThrow(
      "file names",
    )
  })

  it("normalizes artifact references with lifecycle metadata", () => {
    expect(
      normalizeStorageArtifactReference({
        bucket: STORAGE_BUCKETS.monthlyCycleReports,
        path: "2026-04/public/report.md",
        kind: "monthly_cycle_report",
        mimeType: "text/markdown",
        hash: "hash",
        visibility: "public_read_model",
        retention: "published",
      }),
    ).toEqual({
      bucket: "monthly-cycle-reports",
      path: "2026-04/public/report.md",
      kind: "monthly_cycle_report",
      mimeType: "text/markdown",
      hash: "hash",
      visibility: "public_read_model",
      retention: "published",
    })

    expect(
      normalizeStorageArtifactReference({
        bucket: STORAGE_BUCKETS.auditProofs,
        path: "  ",
        kind: "audit_proof",
      }),
    ).toBeNull()
  })
})
