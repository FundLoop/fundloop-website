import { createMcpAuthContext, type McpAuthContext } from "./auth.ts"
import { writeMcpAuditEvent, type McpObservabilityContext } from "./observability.ts"

type SupabaseAuthUser = {
  id?: string
  email?: string | null
}

type SupabaseAuthClientLike = {
  auth: {
    getUser(): Promise<{
      data?: {
        user?: SupabaseAuthUser | null
      } | null
      error?: {
        message?: string
      } | null
    }>
  }
}

export type RemoteMcpAuthResult =
  | {
      ok: true
      auth: McpAuthContext
    }
  | {
      ok: false
      status: number
      code: string
      message: string
    }

export function parseBearerToken(authorizationHeader: string | null) {
  const match = authorizationHeader?.match(/^Bearer\s+(.+)$/i)
  return match?.[1]?.trim() ?? null
}

export function createRemoteMcpAuthContext(authorizationHeader: string | null): RemoteMcpAuthResult {
  const bearerToken = parseBearerToken(authorizationHeader)
  if (!bearerToken) {
    auditMcpAuthEvent("auth_failure", { code: "not_authenticated" })
    return {
      ok: false,
      status: 401,
      code: "not_authenticated",
      message: "FundLoop MCP requests require a bearer token.",
    }
  }

  return {
    ok: true,
    auth: createMcpAuthContext({ bearerToken }),
  }
}

export async function createValidatedRemoteMcpAuthContext(input: {
  authorizationHeader: string | null
  authClient: SupabaseAuthClientLike
  internalAdminEmails?: string
  allowLocalTestToken?: boolean
  observability?: McpObservabilityContext
}): Promise<RemoteMcpAuthResult> {
  const bearerToken = parseBearerToken(input.authorizationHeader)
  if (!bearerToken) {
    auditMcpAuthEvent("auth_failure", { code: "not_authenticated", request: input.observability })
    return {
      ok: false,
      status: 401,
      code: "not_authenticated",
      message: "FundLoop MCP requests require a bearer token.",
    }
  }

  if (input.allowLocalTestToken && bearerToken === "local-smoke-token") {
    return {
      ok: true,
      auth: createMcpAuthContext({
        bearerToken,
        userId: "local-mcp-smoke-user",
        email: "local-mcp-smoke@fundloop.example.com",
        subject: "local-mcp-smoke@fundloop.example.com",
        defaultActorRole: "founder",
        isInternalOperator: false,
      }),
    }
  }

  const {
    data,
    error,
  } = await input.authClient.auth.getUser()

  const user = data?.user
  if (error || !user?.id) {
    auditMcpAuthEvent("auth_failure", { code: "not_authenticated", message: error?.message, request: input.observability })
    return {
      ok: false,
      status: 401,
      code: "not_authenticated",
      message: error?.message ?? "FundLoop MCP requests require a valid Supabase user.",
    }
  }

  const email = user.email?.trim() || undefined
  const isInternalOperator = email ? parseInternalAdminEmails(input.internalAdminEmails).has(email.toLowerCase()) : false
  return {
    ok: true,
    auth: createMcpAuthContext({
      bearerToken,
      userId: user.id,
      email,
      subject: email ?? user.id,
      defaultActorRole: isInternalOperator ? "internal_operator" : "founder",
      isInternalOperator,
    }),
  }
}

function parseInternalAdminEmails(source?: string) {
  return new Set(
    (source ?? "")
      .split(",")
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean),
  )
}

function auditMcpAuthEvent(eventType: "auth_failure", input: { code: string; message?: string; request?: McpObservabilityContext }) {
  writeMcpAuditEvent("warn", {
    event: eventType,
    request: input.request,
    status: "authentication_failed",
    errorCode: input.code,
    message: input.message ?? null,
  })
}
