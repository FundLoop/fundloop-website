import { edgeCommandFailure, edgeCommandSuccess, type EdgeCommandResult } from "./result.ts"

export const MONTHLY_REPORT_PUBLICATION_FUNCTION = "monthly-report-publication"

export type MonthlyReportPublicationInput = {
  action: "generate" | "publish" | "read"
  closePackageId?: string
  rootHash?: string
  cycleKey?: string
  audience?: "public" | "user" | "founder" | "operator" | "mcp"
  subjectUserId?: string
  subjectProjectId?: string
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value))
}

export function validateMonthlyReportPublicationInput(input: unknown): EdgeCommandResult<MonthlyReportPublicationInput> {
  if (!isObject(input) || !["generate", "publish", "read"].includes(String(input.action))) {
    return edgeCommandFailure("invalid_payload", "action must be generate, publish, or read.")
  }
  const action = input.action as MonthlyReportPublicationInput["action"]
  const stringFields = ["closePackageId", "rootHash", "cycleKey", "audience", "subjectUserId", "subjectProjectId"] as const
  for (const field of stringFields) {
    if (input[field] !== undefined && (typeof input[field] !== "string" || !input[field].trim())) {
      return edgeCommandFailure("invalid_payload", `${field} must be a non-empty string.`)
    }
  }
  if (action !== "read" && !input.closePackageId) return edgeCommandFailure("invalid_payload", "closePackageId is required.")
  if (action === "publish" && !/^[0-9a-f]{64}$/.test(String(input.rootHash ?? ""))) {
    return edgeCommandFailure("invalid_payload", "rootHash must be a SHA-256 digest.")
  }
  if (input.audience && !["public", "user", "founder", "operator", "mcp"].includes(String(input.audience))) {
    return edgeCommandFailure("invalid_payload", "audience is not supported.")
  }
  return edgeCommandSuccess(Object.fromEntries(Object.entries(input).map(([key, value]) => [key, typeof value === "string" ? value.trim() : value])) as MonthlyReportPublicationInput)
}
