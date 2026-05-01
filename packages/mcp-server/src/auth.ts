export type McpActorRole = "founder" | "project_member" | "internal_operator"

export type McpAuthContext = {
  actorRole: McpActorRole
  bearerToken: string
  subject?: string
}

export type McpAuthConfig = {
  defaultActorRole?: McpActorRole
  bearerToken?: string
  subject?: string
}

export function createMcpAuthContext(
  config: McpAuthConfig = {},
  env: Record<string, string | undefined> = process.env,
): McpAuthContext {
  const bearerToken = config.bearerToken ?? env.FUNDLOOP_MCP_BEARER_TOKEN
  if (!bearerToken?.trim()) {
    throw new Error("FUNDLOOP_MCP_BEARER_TOKEN is required for MCP Edge Function calls.")
  }

  return {
    actorRole: config.defaultActorRole ?? "founder",
    bearerToken: bearerToken.trim(),
    subject: config.subject,
  }
}
