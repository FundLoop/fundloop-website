import type { McpAuthContext } from "./auth.ts"
import type { EdgeCommandClient } from "./edge-client.ts"
import type { FounderWorkflowReader } from "./founder-reader.ts"
import type { OperatorWorkflowReader, ProjectMemberWorkflowReader } from "./member-operator-readers.ts"
import { errorResult, jsonTextResult, type McpToolDefinition, type McpToolResult } from "./protocol.ts"
import { authorizeMcpToolCall } from "./authorization.ts"
import { sanitizeMcpToolResult, validateMcpToolInput } from "./safety.ts"

export type McpToolHandlerContext = {
  auth: McpAuthContext
  edge: EdgeCommandClient
  founderReader?: FounderWorkflowReader
  projectMemberReader?: ProjectMemberWorkflowReader
  operatorReader?: OperatorWorkflowReader
}

export type McpToolHandler = (input: unknown, context: McpToolHandlerContext) => Promise<McpToolResult> | McpToolResult

export type McpRegisteredTool = {
  definition: McpToolDefinition
  handler: McpToolHandler
}

export type BaseMcpToolRegistryOptions = {
  allowedFunctionNames?: string[]
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value))
}

export class McpToolRegistry {
  private readonly tools = new Map<string, McpRegisteredTool>()

  register(tool: McpRegisteredTool) {
    if (this.tools.has(tool.definition.name)) {
      throw new Error(`MCP tool ${tool.definition.name} is already registered.`)
    }

    this.tools.set(tool.definition.name, tool)
  }

  list(): McpToolDefinition[] {
    return [...this.tools.values()].map((tool) => tool.definition)
  }

  async call(name: string, input: unknown, context: McpToolHandlerContext): Promise<McpToolResult> {
    const tool = this.tools.get(name)
    if (!tool) {
      return errorResult(`Unknown tool: ${name}`)
    }

    const authorization = authorizeMcpToolCall(name, context.auth, input)
    if (!authorization.ok) {
      auditMcpToolEvent("authorization_failure", { toolName: name, auth: context.auth, code: authorization.code })
      return {
        ...errorResult(authorization.message),
        errorCode: authorization.code,
      }
    }

    const validation = validateMcpToolInput(tool.definition, input)
    if (!validation.ok) {
      auditMcpToolEvent("validation_failure", { toolName: name, auth: context.auth, code: validation.code })
      return {
        ...errorResult(validation.message),
        errorCode: validation.code,
      }
    }

    const result = await tool.handler(input, context)
    auditMcpToolEvent("tool_success", { toolName: name, auth: context.auth })
    return sanitizeMcpToolResult(result)
  }
}

export function createBaseMcpToolRegistry(options: BaseMcpToolRegistryOptions = {}) {
  const registry = new McpToolRegistry()
  const allowedFunctionNames = new Set(options.allowedFunctionNames ?? [])

  registry.register({
    definition: {
      name: "fundloop.health",
      description: "Return the FundLoop MCP server health and authenticated actor context.",
      inputSchema: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
    },
    handler: (_input, context) =>
      jsonTextResult({
        ok: true,
        service: "fundloop-mcp-server",
        actorRole: context.auth.actorRole,
        subject: context.auth.subject ?? null,
      }),
  })

  registry.register({
    definition: {
      name: "fundloop.edge_command.invoke",
      description: "Invoke an allowlisted FundLoop Edge Function command through the shared typed command envelope.",
      inputSchema: {
        type: "object",
        properties: {
          functionName: { type: "string", minLength: 1, maxLength: 96, pattern: "^[a-z0-9][a-z0-9-]*$" },
          input: { type: "object", maxProperties: 24, maxDepth: 4 },
        },
        required: ["functionName"],
        additionalProperties: false,
      },
    },
    async handler(input, context) {
      if (!isRecord(input) || typeof input.functionName !== "string" || !input.functionName.trim()) {
        return errorResult("functionName is required.")
      }

      const functionName = input.functionName.trim()
      if (!allowedFunctionNames.has(functionName)) {
        return errorResult(`Edge Function ${functionName} is not allowlisted for this MCP server.`)
      }

      const result = await context.edge.invoke(functionName, isRecord(input.input) ? input.input : {}, context.auth)
      return jsonTextResult(result)
    },
  })

  return registry
}

function auditMcpToolEvent(
  eventType: "authorization_failure" | "validation_failure" | "tool_success",
  input: { toolName: string; auth: McpAuthContext; code?: string },
) {
  const event = {
    event: eventType,
    surface: "mcp",
    toolName: input.toolName,
    userId: input.auth.userId ?? null,
    email: input.auth.email ?? null,
    actorRole: input.auth.actorRole,
    isInternalOperator: Boolean(input.auth.isInternalOperator),
    code: input.code ?? null,
  }

  if (eventType === "authorization_failure" || eventType === "validation_failure") {
    writeMcpAudit("warn", event)
    return
  }

  writeMcpAudit("info", event)
}

function writeMcpAudit(level: "info" | "warn", event: Record<string, unknown>) {
  const line = JSON.stringify(event)
  if (typeof process !== "undefined" && process.env.FUNDLOOP_MCP_STDIO === "1") {
    process.stderr.write(`${line}\n`)
    return
  }

  if (level === "warn") {
    console.warn(line)
    return
  }

  console.info(line)
}
