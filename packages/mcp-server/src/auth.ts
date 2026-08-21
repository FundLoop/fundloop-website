export type McpActorRole = "founder" | "project_member" | "internal_operator"

export type McpAuthContext = {
  actorRole: McpActorRole
  bearerToken: string
  userId?: string
  email?: string
  subject?: string
  isInternalOperator?: boolean
}

export type McpAuthConfig = {
  defaultActorRole?: McpActorRole
  bearerToken?: string
  userId?: string
  email?: string
  subject?: string
  isInternalOperator?: boolean
}

export function createMcpAuthContext(
  config: McpAuthConfig = {},
  env: Record<string, string | undefined> = getDefaultEnvironment(),
): McpAuthContext {
  const bearerToken = config.bearerToken ?? env.FUNDLOOP_MCP_BEARER_TOKEN
  if (!bearerToken?.trim()) {
    throw new Error("FUNDLOOP_MCP_BEARER_TOKEN is required for MCP Edge Function calls.")
  }

  const userId = config.userId ?? env.FUNDLOOP_MCP_USER_ID ?? (env.FUNDLOOP_MCP_STDIO === "1" ? "stdio-local-user" : undefined)
  const email = config.email ?? env.FUNDLOOP_MCP_USER_EMAIL ?? (env.FUNDLOOP_MCP_STDIO === "1" ? "stdio-local@fundloop.example.com" : undefined)

  return {
    actorRole: config.defaultActorRole ?? "founder",
    bearerToken: bearerToken.trim(),
    userId,
    email,
    subject: config.subject ?? email ?? userId,
    isInternalOperator: config.isInternalOperator,
  }
}

function getDefaultEnvironment(): Record<string, string | undefined> {
  return typeof process === "undefined" ? {} : process.env
}
