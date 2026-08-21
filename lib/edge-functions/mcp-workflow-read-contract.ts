import { edgeCommandFailure, edgeCommandSuccess, type EdgeCommandResult } from "./result.ts"

export const MCP_WORKFLOW_READ_FUNCTION = "mcp-workflow-read"

export type McpWorkflowReadOperation =
  | "user.workspace.summary"
  | "user.payout.routes.list"
  | "founder.projects.list"
  | "founder.project.cycle_status"
  | "project_member.project.reporting_status"
  | "operator.cycles.list"
  | "operator.cycle.observability"
  | "operator.payments.reconciliation_visibility"
  | "operator.reporting.coverage"
  | "reporting.artifacts.read"

export type McpWorkflowReadInput = {
  operation: McpWorkflowReadOperation
  projectSlug?: string
  cycleKey?: string
  attemptId?: string
}

export type McpWorkflowReadOutput = unknown

const operations: readonly McpWorkflowReadOperation[] = [
  "user.workspace.summary",
  "user.payout.routes.list",
  "founder.projects.list",
  "founder.project.cycle_status",
  "project_member.project.reporting_status",
  "operator.cycles.list",
  "operator.cycle.observability",
  "operator.payments.reconciliation_visibility",
  "operator.reporting.coverage",
  "reporting.artifacts.read",
]

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value))
}

function readOptionalString(input: Record<string, unknown>, key: string) {
  if (input[key] === undefined) return edgeCommandSuccess(undefined)
  if (typeof input[key] !== "string") return edgeCommandFailure("invalid_payload", `${key} must be a string when provided.`)
  const trimmed = input[key].trim()
  return edgeCommandSuccess(trimmed || undefined)
}

export function validateMcpWorkflowReadInput(input: unknown): EdgeCommandResult<McpWorkflowReadInput> {
  if (!isPlainObject(input)) {
    return edgeCommandFailure("invalid_payload", "Request body must be a JSON object.")
  }

  if (!operations.includes(input.operation as McpWorkflowReadOperation)) {
    return edgeCommandFailure("invalid_payload", "operation is not supported.")
  }

  const projectSlug = readOptionalString(input, "projectSlug")
  if (!projectSlug.ok) return projectSlug
  const cycleKey = readOptionalString(input, "cycleKey")
  if (!cycleKey.ok) return cycleKey
  const attemptId = readOptionalString(input, "attemptId")
  if (!attemptId.ok) return attemptId

  if (
    (input.operation === "founder.project.cycle_status" || input.operation === "project_member.project.reporting_status") &&
    !projectSlug.data
  ) {
    return edgeCommandFailure("invalid_payload", "projectSlug is required for this operation.")
  }

  return edgeCommandSuccess({
    operation: input.operation as McpWorkflowReadOperation,
    projectSlug: projectSlug.data,
    cycleKey: cycleKey.data,
    attemptId: attemptId.data,
  })
}

export function normalizeMcpWorkflowReadResult(result: EdgeCommandResult<unknown>) {
  return result
}
