import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

interface Goal158Evidence {
  contractVersion: string
  candidate: { certifiedDevGitSha: string }
  devDeployment: {
    githubRunAttempt: number
    manifestSha256: string
    migrations: { trackedCount: number; observedCount: number }
    schema: { postgresMajor: number; expectedSha256: string; observedSha256: string }
    functions: { expectedCount: number; observedCount: number; activeCount: number; sourceMismatchCount: number }
    safeRuntime: { authenticatedPublicHealthStatus: number; unauthorizedMutationStatus: number }
    valueFlow: { enabledTableCount: number; productionValueFlowEnabledCount: number }
  }
  devDriftObservation: { certifiedDeploymentManifestSha256: string; blockingDriftCount: number }
  githubControls: {
    requiredChecks: string[]
    requiredCheckAppId: number
    exactHeadCheckRunReadback: { gitSha: string; appId: number; names: string[] }
    branches: Record<"dev" | "main", { pullRequestRequired: boolean; adminEnforcement: boolean; strictChecks: boolean; forcePushAllowed: boolean; deletionAllowed: boolean }>
    production: { allowedBranch: string; adminBypassAllowed: boolean; requiredReviewerId: number }
  }
  productionRehearsal: { approvalBoundaryReached: boolean; jobStepsStarted: number; approvalSubmitted: boolean; branchPolicyRejected: boolean; mainRefApprovalPause: string }
  authority: Record<string, boolean>
}

const evidence = JSON.parse(
  readFileSync("docs/engineering/goal-158-delivery-integrity-evidence.json", "utf8"),
) as Goal158Evidence

describe("Goal #158 delivery-integrity evidence", () => {
  it("binds one exact completed Dev deployment and retained drift observation", () => {
    expect(evidence.contractVersion).toBe("fundloop.goal-158-delivery-integrity/v1")
    expect(evidence.candidate.certifiedDevGitSha).toMatch(/^[0-9a-f]{40}$/)
    expect(evidence.devDeployment.githubRunAttempt).toBe(2)
    expect(evidence.devDeployment.migrations).toMatchObject({ trackedCount: 96, observedCount: 96 })
    expect(evidence.devDeployment.schema.postgresMajor).toBe(17)
    expect(evidence.devDeployment.schema.expectedSha256).toBe(evidence.devDeployment.schema.observedSha256)
    expect(evidence.devDeployment.functions).toMatchObject({ expectedCount: 62, observedCount: 62, activeCount: 62, sourceMismatchCount: 0 })
    expect(evidence.devDriftObservation.certifiedDeploymentManifestSha256).toBe(evidence.devDeployment.manifestSha256)
    expect(evidence.devDriftObservation.blockingDriftCount).toBe(0)
  })

  it("retains the safe-read, denial, protection, and disabled-authority boundaries", () => {
    expect(evidence.devDeployment.safeRuntime).toMatchObject({ authenticatedPublicHealthStatus: 200, unauthorizedMutationStatus: 401 })
    expect(evidence.devDeployment.valueFlow).toMatchObject({ enabledTableCount: 0, productionValueFlowEnabledCount: 0 })
    expect(evidence.githubControls.requiredChecks).toEqual([
      "validate",
      "Supabase fresh-schema replay",
      "Supabase dry-run",
    ])
    expect(evidence.githubControls.requiredCheckAppId).toBe(15368)
    expect(evidence.githubControls.exactHeadCheckRunReadback).toMatchObject({
      gitSha: expect.stringMatching(/^[0-9a-f]{40}$/),
      appId: evidence.githubControls.requiredCheckAppId,
      names: evidence.githubControls.requiredChecks,
    })
    expect(evidence.githubControls.requiredChecks).not.toEqual(expect.arrayContaining([
      "CI / validate",
      "CI / Supabase fresh-schema replay",
    ]))
    for (const branch of ["dev", "main"] as const) {
      expect(evidence.githubControls.branches[branch]).toMatchObject({
        pullRequestRequired: true,
        adminEnforcement: true,
        strictChecks: true,
        forcePushAllowed: false,
        deletionAllowed: false,
      })
    }
    expect(evidence.githubControls.production).toMatchObject({ allowedBranch: "main", adminBypassAllowed: false, requiredReviewerId: 98373366 })
    expect(evidence.productionRehearsal).toMatchObject({ approvalBoundaryReached: true, jobStepsStarted: 0, approvalSubmitted: false, branchPolicyRejected: true, mainRefApprovalPause: "deferred-to-human-release-boundary" })
    expect(Object.values(evidence.authority)).toEqual(expect.arrayContaining([false]))
    expect(Object.values(evidence.authority).every((enabled) => enabled === false)).toBe(true)
  })
})
