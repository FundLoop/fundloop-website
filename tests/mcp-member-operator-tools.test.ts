import { describe, expect, it } from "vitest"
import { edgeCommandSuccess, type EdgeCommandResult } from "@/lib/edge-functions/result"
import { registerProjectMemberAndOperatorMcpTools } from "@/packages/mcp-server/src/member-operator-tools"
import { createBaseMcpToolRegistry } from "@/packages/mcp-server/src/tools"
import type { EdgeCommandClient } from "@/packages/mcp-server/src/edge-client"
import type { OperatorWorkflowReader, ProjectMemberWorkflowReader, UserWorkflowReader } from "@/packages/mcp-server/src/member-operator-readers"

const auth = {
  actorRole: "internal_operator" as const,
  bearerToken: "token",
  userId: "operator-1",
  email: "maya@fundloop.example.com",
  isInternalOperator: true,
}

const nonOperatorAuth = {
  actorRole: "project_member" as const,
  bearerToken: "member-token",
  userId: "member-1",
  email: "member@example.com",
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

const projectMemberAuth = {
  actorRole: "project_member" as const,
  bearerToken: "member-token",
  userId: "member-1",
  email: "member@example.com",
}

const userReader: UserWorkflowReader = {
  async getWorkspaceSummary() {
    return {
      profileStatus: {
        signedInEmail: "member@example.com",
        cubidIdentityStatus: "linked",
        cubidScore: 82,
        completionPercent: 80,
        missingItems: ["cubid_phone", "cubid_provider"],
        identitySnapshot: {
          primaryEmailPresent: true,
          primaryPhonePresent: false,
          verifiedStampTypes: ["email"],
          lastSyncedAt: "2026-05-01T00:00:00Z",
          lastSyncErrorCode: null,
        },
      },
      participation: {
        joinedProjectCount: 1,
        founderProjectCount: 0,
        favoriteProjectCount: 1,
        recentProjects: [
          {
            slug: "civic-mesh",
            name: "Civic Mesh",
            joinedAt: "2026-04-02T00:00:00Z",
            isFavorite: true,
            isFounderRole: false,
          },
        ],
      },
      results: {
        latest: {
          allocationUsd: 42,
          aggregateScore: 12,
          monthLabel: "2026-04",
          publishedAt: "2026-05-05T00:00:00Z",
        },
        totalAllocationUsd: 42,
        resultCount: 1,
        detailHref: "/workspace/earnings",
      },
      payoutReadiness: {
        routeCount: 1,
        activeRouteCount: 1,
        hasDefaultRoute: true,
        rails: ["evm"],
        nextAction: "Default payout route is configured.",
      },
      discovery: {
        recommendedProjects: [{ slug: "solar-commons", name: "Solar Commons" }],
        nextActions: ["Complete profile and identity readiness in the workspace account area."],
      },
      warnings: [],
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
    const tools = createRegistry().list()
    expect(tools.map((tool) => tool.name)).toEqual(
      expect.arrayContaining([
        "project_member.project.reporting_status",
        "user.workspace.summary",
        "operator.cycles.list",
        "operator.cycle.observability",
        "operator.payments.reconciliation_visibility",
        "operator.reporting.coverage",
      ]),
    )
    expect(tools.find((tool) => tool.name === "project_member.project.reporting_status")).toMatchObject({
      title: "Read Project Member Reporting Status",
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
      outputSchema: expect.objectContaining({
        required: expect.arrayContaining(["ok", "projectSlug", "cycleKey", "reports", "attribution", "nextActions"]),
      }),
    })
    expect(tools.find((tool) => tool.name === "user.workspace.summary")).toMatchObject({
      title: "Read User Workspace Summary",
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
      inputSchema: expect.objectContaining({
        additionalProperties: false,
      }),
      outputSchema: expect.objectContaining({
        required: expect.arrayContaining(["ok", "profileStatus", "participation", "results", "payoutReadiness", "discovery", "warnings"]),
      }),
    })
    expect(tools.find((tool) => tool.name === "operator.cycles.list")).toMatchObject({
      title: "List Operator Monthly Cycles",
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
      outputSchema: expect.objectContaining({
        required: expect.arrayContaining(["ok", "count", "cycles"]),
      }),
    })
    expect(tools.find((tool) => tool.name === "operator.cycle.observability")).toMatchObject({
      title: "Read Operator Cycle Observability",
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
      outputSchema: expect.objectContaining({
        required: expect.arrayContaining(["ok", "count", "filters", "events"]),
      }),
    })
    expect(tools.find((tool) => tool.name === "operator.payments.reconciliation_visibility")).toMatchObject({
      title: "Read Operator Payment Reconciliation Visibility",
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
      outputSchema: expect.objectContaining({
        required: expect.arrayContaining(["ok", "counts", "openQueueCount", "warningStates", "nextActions"]),
      }),
    })
    expect(tools.find((tool) => tool.name === "operator.reporting.coverage")).toMatchObject({
      title: "Read Operator Reporting Coverage",
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
      outputSchema: expect.objectContaining({
        required: expect.arrayContaining(["ok", "cycleKey", "counts", "missingAudiences", "warningStates", "nextActions"]),
      }),
    })
  })

  it("reads the authenticated user's workspace summary without raw identity or payout payloads", async () => {
    const result = await createRegistry().call("user.workspace.summary", {}, { auth: projectMemberAuth, edge, userReader, projectMemberReader, operatorReader })

    expect(result.content[0]?.text).toContain("completionPercent")
    expect(result.structuredContent).toMatchObject({
      ok: true,
      profileStatus: {
        signedInEmail: "member@example.com",
        cubidIdentityStatus: "linked",
        cubidScore: 82,
        completionPercent: 80,
        identitySnapshot: {
          primaryEmailPresent: true,
          primaryPhonePresent: false,
          verifiedStampTypes: ["email"],
        },
      },
      participation: {
        joinedProjectCount: 1,
        favoriteProjectCount: 1,
        recentProjects: [expect.objectContaining({ slug: "civic-mesh", name: "Civic Mesh" })],
      },
      results: {
        latest: expect.objectContaining({ allocationUsd: 42, monthLabel: "2026-04" }),
        totalAllocationUsd: 42,
        resultCount: 1,
      },
      payoutReadiness: {
        routeCount: 1,
        activeRouteCount: 1,
        hasDefaultRoute: true,
        rails: ["evm"],
      },
      discovery: {
        recommendedProjects: [{ slug: "solar-commons", name: "Solar Commons" }],
      },
    })
    expect(JSON.stringify(result.structuredContent)).not.toContain("raw_identity")
    expect(JSON.stringify(result.structuredContent)).not.toContain("destination")
    expect(JSON.stringify(result.structuredContent)).not.toContain("cubid_user_id")
  })

  it("returns user workspace empty states and partial read warnings", async () => {
    const emptyUserReader: UserWorkflowReader = {
      async getWorkspaceSummary() {
        return {
          profileStatus: {
            signedInEmail: "member@example.com",
            cubidIdentityStatus: "unlinked",
            cubidScore: null,
            completionPercent: 0,
            missingItems: ["display_name", "cubid_link"],
            identitySnapshot: null,
          },
          participation: { joinedProjectCount: 0, founderProjectCount: 0, favoriteProjectCount: 0, recentProjects: [] },
          results: { latest: null, totalAllocationUsd: 0, resultCount: 0, detailHref: "/workspace/earnings" },
          payoutReadiness: {
            routeCount: 0,
            activeRouteCount: 0,
            hasDefaultRoute: false,
            rails: [],
            nextAction: "Add a payout route before monthly payouts are ready.",
          },
          discovery: {
            recommendedProjects: [],
            nextActions: [
              "Explore active public projects and join one to build participation signal.",
              "Add a payout route before monthly payouts are ready.",
            ],
          },
          warnings: [{ scope: "results", message: "partial read" }],
        }
      },
    }

    const result = await createRegistry().call("user.workspace.summary", {}, { auth: projectMemberAuth, edge, userReader: emptyUserReader, projectMemberReader, operatorReader })

    expect(result.structuredContent).toMatchObject({
      ok: true,
      participation: { joinedProjectCount: 0, recentProjects: [] },
      results: { latest: null, totalAllocationUsd: 0, resultCount: 0 },
      warnings: [{ scope: "results", message: "partial read" }],
    })
  })

  it("reads project-member reporting status", async () => {
    const result = await createRegistry().call(
      "project_member.project.reporting_status",
      { projectSlug: "civic-mesh", cycleKey: "2026-04" },
      { auth: projectMemberAuth, edge, projectMemberReader, operatorReader },
    )

    expect(result.content[0]?.text).toContain("civic-mesh")
    expect(result.content[0]?.text).toContain("approvedDatasetCount")
    expect(result.structuredContent).toMatchObject({
      ok: true,
      projectSlug: "civic-mesh",
      cycleKey: "2026-04",
      reports: { founderReportCount: 1, artifactCount: 1 },
      attribution: { approvedDatasetCount: 2, pendingDatasetCount: 0 },
      nextActions: [],
    })
  })

  it("returns next actions when project-member reporting data is incomplete", async () => {
    const emptyReader: ProjectMemberWorkflowReader = {
      async getProjectReportingStatus(input) {
        return {
          projectSlug: input.projectSlug,
          cycleKey: null,
          reports: { founderReportCount: 0, artifactCount: 0 },
          attribution: { approvedDatasetCount: 0, pendingDatasetCount: 1 },
        }
      },
    }
    const result = await createRegistry().call(
      "project_member.project.reporting_status",
      { projectSlug: "civic-mesh" },
      { auth: projectMemberAuth, edge, projectMemberReader: emptyReader, operatorReader },
    )

    expect(result.structuredContent).toMatchObject({
      ok: true,
      cycleKey: null,
      nextActions: [
        "Confirm the project is attached to an active monthly cycle.",
        "Review pending attribution datasets.",
        "Submit or approve attribution data for this cycle.",
        "Wait for founder reporting to be published for this cycle.",
      ],
    })
    expect(result.content[0]?.text).not.toContain("artifact_path")
  })

  it("rejects invalid project-member reporting input before the reader runs", async () => {
    const result = await createRegistry().call(
      "project_member.project.reporting_status",
      { projectSlug: "civic-mesh", cycleKey: "2026-99" },
      { auth: projectMemberAuth, edge, projectMemberReader, operatorReader },
    )

    expect(result).toMatchObject({ isError: true, errorCode: "invalid_payload" })
  })

  it("reads operator cycle, observability, reconciliation, and reporting visibility", async () => {
    const registry = createRegistry()
    const context = { auth, edge, projectMemberReader, operatorReader }

    const cycles = await registry.call("operator.cycles.list", {}, context)
    expect(cycles.content[0]?.text).toContain("reporting")
    expect(cycles.structuredContent).toMatchObject({
      ok: true,
      count: 1,
      cycles: [
        {
          cycleKey: "2026-04",
          status: "reporting",
          lockedAt: "2026-05-01T00:00:00Z",
          calculationStartedAt: "2026-05-02T00:00:00Z",
          distributionStartedAt: "2026-05-03T00:00:00Z",
          reportingPublishedAt: "2026-05-04T00:00:00Z",
        },
      ],
    })
    const observability = await registry.call("operator.cycle.observability", { cycleKey: "2026-04" }, context)
    expect(observability.content[0]?.text).toContain("reporting_publication_success")
    expect(observability.structuredContent).toMatchObject({
      ok: true,
      count: 1,
      filters: { cycleKey: "2026-04", attemptId: null },
      events: [
        {
          cycleKey: "2026-04",
          eventType: "reporting_publication_success",
          outcome: "success",
          severity: "info",
          attemptId: "attempt-1",
          message: "Published.",
          createdAt: "2026-05-04T00:00:00Z",
        },
      ],
    })
    const reconciliation = await registry.call("operator.payments.reconciliation_visibility", {}, context)
    expect(reconciliation.content[0]?.text).toContain("awaitingConfirmation")
    expect(reconciliation.structuredContent).toMatchObject({
      ok: true,
      counts: { submitted: 1, confirming: 1, awaitingConfirmation: 2, confirmed: 5, failed: 0 },
      openQueueCount: 4,
      warningStates: ["awaiting_confirmation_queue", "pending_chain_confirmation"],
      nextActions: [
        "Review onchain submissions awaiting operator confirmation.",
        "Let chain confirmation or reconciliation jobs continue before manually confirming payments.",
      ],
    })
    const coverage = await registry.call("operator.reporting.coverage", { cycleKey: "2026-04" }, context)
    expect(coverage.content[0]?.text).toContain("artifactCount")
    expect(coverage.structuredContent).toMatchObject({
      ok: true,
      cycleKey: "2026-04",
      counts: { publicReports: 1, userReports: 12, founderReports: 2, operatorReports: 1, artifactCount: 16 },
      missingAudiences: [],
      warningStates: [],
      nextActions: ["Reporting coverage is complete for the available audience counts."],
    })
  })

  it("returns protocol-visible errors when required readers are missing", async () => {
    const registry = createRegistry()
    const memberResult = await registry.call("project_member.project.reporting_status", { projectSlug: "civic-mesh" }, { auth: projectMemberAuth, edge })
    const operatorResult = await registry.call("operator.cycles.list", {}, { auth, edge })

    expect(memberResult).toMatchObject({ isError: true, errorCode: "reader_not_configured" })
    expect(operatorResult.isError).toBe(true)
  })

  it("blocks non-operators from listing cycles before the handler runs", async () => {
    const forbiddenReader: OperatorWorkflowReader = {
      ...operatorReader,
      async listCycleStatuses() {
        throw new Error("handler should not run")
      },
    }

    const result = await createRegistry().call(
      "operator.cycles.list",
      {},
      { auth: nonOperatorAuth, edge, projectMemberReader, operatorReader: forbiddenReader },
    )

    expect(result).toMatchObject({ isError: true, errorCode: "forbidden" })
    expect(result.content[0]?.text).toContain("internal operator")
  })

  it("blocks non-operators from reading cycle observability before the handler runs", async () => {
    const forbiddenReader: OperatorWorkflowReader = {
      ...operatorReader,
      async listCycleEvents() {
        throw new Error("handler should not run")
      },
    }

    const result = await createRegistry().call(
      "operator.cycle.observability",
      { cycleKey: "2026-04" },
      { auth: nonOperatorAuth, edge, projectMemberReader, operatorReader: forbiddenReader },
    )

    expect(result).toMatchObject({ isError: true, errorCode: "forbidden" })
    expect(result.content[0]?.text).toContain("internal operator")
  })

  it("blocks non-operators from reading reconciliation visibility before the handler runs", async () => {
    const forbiddenReader: OperatorWorkflowReader = {
      ...operatorReader,
      async getReconciliationVisibility() {
        throw new Error("handler should not run")
      },
    }

    const result = await createRegistry().call(
      "operator.payments.reconciliation_visibility",
      {},
      { auth: nonOperatorAuth, edge, projectMemberReader, operatorReader: forbiddenReader },
    )

    expect(result).toMatchObject({ isError: true, errorCode: "forbidden" })
    expect(result.content[0]?.text).toContain("internal operator")
  })

  it("blocks non-operators from reading reporting coverage before the handler runs", async () => {
    const forbiddenReader: OperatorWorkflowReader = {
      ...operatorReader,
      async getReportingCoverage() {
        throw new Error("handler should not run")
      },
    }

    const result = await createRegistry().call(
      "operator.reporting.coverage",
      { cycleKey: "2026-04" },
      { auth: nonOperatorAuth, edge, projectMemberReader, operatorReader: forbiddenReader },
    )

    expect(result).toMatchObject({ isError: true, errorCode: "forbidden" })
    expect(result.content[0]?.text).toContain("internal operator")
  })

  it("rejects invalid reporting coverage filters before the reader runs", async () => {
    const result = await createRegistry().call("operator.reporting.coverage", { cycleKey: "2026-99" }, { auth, edge, projectMemberReader, operatorReader })

    expect(result).toMatchObject({ isError: true, errorCode: "invalid_payload" })
  })

  it("returns reporting coverage gaps and safe next actions", async () => {
    const gapReader: OperatorWorkflowReader = {
      ...operatorReader,
      async getReportingCoverage(input) {
        return {
          cycleKey: input.cycleKey ?? null,
          publicReports: 0,
          userReports: 3,
          founderReports: 0,
          operatorReports: 1,
          artifactCount: 0,
        }
      },
    }
    const result = await createRegistry().call("operator.reporting.coverage", { cycleKey: "2026-04" }, { auth, edge, projectMemberReader, operatorReader: gapReader })

    expect(result.structuredContent).toMatchObject({
      ok: true,
      cycleKey: "2026-04",
      counts: { publicReports: 0, userReports: 3, founderReports: 0, operatorReports: 1, artifactCount: 0 },
      missingAudiences: ["public", "founder"],
      warningStates: ["missing_report_audiences", "missing_report_artifacts"],
      nextActions: [
        "Publish or verify missing report audiences: public, founder.",
        "Verify that report artifacts were generated and attached before treating coverage as complete.",
      ],
    })
    expect(result.content[0]?.text).not.toContain("signedUrl")
  })

  it("returns safe reporting coverage errors when the read gateway fails", async () => {
    const failingReader: OperatorWorkflowReader = {
      ...operatorReader,
      async getReportingCoverage() {
        throw new Error("select artifact_body, signed_storage_url from private_report_table using service_role")
      },
    }
    const result = await createRegistry().call("operator.reporting.coverage", { cycleKey: "2026-04" }, { auth, edge, projectMemberReader, operatorReader: failingReader })

    expect(result).toMatchObject({ isError: true, errorCode: "workflow_read_failed" })
    expect(result.content[0]?.text).toContain("temporarily unavailable")
    expect(result.content[0]?.text).not.toContain("artifact_body")
    expect(result.content[0]?.text).not.toContain("signed_storage_url")
    expect(result.content[0]?.text).not.toContain("service_role")
  })

  it("returns no-action reconciliation guidance for empty queues", async () => {
    const emptyReader: OperatorWorkflowReader = {
      ...operatorReader,
      async getReconciliationVisibility() {
        return { submitted: 0, confirming: 0, awaitingConfirmation: 0, confirmed: 8, failed: 0 }
      },
    }
    const result = await createRegistry().call("operator.payments.reconciliation_visibility", {}, { auth, edge, projectMemberReader, operatorReader: emptyReader })

    expect(result.structuredContent).toMatchObject({
      ok: true,
      openQueueCount: 0,
      warningStates: [],
      nextActions: ["No immediate reconciliation action is required."],
    })
  })

  it("returns failed-submission reconciliation guidance", async () => {
    const failedReader: OperatorWorkflowReader = {
      ...operatorReader,
      async getReconciliationVisibility() {
        return { submitted: 0, confirming: 0, awaitingConfirmation: 0, confirmed: 8, failed: 2 }
      },
    }
    const result = await createRegistry().call("operator.payments.reconciliation_visibility", {}, { auth, edge, projectMemberReader, operatorReader: failedReader })

    expect(result.structuredContent).toMatchObject({
      ok: true,
      openQueueCount: 0,
      warningStates: ["failed_submissions"],
      nextActions: ["Inspect failed onchain submissions in the admin reconciliation console."],
    })
  })

  it("returns safe reconciliation visibility errors when the read gateway fails", async () => {
    const failingReader: OperatorWorkflowReader = {
      ...operatorReader,
      async getReconciliationVisibility() {
        throw new Error("select wallet_private_key, service_role from reconciliation internals")
      },
    }
    const result = await createRegistry().call("operator.payments.reconciliation_visibility", {}, { auth, edge, projectMemberReader, operatorReader: failingReader })

    expect(result).toMatchObject({ isError: true, errorCode: "workflow_read_failed" })
    expect(result.content[0]?.text).toContain("temporarily unavailable")
    expect(result.content[0]?.text).not.toContain("wallet_private_key")
    expect(result.content[0]?.text).not.toContain("service_role")
  })

  it("rejects invalid operator observability filters before the reader runs", async () => {
    const result = await createRegistry().call("operator.cycle.observability", { cycleKey: "2026-99" }, { auth, edge, projectMemberReader, operatorReader })

    expect(result).toMatchObject({ isError: true, errorCode: "invalid_payload" })
  })

  it("returns calm operator observability empty states", async () => {
    const emptyReader: OperatorWorkflowReader = {
      ...operatorReader,
      async listCycleEvents() {
        return []
      },
    }
    const result = await createRegistry().call("operator.cycle.observability", { attemptId: "attempt-1" }, { auth, edge, projectMemberReader, operatorReader: emptyReader })

    expect(result.structuredContent).toMatchObject({
      ok: true,
      count: 0,
      filters: { cycleKey: null, attemptId: "attempt-1" },
      events: [],
      emptyState: "No monthly-cycle events matched the current filters.",
    })
  })

  it("returns safe operator observability errors and redacts event messages", async () => {
    const noisyReader: OperatorWorkflowReader = {
      ...operatorReader,
      async listCycleEvents() {
        return [
          {
            cycleKey: "2026-04",
            eventType: "calculation_failed",
            outcome: "failure",
            severity: "error",
            attemptId: "attempt-1",
            message: "service_role:secret-token " + "x".repeat(400),
            createdAt: "2026-05-04T00:00:00Z",
          },
        ]
      },
    }
    const result = await createRegistry().call("operator.cycle.observability", { cycleKey: "2026-04" }, { auth, edge, projectMemberReader, operatorReader: noisyReader })

    expect(result.content[0]?.text).not.toContain("secret-token")
    expect(JSON.stringify(result.structuredContent)).not.toContain("secret-token")
    expect(result.structuredContent).toMatchObject({
      ok: true,
      events: [expect.objectContaining({ message: expect.stringContaining("[redacted]") })],
    })
  })

  it("returns safe operator observability errors when the read gateway fails", async () => {
    const failingReader: OperatorWorkflowReader = {
      ...operatorReader,
      async listCycleEvents() {
        throw new Error("select payload from private_event_table using service_role")
      },
    }
    const result = await createRegistry().call("operator.cycle.observability", { cycleKey: "2026-04" }, { auth, edge, projectMemberReader, operatorReader: failingReader })

    expect(result).toMatchObject({ isError: true, errorCode: "workflow_read_failed" })
    expect(result.content[0]?.text).toContain("temporarily unavailable")
    expect(result.content[0]?.text).not.toContain("private_event_table")
    expect(result.content[0]?.text).not.toContain("service_role")
  })

  it("returns calm operator cycle empty states", async () => {
    const emptyReader: OperatorWorkflowReader = {
      ...operatorReader,
      async listCycleStatuses() {
        return []
      },
    }
    const result = await createRegistry().call("operator.cycles.list", {}, { auth, edge, projectMemberReader, operatorReader: emptyReader })

    expect(result.structuredContent).toMatchObject({
      ok: true,
      count: 0,
      cycles: [],
      emptyState: "No monthly cycles are available to review.",
    })
  })

  it("returns safe operator cycle errors when the read gateway fails", async () => {
    const failingReader: OperatorWorkflowReader = {
      ...operatorReader,
      async listCycleStatuses() {
        throw new Error("select locked_manifest from private_table using service_role")
      },
    }
    const result = await createRegistry().call("operator.cycles.list", {}, { auth, edge, projectMemberReader, operatorReader: failingReader })

    expect(result).toMatchObject({ isError: true, errorCode: "workflow_read_failed" })
    expect(result.content[0]?.text).toContain("temporarily unavailable")
    expect(result.content[0]?.text).not.toContain("locked_manifest")
    expect(result.content[0]?.text).not.toContain("service_role")
  })

  it("returns safe project-member reporting errors when the read gateway fails", async () => {
    const failingReader: ProjectMemberWorkflowReader = {
      async getProjectReportingStatus() {
        throw new Error("select artifact_path, private manifest from service_role")
      },
    }
    const result = await createRegistry().call(
      "project_member.project.reporting_status",
      { projectSlug: "civic-mesh" },
      { auth: projectMemberAuth, edge, projectMemberReader: failingReader, operatorReader },
    )

    expect(result).toMatchObject({ isError: true, errorCode: "workflow_read_failed" })
    expect(result.content[0]?.text).toContain("temporarily unavailable")
    expect(result.content[0]?.text).not.toContain("artifact_path")
    expect(result.content[0]?.text).not.toContain("service_role")
  })
})
