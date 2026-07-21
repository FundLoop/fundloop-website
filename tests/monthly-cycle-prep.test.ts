import { describe, expect, it } from "vitest"
import { buildMonthlyCyclePrepReview } from "@/lib/monthly-cycles/monthly-cycle-prep"

const baseManifest = {
  version: "monthly-cycle-lock.v1",
  locked_at: "2026-05-01T00:00:00.000Z",
  override: {
    unresolved_onchain: false,
    reason: null,
  },
  payments: [{ id: 10, project_id: 7 }],
  reconciliation: [{ id: 30, status: "confirmed" }],
  identity_snapshots: [
    {
      user_id: "user-1",
      cubid_identity_status: "linked",
      primary_email: "person@example.com",
      last_synced_at: "2026-04-30T00:00:00.000Z",
    },
  ],
  zkas_inputs: {
    datasets: [{ id: 20, status: "approved" }],
    identity_artifacts: [{ id: 21, status: "approved" }],
  },
  counts: {
    payments: 1,
    onchainSubmissions: 1,
    unresolvedOnchainSubmissions: 0,
    identitySnapshots: 1,
    approvedDatasets: 1,
    identityArtifacts: 1,
  },
}

const baseAttributionReadiness = {
  totalCount: 1,
  draftCount: 0,
  submittedCount: 0,
  approvedCount: 1,
  rejectedCount: 0,
  reviewRequiredCount: 0,
  totalRowCount: 2,
  totalAttributionPoints: 5,
  datasets: [],
  readError: null,
}

function baseCycle(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    cycle_key: "2026-04",
    period_start: "2026-04-01",
    period_end: "2026-04-30",
    status: "locked" as const,
    locked_at: "2026-05-01T00:00:00.000Z",
    locked_manifest: baseManifest,
    locked_manifest_hash: "hash-1",
    lock_override_unresolved_onchain: false,
    lock_override_reason: null,
    prep_started_at: null,
    ...overrides,
  }
}

