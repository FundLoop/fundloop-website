import { edgeCommandFailure, edgeCommandSuccess, type EdgeCommandResult } from "./result.ts"

export const MONTHLY_REPORT_PUBLICATION_FUNCTION = "monthly-report-publication"

export type MonthlyReportPublicationInput = {
  action: "generate" | "regenerate" | "publish" | "read" | "tombstone"
  closePackageId?: string
  rootHash?: string
  cycleKey?: string
  audience?: "public" | "user" | "founder" | "operator" | "mcp"
  subjectUserId?: string
  subjectProjectId?: string
  expectedCurrentVersion?: number
  regenerationKey?: string
  artifactId?: string
  reason?: string
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value))
}

export function validateMonthlyReportPublicationInput(input: unknown): EdgeCommandResult<MonthlyReportPublicationInput> {
  if (!isObject(input) || !["generate", "regenerate", "publish", "read", "tombstone"].includes(String(input.action))) {
    return edgeCommandFailure("invalid_payload", "action is not supported.")
  }
  const action = input.action as MonthlyReportPublicationInput["action"]
  const allowedByAction: Record<MonthlyReportPublicationInput["action"], Set<string>> = {
    generate: new Set(["action", "closePackageId"]),
    regenerate: new Set(["action", "closePackageId", "expectedCurrentVersion", "regenerationKey", "reason"]),
    publish: new Set(["action", "closePackageId", "rootHash"]),
    read: new Set(["action", "cycleKey", "audience", "subjectUserId", "subjectProjectId"]),
    tombstone: new Set(["action", "artifactId", "reason"]),
  }
  const unexpected = Object.keys(input).find((field) => !allowedByAction[action].has(field))
  if (unexpected) return edgeCommandFailure("invalid_payload", `${unexpected} is not valid for ${action}.`)
  const stringFields = ["closePackageId", "rootHash", "cycleKey", "audience", "subjectUserId", "subjectProjectId", "regenerationKey", "artifactId", "reason"] as const
  for (const field of stringFields) {
    if (input[field] !== undefined && (typeof input[field] !== "string" || !input[field].trim())) {
      return edgeCommandFailure("invalid_payload", `${field} must be a non-empty string.`)
    }
  }
  if (["generate", "regenerate", "publish"].includes(action) && !input.closePackageId) return edgeCommandFailure("invalid_payload", "closePackageId is required.")
  if (action === "publish" && !/^[0-9a-f]{64}$/.test(String(input.rootHash ?? ""))) {
    return edgeCommandFailure("invalid_payload", "rootHash must be a SHA-256 digest.")
  }
  if (input.audience && !["public", "user", "founder", "operator", "mcp"].includes(String(input.audience))) {
    return edgeCommandFailure("invalid_payload", "audience is not supported.")
  }
  if (action === "regenerate" && (!Number.isSafeInteger(input.expectedCurrentVersion) || Number(input.expectedCurrentVersion) < 1 ||
    !/^[0-9a-f]{64}$/.test(String(input.regenerationKey ?? "")) || !/^[a-z][a-z0-9_-]{2,63}$/.test(String(input.reason ?? "")))) {
    return edgeCommandFailure("invalid_payload", "regenerate requires expectedCurrentVersion, reason, and a SHA-256 regenerationKey.")
  }
  if (action === "tombstone" && (!/^\d+$/.test(String(input.artifactId ?? "")) || !/^[a-z][a-z0-9_-]{2,63}$/.test(String(input.reason ?? "")))) {
    return edgeCommandFailure("invalid_payload", "tombstone requires artifactId and reason.")
  }
  if (action === "read") {
    if (!input.audience) return edgeCommandFailure("invalid_payload", "read requires one explicit audience.")
    if (input.audience === "user" && !input.subjectUserId) return edgeCommandFailure("invalid_payload", "user reads require subjectUserId.")
    if (input.audience === "founder" && !input.subjectProjectId) return edgeCommandFailure("invalid_payload", "founder reads require subjectProjectId.")
    if (input.audience !== "user" && input.subjectUserId) return edgeCommandFailure("invalid_payload", "subjectUserId is valid only for user reports.")
    if (input.audience !== "founder" && input.subjectProjectId) return edgeCommandFailure("invalid_payload", "subjectProjectId is valid only for founder reports.")
  }
  return edgeCommandSuccess(Object.fromEntries(Object.entries(input).map(([key, value]) => [key, typeof value === "string" ? value.trim() : value])) as MonthlyReportPublicationInput)
}
