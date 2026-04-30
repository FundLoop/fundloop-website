import { describe, expect, it } from "vitest"
import {
  normalizeMonthlyCycleCalculationPackageResult,
  validateMonthlyCycleCalculationPackageInput,
} from "@/lib/edge-functions/monthly-cycle-calculation-package-contract"

describe("monthly-cycle-calculation-package contract", () => {
  it("validates the input payload", () => {
    expect(validateMonthlyCycleCalculationPackageInput({ cycleKey: "2026-04", attemptId: "attempt-1" })).toEqual({
      ok: true,
      data: { cycleKey: "2026-04", attemptId: "attempt-1" },
    })

    expect(validateMonthlyCycleCalculationPackageInput({ cycleKey: "2026-13" })).toMatchObject({
      ok: false,
      error: { code: "invalid_payload" },
    })

    expect(validateMonthlyCycleCalculationPackageInput({ cycleKey: "2026-04", attemptId: 123 })).toMatchObject({
      ok: false,
      error: { code: "invalid_payload" },
    })
  })

  it("normalizes invalid Edge responses", () => {
    expect(normalizeMonthlyCycleCalculationPackageResult({ ok: true, data: { cycleKey: "2026-04" } })).toMatchObject({
      ok: false,
      error: { code: "invalid_edge_response" },
    })

    expect(
      normalizeMonthlyCycleCalculationPackageResult({
        ok: true,
        data: {
          cycleId: 1,
          cycleKey: "2026-04",
          status: "calculation",
          calculationStartedAt: "2026-05-01T00:00:00.000Z",
          runId: 10,
          runStatus: "locked",
          packageArtifactPath: "2026-04/cycle-1/calculation-package.v1.json",
          packageArtifactHash: "hash",
          runManifestHash: "run-hash",
          counts: { datasets: 1, payments: 1, identityArtifacts: 1 },
        },
      }),
    ).toMatchObject({ ok: true, data: { runId: 10 } })
  })
})
