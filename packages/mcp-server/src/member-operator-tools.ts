import { errorResult, jsonTextResult } from "./protocol.ts"
import type { ProjectMemberReportingStatus } from "./member-operator-readers.ts"
import type { McpToolRegistry } from "./tools.ts"

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value))
}

function readOptionalString(input: unknown, key: string) {
  return isRecord(input) && typeof input[key] === "string" && input[key].trim() ? input[key].trim() : undefined
}

function readRequiredString(input: unknown, key: string) {
  return readOptionalString(input, key) ?? null
}

function deriveReportingStatusNextActions(status: ProjectMemberReportingStatus) {
  const actions: string[] = []
  if (!status.cycleKey) {
    actions.push("Confirm the project is attached to an active monthly cycle.")
  }
  if (status.attribution.pendingDatasetCount > 0) {
    actions.push("Review pending attribution datasets.")
  }
  if (status.attribution.approvedDatasetCount === 0) {
    actions.push("Submit or approve attribution data for this cycle.")
  }
  if (status.reports.founderReportCount === 0) {
    actions.push("Wait for founder reporting to be published for this cycle.")
  }

  return actions
}

export function registerProjectMemberAndOperatorMcpTools(registry: McpToolRegistry) {
  registry.register({
    definition: {
      name: "project_member.project.reporting_status",
      title: "Read Project Member Reporting Status",
      description: "Read project reporting and attribution status for a project member visible project.",
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: false,
      },
      inputSchema: {
        type: "object",
        properties: {
          projectSlug: { type: "string", format: "slug", minLength: 1, maxLength: 80 },
          cycleKey: { type: "string", format: "cycle_key" },
        },
        required: ["projectSlug"],
        additionalProperties: false,
      },
      outputSchema: {
        type: "object",
        properties: {
          ok: { type: "boolean" },
          projectSlug: { type: "string" },
          cycleKey: { type: "string" },
          reports: { type: "object" },
          attribution: { type: "object" },
          nextActions: { type: "array" },
        },
        required: ["ok", "projectSlug", "cycleKey", "reports", "attribution", "nextActions"],
        additionalProperties: false,
      },
    },
    async handler(input, context) {
      if (!context.projectMemberReader) {
        return { ...errorResult("Project-member workflow reader is not configured."), errorCode: "reader_not_configured" }
      }
      const projectSlug = readRequiredString(input, "projectSlug")
      if (!projectSlug) return { ...errorResult("projectSlug is required."), errorCode: "invalid_payload" }
      try {
        const status = await context.projectMemberReader.getProjectReportingStatus(
          { projectSlug, cycleKey: readOptionalString(input, "cycleKey") },
          context.auth,
        )

        return jsonTextResult({
          ok: true,
          projectSlug: status.projectSlug,
          cycleKey: status.cycleKey,
          reports: status.reports,
          attribution: status.attribution,
          nextActions: deriveReportingStatusNextActions(status),
        })
      } catch {
        return {
          ...errorResult("Project reporting status is temporarily unavailable."),
          errorCode: "workflow_read_failed",
        }
      }
    },
  })

  registry.register({
    definition: {
      name: "operator.cycles.list",
      description: "List recent monthly cycles and lifecycle statuses for an internal operator.",
      inputSchema: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
    },
    async handler(_input, context) {
      if (!context.operatorReader) return errorResult("Operator workflow reader is not configured.")
      return jsonTextResult(await context.operatorReader.listCycleStatuses(context.auth))
    },
  })

  registry.register({
    definition: {
      name: "operator.cycle.observability",
      description: "Read monthly-cycle observability events by cycle key or attempt id.",
      inputSchema: {
        type: "object",
        properties: {
          cycleKey: { type: "string", format: "cycle_key" },
          attemptId: { type: "string", format: "attempt_id" },
        },
        additionalProperties: false,
      },
    },
    async handler(input, context) {
      if (!context.operatorReader) return errorResult("Operator workflow reader is not configured.")
      return jsonTextResult(
        await context.operatorReader.listCycleEvents(
          { cycleKey: readOptionalString(input, "cycleKey"), attemptId: readOptionalString(input, "attemptId") },
          context.auth,
        ),
      )
    },
  })

  registry.register({
    definition: {
      name: "operator.payments.reconciliation_visibility",
      description: "Read onchain reconciliation status counts for internal operators.",
      inputSchema: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
    },
    async handler(_input, context) {
      if (!context.operatorReader) return errorResult("Operator workflow reader is not configured.")
      return jsonTextResult(await context.operatorReader.getReconciliationVisibility(context.auth))
    },
  })

  registry.register({
    definition: {
      name: "operator.reporting.coverage",
      description: "Read monthly report publication coverage counts for internal operators.",
      inputSchema: {
        type: "object",
        properties: {
          cycleKey: { type: "string", format: "cycle_key" },
        },
        additionalProperties: false,
      },
    },
    async handler(input, context) {
      if (!context.operatorReader) return errorResult("Operator workflow reader is not configured.")
      return jsonTextResult(await context.operatorReader.getReportingCoverage({ cycleKey: readOptionalString(input, "cycleKey") }, context.auth))
    },
  })
}
