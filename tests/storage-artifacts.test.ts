import { describe, expect, it } from "vitest"
import {
  buildAuditProofArtifactPath,
  buildBookkeepingExportArtifactPath,
  buildMonthlyCycleReportArtifactPath,
  buildMonthlyCycleReportPublicationPath,
  buildOnboardingUploadArtifactPath,
  buildProjectAssetArtifactPath,
  assertSafeStorageObjectPath,
  assertZkasRunDownloadArtifactPath,
  buildZkasDatasetArtifactPath,
  buildZkasIdentityArtifactPath,
  buildZkasRunArtifactPath,
  normalizeStorageArtifactReference,
  STORAGE_BUCKETS,
} from "@/lib/storage/artifacts"

describe("storage artifact paths", () => {
  it("builds exact immutable monthly report paths for every audience including MCP", () => {
    const hash = "a".repeat(64)
    const token = "b".repeat(64)
    expect(buildMonthlyCycleReportPublicationPath({ cycleKey: "2026-07", closePackageId: 7, audience: "mcp", pathToken: token, version: 2, artifactHash: hash }))
      .toBe(`2026-07/close-7/v2/mcp/${token}-${hash}.json`)
    expect(buildMonthlyCycleReportPublicationPath({ cycleKey: "2026-07", closePackageId: 7, audience: "user", pathToken: token, version: 1, artifactHash: hash }))
      .toBe(`2026-07/close-7/v1/user/${token}-${hash}.json`)
    expect(() => buildMonthlyCycleReportPublicationPath({ cycleKey: "bad", closePackageId: 7, audience: "public", pathToken: token, version: 1, artifactHash: hash })).toThrow()
    expect(() => buildMonthlyCycleReportPublicationPath({ cycleKey: "2026-07", closePackageId: 7, audience: "user", pathToken: "raw-user-id", version: 1, artifactHash: hash })).toThrow()
  })
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

  it("rejects unsafe storage paths before private artifact download", () => {
    expect(assertSafeStorageObjectPath("2026-04/run-12/run-result.v1.json")).toBe("2026-04/run-12/run-result.v1.json")
    expect(() => assertSafeStorageObjectPath("../secret.json")).toThrow("unsafe")
    expect(() => assertSafeStorageObjectPath("/2026-04/run-12/run-result.v1.json")).toThrow("relative")
    expect(() => assertSafeStorageObjectPath("2026-04//run-12/run-result.v1.json")).toThrow("relative")
  })

  it("requires zkAS download paths to match cycle, run, and artifact kind", () => {
    expect(
      assertZkasRunDownloadArtifactPath({
        cycleKey: "2026-04",
        runId: 12,
        artifact: "result",
        path: "2026-04/run-12/run-result.v1.json",
      }),
    ).toBe("2026-04/run-12/run-result.v1.json")

    expect(() =>
      assertZkasRunDownloadArtifactPath({
        cycleKey: "2026-04",
        runId: 12,
        artifact: "result",
        path: "2026-04/run-13/run-result.v1.json",
      }),
    ).toThrow("required artifact prefix")

    expect(() =>
      assertZkasRunDownloadArtifactPath({
        cycleKey: "2026-04",
        runId: 12,
        artifact: "attestation",
        path: "2026-04/run-12/run-result.v1.json",
      }),
    ).toThrow("artifact kind")
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
