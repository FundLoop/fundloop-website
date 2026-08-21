import type { McpAuthContext } from "./auth.ts"
import { errorResult } from "./protocol.ts"
import type { McpResourceDefinition, McpResourceReadResult } from "./protocol.ts"
import type { McpToolHandlerContext } from "./tools.ts"

export type McpResourceHandler = (context: McpToolHandlerContext) => Promise<McpResourceReadResult> | McpResourceReadResult

export type McpRegisteredResource = {
  definition: McpResourceDefinition
  handler: McpResourceHandler
  operatorOnly?: boolean
}

function textResource(uri: string, value: unknown): McpResourceReadResult {
  return {
    contents: [
      {
        uri,
        mimeType: "application/json",
        text: JSON.stringify(value, null, 2),
      },
    ],
  }
}

function safeErrorResource(uri: string, message: string): McpResourceReadResult {
  return textResource(uri, {
    ok: false,
    error: {
      code: "resource_unavailable",
      message,
    },
  })
}

export class McpResourceRegistry {
  private readonly resources = new Map<string, McpRegisteredResource>()

  register(resource: McpRegisteredResource) {
    if (this.resources.has(resource.definition.uri)) {
      throw new Error(`MCP resource ${resource.definition.uri} is already registered.`)
    }

    this.resources.set(resource.definition.uri, resource)
  }

  list(auth: McpAuthContext): McpResourceDefinition[] {
    return [...this.resources.values()]
      .filter((resource) => !resource.operatorOnly || auth.isInternalOperator)
      .map((resource) => resource.definition)
  }

  async read(uri: string, context: McpToolHandlerContext): Promise<McpResourceReadResult | { isError: true; errorCode: string; message: string }> {
    const resource = this.resources.get(uri)
    if (!resource) {
      return {
        isError: true,
        errorCode: "resource_not_found",
        message: `Unknown resource: ${uri}`,
      }
    }

    if (resource.operatorOnly && !context.auth.isInternalOperator) {
      return {
        isError: true,
        errorCode: "forbidden",
        message: "This MCP resource requires internal operator access.",
      }
    }

    try {
      return await resource.handler(context)
    } catch {
      return safeErrorResource(uri, "This MCP resource is temporarily unavailable.")
    }
  }
}

export function createBaseMcpResourceRegistry() {
  const registry = new McpResourceRegistry()

  registry.register({
    definition: {
      name: "FundLoop MCP Overview",
      uri: "fundloop://docs/mcp-overview",
      title: "FundLoop MCP Overview",
      description: "Stable read-only overview of the FundLoop MCP surface and safety model.",
      mimeType: "application/json",
    },
    handler: () =>
      textResource("fundloop://docs/mcp-overview", {
        ok: true,
        service: "fundloop-mcp-server",
        transport: "stdio and authenticated Streamable HTTP",
        safetyModel: [
          "Tool traffic requires an authenticated Supabase user on the remote endpoint.",
          "Workflow reads go through typed MCP read gateways.",
          "Writes go through typed Edge Function commands.",
          "Operator tools require internal-operator allowlist access.",
          "Resources are read-only, bounded, and omit secrets/raw payloads.",
        ],
        keyResources: [
          "fundloop://workspace/summary",
          "fundloop://user/payout-routes",
          "fundloop://founder/projects",
          "fundloop://operator/cycles",
        ],
      }),
  })

  registry.register({
    definition: {
      name: "User Workspace Summary",
      uri: "fundloop://workspace/summary",
      title: "User Workspace Summary",
      description: "Authenticated user's redacted workspace summary.",
      mimeType: "application/json",
    },
    async handler(context) {
      if (!context.userReader) return safeErrorResource("fundloop://workspace/summary", "User workflow reader is not configured.")
      return textResource("fundloop://workspace/summary", {
        ok: true,
        data: await context.userReader.getWorkspaceSummary(context.auth),
      })
    },
  })

  registry.register({
    definition: {
      name: "User Payout Routes",
      uri: "fundloop://user/payout-routes",
      title: "User Payout Routes",
      description: "Authenticated user's destination-redacted payout route readiness.",
      mimeType: "application/json",
    },
    async handler(context) {
      if (!context.userReader) return safeErrorResource("fundloop://user/payout-routes", "User workflow reader is not configured.")
      return textResource("fundloop://user/payout-routes", {
        ok: true,
        data: await context.userReader.listPayoutRoutes(context.auth),
      })
    },
  })

  registry.register({
    definition: {
      name: "Founder Projects",
      uri: "fundloop://founder/projects",
      title: "Founder Projects",
      description: "Projects managed by the authenticated founder or project member.",
      mimeType: "application/json",
    },
    async handler(context) {
      if (!context.founderReader) return safeErrorResource("fundloop://founder/projects", "Founder workflow reader is not configured.")
      return textResource("fundloop://founder/projects", {
        ok: true,
        projects: await context.founderReader.listManagedProjects(context.auth),
      })
    },
  })

  registry.register({
    definition: {
      name: "Operator Monthly Cycles",
      uri: "fundloop://operator/cycles",
      title: "Operator Monthly Cycles",
      description: "Internal-operator recent monthly cycle status summary.",
      mimeType: "application/json",
    },
    operatorOnly: true,
    async handler(context) {
      if (!context.operatorReader) return safeErrorResource("fundloop://operator/cycles", "Operator workflow reader is not configured.")
      return textResource("fundloop://operator/cycles", {
        ok: true,
        cycles: await context.operatorReader.listCycleStatuses(context.auth),
      })
    },
  })

  return registry
}

export function resourceReadErrorToRpc(error: { errorCode: string; message: string }) {
  return {
    ...errorResult(error.message),
    errorCode: error.errorCode,
  }
}
