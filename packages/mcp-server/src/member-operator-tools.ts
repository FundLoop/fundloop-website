import { errorResult, jsonTextResult } from "./protocol.ts"
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

export function registerProjectMemberAndOperatorMcpTools(registry: McpToolRegistry) {
  registry.register({
    definition: {
      name: "project_member.project.reporting_status",
      description: "Read project reporting and attribution status for a project member visible project.",
      inputSchema: {
        type: "object",
        properties: {
          projectSlug: { type: "string", format: "slug", minLength: 1, maxLength: 80 },
          cycleKey: { type: "string", format: "cycle_key" },
        },
        required: ["projectSlug"],
        additionalProperties: false,
      },
    },
    async handler(input, context) {
      if (!context.projectMemberReader) return errorResult("Project-member workflow reader is not configured.")
      const projectSlug = readRequiredString(input, "projectSlug")
      if (!projectSlug) return errorResult("projectSlug is required.")
      return jsonTextResult(
        await context.projectMemberReader.getProjectReportingStatus(
          { projectSlug, cycleKey: readOptionalString(input, "cycleKey") },
          context.auth,
        ),
      )
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
