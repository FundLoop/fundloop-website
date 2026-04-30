import { describe, expect, it } from "vitest"
import { buildMonthlyCycleZkasStage } from "@/lib/monthly-cycles/monthly-cycle-zkas"

function baseCycle(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    cycle_key: "2026-04",
    period_start: "2026-04-01",
    period_end: "2026-04-30",
    status: "locked" as const,
    locked_at: "2026-05-01T00:00:00.000Z",
    prep_started_at: null,
    calculation_started_at: null,
    ...overrides,
  }
}

const approvedDataset = {
  id: 10,
  project_id: 7,
  month: "2026-04",
  status: "approved" as const,
  file_name: "dataset.csv",
  row_count: 25,
  approved_at: "2026-05-01T01:00:00.000Z",
  created_at: "2026-05-01T00:30:00.000Z",
}

const approvedArtifact = {
  id: 11,
  month: "2026-04",
  status: "approved",
  provider: "cubid",
  file_name: "identity.json",
  created_at: "2026-05-01T00:40:00.000Z",
}

const completedRun = {
  id: 20,
  month: "2026-04",
  status: "completed" as const,
  verification_status: "pending" as const,
  usd_pool: 1000,
  user_count: 5,
  total_allocated_usd: 950,
  created_at: "2026-05-01T02:00:00.000Z",
  published_at: null,
}

describe("buildMonthlyCycleZkasStage", () => {
  it("marks an open cycle as not locked even when inputs exist", () => {
    const stage = buildMonthlyCycleZkasStage({
      cycle: baseCycle({ status: "open", locked_at: null }),
      datasets: [approvedDataset],
      identityArtifacts: [approvedArtifact],
      runs: [],
      runResults: [],
      publishedUserResults: [],
      projectSummaries: [],
    })

    expect(stage.posture).toBe("not_locked")
    expect(stage.issues).toContainEqual(expect.objectContaining({ code: "cycle_not_locked", severity: "blocker" }))
  })

  it("blocks when locked cycle inputs are missing", () => {
    const stage = buildMonthlyCycleZkasStage({
      cycle: baseCycle(),
      datasets: [],
      identityArtifacts: [],
      runs: [],
      runResults: [],
      publishedUserResults: [],
      projectSummaries: [],
    })

    expect(stage.posture).toBe("missing_inputs")
    expect(stage.issues.map((issue) => issue.code)).toEqual(
      expect.arrayContaining(["missing_approved_datasets", "missing_identity_artifact"]),
    )
  })

  it("is ready for packaging when approved inputs exist and no run has started", () => {
    const stage = buildMonthlyCycleZkasStage({
      cycle: baseCycle(),
      datasets: [approvedDataset],
      identityArtifacts: [approvedArtifact],
      runs: [],
      runResults: [],
      publishedUserResults: [],
      projectSummaries: [],
    })

    expect(stage.posture).toBe("ready_for_packaging")
    expect(stage.datasets.rowCount).toBe(25)
    expect(stage.identityArtifacts.providers).toEqual(["cubid"])
  })

  it("moves to calculation started once cycle-linked runs exist", () => {
    const stage = buildMonthlyCycleZkasStage({
      cycle: baseCycle(),
      datasets: [approvedDataset],
      identityArtifacts: [approvedArtifact],
      runs: [completedRun],
      runResults: [{ allocation_usd: 950 }],
      publishedUserResults: [],
      projectSummaries: [],
    })

    expect(stage.posture).toBe("calculation_started")
    expect(stage.runs.completed).toBe(1)
    expect(stage.outputs.totalAllocatedUsd).toBe(950)
  })

  it("marks published when user-visible cycle results exist", () => {
    const stage = buildMonthlyCycleZkasStage({
      cycle: baseCycle(),
      datasets: [approvedDataset],
      identityArtifacts: [approvedArtifact],
      runs: [{ ...completedRun, published_at: "2026-05-02T00:00:00.000Z" }],
      runResults: [{ allocation_usd: 950 }],
      publishedUserResults: [{ allocation_usd: 950 }],
      projectSummaries: [{ id: 99 }],
    })

    expect(stage.posture).toBe("published")
    expect(stage.outputs.publishedUserResultCount).toBe(1)
    expect(stage.outputs.projectSummaryCount).toBe(1)
    expect(stage.outputs.totalPublishedAllocationUsd).toBe(950)
  })
})
