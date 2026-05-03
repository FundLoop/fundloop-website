#!/usr/bin/env node
import { createMcpAuthContext } from "./auth.ts"
import { createSupabaseEdgeCommandClient, type EdgeCommandClient } from "./edge-client.ts"
import { createEdgeFounderWorkflowReader, type FounderWorkflowReader } from "./founder-reader.ts"
import { registerFounderMcpTools } from "./founder-tools.ts"
import {
  createEdgeOperatorWorkflowReader,
  createEdgeProjectMemberWorkflowReader,
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

  const edge = createSupabaseEdgeCommandClient()
  return {
    auth: createMcpAuthContext(),
    edge,
    founderReader: createEdgeFounderWorkflowReader(edge),
    projectMemberReader: createEdgeProjectMemberWorkflowReader(edge),
    operatorReader: createEdgeOperatorWorkflowReader(edge),
    registry,
  }
}

export function encodeMcpStdioMessage(message: JsonRpcResponse) {
  const payload = JSON.stringify(message)
  return `Content-Length: ${Buffer.byteLength(payload, "utf8")}\r\n\r\n${payload}`
}

export function parseMcpStdioMessages(buffer: Buffer<ArrayBufferLike>): { messages: unknown[]; remaining: Buffer<ArrayBufferLike> } {
  const messages: unknown[] = []
  let remaining = buffer

  while (remaining.length > 0) {
    const headerEnd = remaining.indexOf("\r\n\r\n")
    if (headerEnd < 0) break

    const header = remaining.subarray(0, headerEnd).toString("utf8")
    const contentLengthLine = header
      .split("\r\n")
      .find((line) => line.toLowerCase().startsWith("content-length:"))
    const contentLength = Number(contentLengthLine?.slice("content-length:".length).trim())

    if (!Number.isInteger(contentLength) || contentLength < 0) {
      throw new Error("Invalid MCP stdio frame: missing Content-Length header.")
    }

    const bodyStart = headerEnd + 4
    const frameEnd = bodyStart + contentLength
    if (remaining.length < frameEnd) break

    const body = remaining.subarray(bodyStart, frameEnd).toString("utf8")
    messages.push(JSON.parse(body) as unknown)
    remaining = remaining.subarray(frameEnd)
  }

  return { messages, remaining }
}

async function main() {
  let buffer: Buffer<ArrayBufferLike> = Buffer.alloc(0)
  for await (const chunk of process.stdin) {
    buffer = Buffer.concat([buffer, Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)])
    const parsed = parseMcpStdioMessages(buffer)
    buffer = parsed.remaining

    for (const payload of parsed.messages) {
      const result = await handleMcpRequest(payload)
      if (result) {
        process.stdout.write(encodeMcpStdioMessage(result))
      }
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
