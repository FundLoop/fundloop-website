import { describe, expect, it } from "vitest"
import { edgeCommandSuccess, type EdgeCommandResult } from "@/lib/edge-functions/result"
import { registerProjectMemberAndOperatorMcpTools } from "@/packages/mcp-server/src/member-operator-tools"
import { createBaseMcpToolRegistry } from "@/packages/mcp-server/src/tools"
import type { EdgeCommandClient } from "@/packages/mcp-server/src/edge-client"
import type { OperatorWorkflowReader, ProjectMemberWorkflowReader } from "@/packages/mcp-server/src/member-operator-readers"

const auth = {
  actorRole: "internal_operator" as const,
  bearerToken: "token",
  userId: "operator-1",
  email: "maya@fundloop.example.com",
  isInternalOperator: true,
}

const edge: EdgeCommandClient = {
  async invoke<TInput, TOutput>(functionName: string, input: TInput): Promise<EdgeCommandResult<TOutput>> {
    return edgeCommandSuccess({ functionName, input }) as EdgeCommandResult<TOutput>
  },
}

const projectMemberReader: ProjectMemberWorkflowReader = {
  async getProjectReportingStatus(input) {
    return {
      projectSlug: input.projectSlug,
      cycleKey: input.cycleKey ?? "2026-04",
      reports: { founderReportCount: 1, artifactCount: 1 },
      attribution: { approvedDatasetCount: 2, pendingDatasetCount: 0 },
    }
  },
}

const operatorReader: OperatorWorkflowReader = {
  async listCycleStatuses() {
    return [
      {
        cycleKey: "2026-04",
        status: "reporting",
        lockedAt: "2026-05-01T00:00:00Z",
        calculationStartedAt: "2026-05-02T00:00:00Z",
        distributionStartedAt: "2026-05-03T00:00:00Z",
        reportingPublishedAt: "2026-05-04T00:00:00Z",
      },
    ]
  },
  async listCycleEvents(input) {
    return [
      {
        cycleKey: input.cycleKey ?? "2026-04",
        eventType: "reporting_publication_success",
        outcome: "success",
        severity: "info",
        attemptId: input.attemptId ?? "attempt-1",
        message: "Published.",
        createdAt: "2026-05-04T00:00:00Z",
      },
    ]
  },
  async getReconciliationVisibility() {
    return { submitted: 1, confirming: 1, awaitingConfirmation: 2, confirmed: 5, failed: 0 }
  },
  async getReportingCoverage(input) {
    return {
      cycleKey: input.cycleKey ?? "2026-04",
      publicReports: 1,
      userReports: 12,
      founderReports: 2,
      operatorReports: 1,
      artifactCount: 16,
    }
  },
}

function createRegistry() {
  const registry = createBaseMcpToolRegistry()
  registerProjectMemberAndOperatorMcpTools(registry)
  return registry
}

describe("project-member and operator MCP tools", () => {
  it("registers project-member and operator read tools", () => {
    expect(createRegistry().list().map((tool) => tool.name)).toEqual(
      expect.arrayContaining([
        "project_member.project.reporting_status",
        "operator.cycles.list",
        "operator.cycle.observability",
        "operator.payments.reconciliation_visibility",
        "operator.reporting.coverage",
      ]),
    )
  })

  it("reads project-member reporting status", async () => {
    const result = await createRegistry().call(
      "project_member.project.reporting_status",
      { projectSlug: "civic-mesh", cycleKey: "2026-04" },
      { auth, edge, projectMemberReader, operatorReader },
    )

    expect(result.content[0]?.text).toContain("civic-mesh")
    expect(result.content[0]?.text).toContain("approvedDatasetCount")
  })

  it("reads operator cycle, observability, reconciliation, and reporting visibility", async () => {
    const registry = createRegistry()
    const context = { auth, edge, projectMemberReader, operatorReader }

    await expect(registry.call("operator.cycles.list", {}, context)).resolves.toMatchObject({
      content: [expect.objectContaining({ text: expect.stringContaining("reporting") })],
    })
    await expect(registry.call("operator.cycle.observability", { cycleKey: "2026-04" }, context)).resolves.toMatchObject({
      content: [expect.objectContaining({ text: expect.stringContaining("reporting_publication_success") })],
    })
    await expect(registry.call("operator.payments.reconciliation_visibility", {}, context)).resolves.toMatchObject({
      content: [expect.objectContaining({ text: expect.stringContaining("awaitingConfirmation") })],
    })
    await expect(registry.call("operator.reporting.coverage", { cycleKey: "2026-04" }, context)).resolves.toMatchObject({
      content: [expect.objectContaining({ text: expect.stringContaining("artifactCount") })],
    })
  })

  it("returns protocol-visible errors when required readers are missing", async () => {
    const registry = createRegistry()
    const memberResult = await registry.call("project_member.project.reporting_status", { projectSlug: "civic-mesh" }, { auth, edge })
    const operatorResult = await registry.call("operator.cycles.list", {}, { auth, edge })

    expect(memberResult.isError).toBe(true)
    expect(operatorResult.isError).toBe(true)
  })
})
