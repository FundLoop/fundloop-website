import type { McpAuthContext } from "./auth.ts"

export type McpToolAuthorizationResult =
  | {
      ok: true
    }
  | {
      ok: false
      code: string
      message: string
    }

const OPERATOR_TOOL_PREFIX = "operator."
const OPERATOR_COMMAND_PREFIXES = ["admin-", "monthly-cycle-", "mcp-operator-"]

export function isOperatorOrDestructiveEdgeFunctionName(functionName: string) {
  return OPERATOR_COMMAND_PREFIXES.some((prefix) => functionName.startsWith(prefix))
}

export function authorizeMcpToolCall(toolName: string, auth: McpAuthContext, input?: unknown): McpToolAuthorizationResult {
  if (!auth.userId && toolName !== "fundloop.health") {
    return {
      ok: false,
      code: "not_authenticated",
      message: "This MCP tool requires an authenticated FundLoop user.",
    }
  }

  if (toolName.startsWith(OPERATOR_TOOL_PREFIX) && !auth.isInternalOperator) {
    return {
      ok: false,
      code: "forbidden",
      message: "This MCP tool requires internal operator access.",
    }
  }

  if (toolName === "fundloop.edge_command.invoke") {
    const functionName = readFunctionName(input)
    if (functionName && isOperatorOrDestructiveEdgeFunctionName(functionName) && !auth.isInternalOperator) {
      return {
        ok: false,
        code: "forbidden",
        message: "This Edge Function command requires internal operator access.",
      }
    }
  }

  return { ok: true }
}

function readFunctionName(input: unknown) {
  return input && typeof input === "object" && !Array.isArray(input) && typeof (input as { functionName?: unknown }).functionName === "string"
    ? (input as { functionName: string }).functionName.trim()
    : null
}
