import type { McpAuthContext } from "./auth.ts"
import type { EdgeCommandClient } from "./edge-client.ts"
import type { FounderWorkflowReader } from "./founder-reader.ts"
import type { OperatorWorkflowReader, ProjectMemberWorkflowReader, UserWorkflowReader } from "./member-operator-readers.ts"
import { errorResult, jsonTextResult, type McpToolDefinition, type McpToolResult } from "./protocol.ts"
import { authorizeMcpToolCall } from "./authorization.ts"
import { classifyMcpTool, writeMcpAuditEvent, type McpObservabilityContext } from "./observability.ts"
import { sanitizeMcpToolResult, validateMcpToolInput } from "./safety.ts"

export type McpToolHandlerContext = {
  auth: McpAuthContext
  edge: EdgeCommandClient
  founderReader?: FounderWorkflowReader
  userReader?: UserWorkflowReader
  projectMemberReader?: ProjectMemberWorkflowReader
  operatorReader?: OperatorWorkflowReader
  observability?: McpObservabilityContext
}

export type McpToolHandler = (input: unknown, context: McpToolHandlerContext) => Promise<McpToolResult> | McpToolResult

export type McpRegisteredTool = {
  definition: McpToolDefinition
  handler: McpToolHandler
}

export type BaseMcpToolRegistryOptions = {
  allowedFunctionNames?: string[]
  disabledToolNames?: string[]
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value))
}

export class McpToolRegistry {
  private readonly tools = new Map<string, McpRegisteredTool>()
  private readonly disabledToolNames: Set<string>

  constructor(options: { disabledToolNames?: Iterable<string> } = {}) {
    this.disabledToolNames = new Set(options.disabledToolNames ?? [])
  }

  register(tool: McpRegisteredTool) {
    if (this.tools.has(tool.definition.name)) {
      throw new Error(`MCP tool ${tool.definition.name} is already registered.`)
    }

    this.tools.set(tool.definition.name, tool)
  }

  list(): McpToolDefinition[] {
    return [...this.tools.values()].filter((tool) => !this.disabledToolNames.has(tool.definition.name)).map((tool) => tool.definition)
  }

  async call(name: string, input: unknown, context: McpToolHandlerContext): Promise<McpToolResult> {
    const startedAtMs = Date.now()
    const tool = this.tools.get(name)
    if (!tool) {
      auditMcpToolEvent("tool_failure", {
        toolName: name,
        auth: context.auth,
        request: context.observability,
        startedAtMs,
        code: "tool_not_found",
      })
      return sanitizeMcpToolResult(errorResult(`Unknown tool: ${name}`))
    }

    if (this.disabledToolNames.has(name)) {
      auditMcpToolEvent("tool_disabled", {
        toolName: name,
        toolCategory: classifyMcpTool(tool.definition),
        auth: context.auth,
        request: context.observability,
        startedAtMs,
        code: "tool_disabled",
      })
      return sanitizeMcpToolResult({
        ...errorResult(`MCP tool ${name} is currently disabled.`),
        errorCode: "tool_disabled",
      })
    }

    const authorization = authorizeMcpToolCall(name, context.auth, input)
    if (!authorization.ok) {
      auditMcpToolEvent("authorization_failure", {
        toolName: name,
        toolCategory: classifyMcpTool(tool.definition),
        auth: context.auth,
        request: context.observability,
        startedAtMs,
        code: authorization.code,
      })
      return sanitizeMcpToolResult({
        ...errorResult(authorization.message),
        errorCode: authorization.code,
      })
    }

    const validation = validateMcpToolInput(tool.definition, input)
    if (!validation.ok) {
      auditMcpToolEvent("validation_failure", {
        toolName: name,
        toolCategory: classifyMcpTool(tool.definition),
        auth: context.auth,
        request: context.observability,
        startedAtMs,
        code: validation.code,
      })
      return sanitizeMcpToolResult({
        ...errorResult(validation.message),
        errorCode: validation.code,
      })
    }

    try {
      const result = await tool.handler(input, context)
      auditMcpToolEvent(result.isError ? "tool_failure" : "tool_success", {
        toolName: name,
        toolCategory: classifyMcpTool(tool.definition),
        auth: context.auth,
        request: context.observability,
        startedAtMs,
        code: result.errorCode ?? null,
      })
      return sanitizeMcpToolResult(result)
    } catch {
      auditMcpToolEvent("tool_failure", {
        toolName: name,
        toolCategory: classifyMcpTool(tool.definition),
        auth: context.auth,
        request: context.observability,
        startedAtMs,
        code: "handler_failed",
      })
      return sanitizeMcpToolResult({
        ...errorResult("MCP tool execution failed."),
        errorCode: "handler_failed",
      })
    }
  }
}

