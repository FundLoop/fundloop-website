import "jsr:@supabase/functions-js/edge-runtime.d.ts"

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js"

import { createValidatedRemoteMcpAuthContext } from "../../../packages/mcp-server/src/http-auth.ts"
import { SupabaseEdgeCommandClient } from "../../../packages/mcp-server/src/edge-client.ts"
import { createEdgeFounderWorkflowReader } from "../../../packages/mcp-server/src/founder-reader.ts"
import { registerFounderMcpTools } from "../../../packages/mcp-server/src/founder-tools.ts"
import {
  createEdgeOperatorWorkflowReader,
  createEdgeProjectMemberWorkflowReader,
  createEdgeUserWorkflowReader,
} from "../../../packages/mcp-server/src/member-operator-readers.ts"
import { registerProjectMemberAndOperatorMcpTools } from "../../../packages/mcp-server/src/member-operator-tools.ts"
import { createBaseMcpPromptRegistry } from "../../../packages/mcp-server/src/prompts.ts"
import { createBaseMcpResourceRegistry } from "../../../packages/mcp-server/src/resources.ts"
import {
  registerRegistryPromptsWithSdkServer,
  registerRegistryResourcesWithSdkServer,
  registerRegistryToolsWithSdkServer,
} from "../../../packages/mcp-server/src/sdk-adapter.ts"
import { createMcpObservabilityContext } from "../../../packages/mcp-server/src/observability.ts"
import { createBaseMcpToolRegistry } from "../../../packages/mcp-server/src/tools.ts"
import { createFunctionClients, getEnv } from "../_shared/command-runtime.ts"

const mcpCorsHeaders = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, POST, OPTIONS, DELETE",
  "access-control-allow-headers": "authorization, x-client-info, apikey, content-type, accept, mcp-protocol-version, mcp-session-id",
}

function json(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: {
      "content-type": "application/json",
      ...mcpCorsHeaders,
      ...(init.headers ?? {}),
    },
  })
}

function readRequiredEnv(name: string) {
  const value = getEnv(name)?.trim()
  if (!value) throw new Error(`${name} is required for the FundLoop MCP Edge Function.`)
  return value
}

function readAllowedEdgeFunctions() {
  return (getEnv("FUNDLOOP_MCP_ALLOWED_EDGE_FUNCTIONS") ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)
}

function readDisabledTools() {
  return (getEnv("FUNDLOOP_MCP_DISABLED_TOOLS") ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)
}

async function buildMcpServer(request: Request) {
  const observability = createMcpObservabilityContext(request.headers)
  const clients = createFunctionClients(request)
  if (!clients.ok) {
    return {
      ok: false as const,
      status: 500,
      code: "misconfigured",
      message: clients.error,
    }
  }

  const authResult = await createValidatedRemoteMcpAuthContext({
    authorizationHeader: request.headers.get("authorization"),
    authClient: clients.authClient,
    internalAdminEmails: getEnv("FUNDLOOP_INTERNAL_ADMIN_EMAILS"),
    allowLocalTestToken: getEnv("FUNDLOOP_MCP_ALLOW_LOCAL_TEST_TOKEN") === "true",
    observability,
  })
  if (!authResult.ok) return authResult

  const edge = new SupabaseEdgeCommandClient({
    supabaseUrl: readRequiredEnv("NEXT_PUBLIC_SUPABASE_URL").replace(/\/$/, ""),
    anonKey: readRequiredEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
  })
  const registry = createBaseMcpToolRegistry({ allowedFunctionNames: readAllowedEdgeFunctions(), disabledToolNames: readDisabledTools() })
  registerFounderMcpTools(registry)
  registerProjectMemberAndOperatorMcpTools(registry)

  const context = {
    auth: authResult.auth,
    edge,
    founderReader: createEdgeFounderWorkflowReader(edge),
    userReader: createEdgeUserWorkflowReader(edge),
    projectMemberReader: createEdgeProjectMemberWorkflowReader(edge),
    operatorReader: createEdgeOperatorWorkflowReader(edge),
    observability,
  }

  const server = new McpServer({
    name: "fundloop-mcp-server",
    version: "0.1.0",
  })
  registerRegistryToolsWithSdkServer(server, registry, context)
  registerRegistryResourcesWithSdkServer(server, createBaseMcpResourceRegistry(), context)
  registerRegistryPromptsWithSdkServer(server, createBaseMcpPromptRegistry())
  return { ok: true as const, server }
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: mcpCorsHeaders })
  }

  const pathname = new URL(request.url).pathname
  if (request.method === "GET" && pathname.endsWith("/health")) {
    return json({
      ok: true,
      service: "fundloop-mcp-server",
      version: "0.1.0",
      transport: "streamable_http",
    })
  }

  if (request.method !== "POST" && request.method !== "DELETE") {
    return json({ ok: false, error: { code: "method_not_allowed", message: "Use POST for MCP requests." } }, { status: 405 })
  }

  const serverResult = await buildMcpServer(request)
  if (!serverResult.ok) {
    return json({ ok: false, error: { code: serverResult.code, message: serverResult.message } }, { status: serverResult.status })
  }

  const transport = new WebStandardStreamableHTTPServerTransport()
  await serverResult.server.connect(transport)
  const response = await transport.handleRequest(request)
  const headers = new Headers(response.headers)
  for (const [key, value] of Object.entries(mcpCorsHeaders)) {
    headers.set(key, value)
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  })
})