describe("buildMonthlyCyclePrepReview", () => {
  it("marks a complete locked manifest as ready", async () => {
    const review = await buildMonthlyCyclePrepReview({
      cycle: baseCycle(),
      computedManifestHash: "hash-1",
      liveCounts: {
        payments: 1,
        onchainSubmissions: 1,
        approvedDatasets: 1,
        identityArtifacts: 1,
      },
      contributionReadiness: {
        submittedCount: 1,
        expectedProjectCount: 1,
        missingProjectCount: 0,
        totalUsdEquivalentAmount: 1000,
        totalCalculatedContributionAmount: 10,
        missingProjects: [],
        readError: null,
      },
      attributionReadiness: baseAttributionReadiness,
    })

    expect(review.posture).toBe("ready")
    expect(review.issues).toEqual([])
    expect(review.liveDriftWarnings).toEqual([])
    expect(review.manifest.hashMatches).toBe(true)
  })

  it("warns when committed projects are missing contribution submissions", async () => {
    const review = await buildMonthlyCyclePrepReview({
      cycle: baseCycle(),
      computedManifestHash: "hash-1",
      contributionReadiness: {
        submittedCount: 1,
        expectedProjectCount: 2,
        missingProjectCount: 1,
        totalUsdEquivalentAmount: 1000,
        totalCalculatedContributionAmount: 10,
        missingProjects: [{ id: 11, slug: "mutual-aid-atlas", name: "Mutual Aid Atlas" }],
        readError: null,
      },
      attributionReadiness: baseAttributionReadiness,
    })

    expect(review.posture).toBe("needs_review")
    expect(review.contributionReadiness.missingProjects).toEqual([{ id: 11, slug: "mutual-aid-atlas", name: "Mutual Aid Atlas" }])
    expect(review.issues).toContainEqual(
      expect.objectContaining({
        code: "missing_contribution_submissions",
        severity: "warning",
      }),
    )
  })

  it("degrades contribution submission read failures to prep warnings", async () => {
    const review = await buildMonthlyCyclePrepReview({
      cycle: baseCycle(),
      computedManifestHash: "hash-1",
      contributionReadiness: {
        submittedCount: 0,
        expectedProjectCount: 0,
        missingProjectCount: 0,
        totalUsdEquivalentAmount: 0,
        totalCalculatedContributionAmount: 0,
        missingProjects: [],
        readError: "relation unavailable",
      },
      attributionReadiness: baseAttributionReadiness,
    })

    expect(review.posture).toBe("needs_review")
    expect(review.issues).toContainEqual(
      expect.objectContaining({
        code: "contribution_submission_read_failed",
        severity: "warning",
      }),
    )
  })

  it("warns when submitted attribution datasets still need operator review", async () => {
    const review = await buildMonthlyCyclePrepReview({
      cycle: baseCycle(),
      computedManifestHash: "hash-1",
      attributionReadiness: {
        totalCount: 1,
        draftCount: 0,
        submittedCount: 1,
        approvedCount: 0,
        rejectedCount: 0,
        reviewRequiredCount: 1,
        totalRowCount: 2,
        totalAttributionPoints: 5,
        datasets: [
          {
            id: 21,
            projectId: 7,
            projectSlug: "civic-mesh",
            projectName: "Civic Mesh",
            status: "submitted",
            rowCount: 2,
            totalAttributionPoints: 5,
            note: null,
            submittedAt: "2026-04-30T12:00:00Z",
            updatedAt: "2026-04-30T12:00:00Z",
          },
        ],
        readError: null,
      },
    })

    expect(review.posture).toBe("needs_review")
    expect(review.attributionReadiness.reviewRequiredCount).toBe(1)
    expect(review.issues).toContainEqual(
      expect.objectContaining({
        code: "attribution_datasets_need_review",
        severity: "warning",
      }),
    )
  })

  it("degrades attribution dataset read failures to prep warnings", async () => {
    const review = await buildMonthlyCyclePrepReview({
      cycle: baseCycle(),
      computedManifestHash: "hash-1",
      attributionReadiness: {
        totalCount: 0,
        draftCount: 0,
        submittedCount: 0,
        approvedCount: 0,
        rejectedCount: 0,
        reviewRequiredCount: 0,
        totalRowCount: 0,
        totalAttributionPoints: 0,
        datasets: [],
        readError: "relation unavailable",
      },
    })

    expect(review.posture).toBe("needs_review")
    expect(review.issues).toContainEqual(
      expect.objectContaining({
        code: "attribution_dataset_read_failed",
        severity: "warning",
      }),
    )
  })

  it("blocks prep when a cycle is not locked or has no manifest", async () => {
    const review = await buildMonthlyCyclePrepReview({
      cycle: baseCycle({
        status: "open",
        locked_manifest: null,
        locked_manifest_hash: null,
      }),
    })

    expect(review.posture).toBe("not_locked")
    expect(review.issues.map((issue) => issue.code)).toEqual(["cycle_not_locked", "manifest_missing"])
  })

  it("surfaces unresolved onchain override as needs-review instead of ready", async () => {
    const review = await buildMonthlyCyclePrepReview({
      cycle: baseCycle({
        lock_override_unresolved_onchain: true,
        lock_override_reason: "Operator accepted pending tx risk.",
        locked_manifest: {
          ...baseManifest,
          override: {
            unresolved_onchain: true,
            reason: "Operator accepted pending tx risk.",
          },
          reconciliation: [{ id: 30, status: "confirming" }],
          counts: {
            ...baseManifest.counts,
            unresolvedOnchainSubmissions: 1,
          },
        },
      }),
      computedManifestHash: "hash-1",
      attributionReadiness: baseAttributionReadiness,
    })

    expect(review.posture).toBe("needs_review")
    expect(review.issues).toContainEqual(
      expect.objectContaining({
        code: "unresolved_onchain_submissions",
        severity: "warning",
      }),
    )
  })

  it("blocks missing zkAS and CUBID-linked identity inputs", async () => {
    const review = await buildMonthlyCyclePrepReview({
      cycle: baseCycle({
        locked_manifest: {
          ...baseManifest,
          identity_snapshots: [{ user_id: "user-1", cubid_identity_status: "unlinked" }],
          zkas_inputs: {
            datasets: [],
            identity_artifacts: [],
          },
          counts: {
            ...baseManifest.counts,
            identitySnapshots: 1,
            approvedDatasets: 0,
            identityArtifacts: 0,
          },
        },
      }),
      computedManifestHash: "hash-1",
      attributionReadiness: baseAttributionReadiness,
    })

    expect(review.posture).toBe("blocked")
    expect(review.issues.map((issue) => issue.code)).toEqual(
      expect.arrayContaining(["missing_approved_datasets", "missing_identity_artifacts", "identity_not_linked"]),
    )
  })

  it("reports live-row drift as informational only", async () => {
    const review = await buildMonthlyCyclePrepReview({
      cycle: baseCycle(),
      computedManifestHash: "hash-1",
      liveCounts: {
        payments: 2,
      },
      attributionReadiness: baseAttributionReadiness,
    })

    expect(review.posture).toBe("ready")
    expect(review.liveDriftWarnings).toEqual([
      expect.objectContaining({
        code: "live_drift_payments",
        severity: "info",
      }),
    ])
  })
})
