import type { McpAuthContext } from "./auth.ts"
import type { EdgeCommandClient } from "./edge-client.ts"
import { errorResult, jsonTextResult, type McpToolDefinition, type McpToolResult } from "./protocol.ts"

export type McpToolHandlerContext = {
  auth: McpAuthContext
  edge: EdgeCommandClient
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

    return tool.handler(input, context)
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
          functionName: { type: "string" },
          input: { type: "object" },
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
