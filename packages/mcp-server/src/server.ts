#!/usr/bin/env node
import { createMcpAuthContext } from "./auth.ts"
import { createSupabaseEdgeCommandClient, type EdgeCommandClient } from "./edge-client.ts"
import { createSupabaseFounderWorkflowReader, type FounderWorkflowReader } from "./founder-reader.ts"
import { registerFounderMcpTools } from "./founder-tools.ts"
import {
  createSupabaseOperatorWorkflowReader,
  createSupabaseProjectMemberWorkflowReader,
  type OperatorWorkflowReader,
  type ProjectMemberWorkflowReader,
} from "./member-operator-readers.ts"
import { registerProjectMemberAndOperatorMcpTools } from "./member-operator-tools.ts"
import { createBaseMcpToolRegistry, type McpToolRegistry } from "./tools.ts"
import { isJsonRpcRequest, type JsonRpcResponse } from "./protocol.ts"

export type McpServerContext = {
  auth: ReturnType<typeof createMcpAuthContext>
  edge: EdgeCommandClient
  founderReader?: FounderWorkflowReader
  projectMemberReader?: ProjectMemberWorkflowReader
  operatorReader?: OperatorWorkflowReader
  registry: McpToolRegistry
}

function response(id: string | number | null, result: unknown): JsonRpcResponse {
  return { jsonrpc: "2.0", id, result }
}

function errorResponse(id: string | number | null, code: number, message: string): JsonRpcResponse {
  return { jsonrpc: "2.0", id, error: { code, message } }
}

export async function handleMcpRequest(
  input: unknown,
  context: McpServerContext = createDefaultServerContext(),
): Promise<JsonRpcResponse | null> {
  if (!isJsonRpcRequest(input)) {
    return errorResponse(null, -32600, "Invalid JSON-RPC request.")
  }

  const id = input.id ?? null
  if (input.method === "initialize") {
    return response(id, {
      protocolVersion: "2024-11-05",
      serverInfo: {
        name: "fundloop-mcp-server",
        version: "0.1.0",
      },
      capabilities: {
        tools: {},
      },
    })
  }

  if (input.method === "tools/list") {
    return response(id, { tools: context.registry.list() })
  }

  if (input.method === "tools/call") {
    const params = input.params as { name?: unknown; arguments?: unknown } | undefined
    if (!params || typeof params.name !== "string") {
      return errorResponse(id, -32602, "tools/call requires a tool name.")
    }

    const result = await context.registry.call(params.name, params.arguments ?? {}, {
      auth: context.auth,
      edge: context.edge,
      founderReader: context.founderReader,
      projectMemberReader: context.projectMemberReader,
      operatorReader: context.operatorReader,
    })
    return response(id, result)
  }

  if (input.method === "notifications/initialized") {
    return null
  }

  return errorResponse(id, -32601, `Unsupported method: ${input.method}`)
}

function createDefaultServerContext(): McpServerContext {
  const registry = createBaseMcpToolRegistry({
    allowedFunctionNames: (process.env.FUNDLOOP_MCP_ALLOWED_EDGE_FUNCTIONS ?? "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean),
  })
  registerFounderMcpTools(registry)
  registerProjectMemberAndOperatorMcpTools(registry)

  return {
    auth: createMcpAuthContext(),
    edge: createSupabaseEdgeCommandClient(),
    founderReader: createSupabaseFounderWorkflowReader(),
    projectMemberReader: createSupabaseProjectMemberWorkflowReader(),
    operatorReader: createSupabaseOperatorWorkflowReader(),
    registry,
  }
}

async function main() {
  let buffer = ""
  process.stdin.setEncoding("utf8")
  for await (const chunk of process.stdin) {
    buffer += chunk
    let newlineIndex = buffer.indexOf("\n")
    while (newlineIndex >= 0) {
      const line = buffer.slice(0, newlineIndex).trim()
      buffer = buffer.slice(newlineIndex + 1)
      if (line) {
        const payload = JSON.parse(line) as unknown
        const result = await handleMcpRequest(payload)
        if (result) {
          process.stdout.write(`${JSON.stringify(result)}\n`)
        }
      }
      newlineIndex = buffer.indexOf("\n")
    }
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  void main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : "FundLoop MCP server failed."
    process.stderr.write(`${message}\n`)
    process.exitCode = 1
  })
}