export function createBaseMcpToolRegistry(options: BaseMcpToolRegistryOptions = {}) {
  const registry = new McpToolRegistry({ disabledToolNames: options.disabledToolNames })
  const allowedFunctionNames = new Set(options.allowedFunctionNames ?? [])

  registry.register({
    definition: {
      name: "fundloop.health",
      title: "FundLoop MCP Health",
      description: "Return the FundLoop MCP server health and authenticated actor context.",
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: false,
      },
      inputSchema: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
      outputSchema: {
        type: "object",
        properties: {
          ok: { type: "boolean" },
          service: { type: "string" },
          version: { type: "string" },
          authenticated: { type: "boolean" },
          actor: { type: "object" },
        },
        required: ["ok", "service", "version", "authenticated", "actor"],
        additionalProperties: false,
      },
    },
    handler: (_input, context) =>
      jsonTextResult({
        ok: true,
        service: "fundloop-mcp-server",
        version: "0.1.0",
        authenticated: Boolean(context.auth.userId),
        actor: {
          role: context.auth.actorRole,
          subject: context.auth.subject ?? context.auth.email ?? context.auth.userId ?? null,
          userId: context.auth.userId ?? null,
          isInternalOperator: Boolean(context.auth.isInternalOperator),
        },
      }),
  })

  registry.register({
    definition: {
      name: "fundloop.edge_command.invoke",
      title: "FundLoop Edge Command Invoke",
      description: "Invoke an allowlisted FundLoop Edge Function command through the shared typed command envelope.",
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        openWorldHint: false,
      },
      inputSchema: {
        type: "object",
        properties: {
          functionName: { type: "string", minLength: 1, maxLength: 96, pattern: "^[a-z0-9][a-z0-9-]*$" },
          input: { type: "object", maxProperties: 24, maxDepth: 4 },
        },
        required: ["functionName"],
        additionalProperties: false,
      },
      outputSchema: {
        type: "object",
        properties: {
          ok: { type: "boolean" },
          data: { type: "object" },
          error: { type: "object" },
        },
        required: ["ok"],
        additionalProperties: false,
      },
    },
    async handler(input, context) {
      if (!isRecord(input) || typeof input.functionName !== "string" || !input.functionName.trim()) {
        return { ...errorResult("functionName is required."), errorCode: "invalid_payload" }
      }

      const functionName = input.functionName.trim()
      if (!allowedFunctionNames.has(functionName)) {
        return {
          ...errorResult(`Edge Function ${functionName} is not allowlisted for this MCP server.`),
          errorCode: "not_allowlisted",
        }
      }

      const result = await context.edge.invoke(functionName, isRecord(input.input) ? input.input : {}, context.auth)
      return jsonTextResult(result)
    },
  })

  return registry
}

function auditMcpToolEvent(
  eventType: "authorization_failure" | "validation_failure" | "tool_success" | "tool_failure" | "tool_disabled",
  input: {
    toolName: string
    auth: McpAuthContext
    request?: McpObservabilityContext
    toolCategory?: string
    startedAtMs: number
    code?: string | null
  },
) {
  const latencyMs = Math.max(0, Date.now() - input.startedAtMs)
  const status =
    eventType === "tool_success"
      ? "success"
      : eventType === "tool_disabled"
        ? "disabled"
        : eventType === "authorization_failure"
          ? "authorization_failed"
          : eventType === "validation_failure"
            ? "validation_failed"
            : "failure"

  writeMcpAuditEvent(eventType === "tool_success" ? "info" : "warn", {
    event: eventType,
    toolName: input.toolName,
    toolCategory: input.toolCategory,
    status,
    latencyMs,
    errorCode: input.code ?? null,
    auth: input.auth,
    request: input.request,
  })
}
