import type { McpAuthContext } from "./auth.ts"
import type { McpToolDefinition } from "./protocol.ts"

export type McpObservabilityContext = {
  requestId: string
  clientId: string | null
  startedAtMs: number
}

export type McpAuditEvent = {
  event: string
  toolName?: string
  toolCategory?: string
  status?: string
  latencyMs?: number
  errorCode?: string | null
  auth?: McpAuthContext
  request?: McpObservabilityContext
  message?: string | null
}

const SECRET_VALUE_PATTERN = /\b(?:Bearer\s+[A-Za-z0-9._~+/-]+=*|eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+|[A-Za-z0-9_-]{32,})\b/g

export function createMcpObservabilityContext(headers?: Headers | null): McpObservabilityContext {
  return {
    requestId: headers?.get("x-request-id")?.trim() || createRequestId(),
    clientId: headers?.get("mcp-session-id")?.trim() || headers?.get("x-client-info")?.trim() || null,
    startedAtMs: Date.now(),
  }
}

export function classifyMcpTool(definition: McpToolDefinition | { name: string; annotations?: McpToolDefinition["annotations"] }) {
  if (definition.name.startsWith("operator.")) return "operator"
  if (definition.annotations?.destructiveHint) return "destructive"
  if (definition.annotations?.readOnlyHint) return "read"
  return "write"
}

export function writeMcpAuditEvent(level: "info" | "warn", input: McpAuditEvent) {
  const event = redactMcpAuditEvent({
    event: input.event,
    surface: "mcp",
    requestId: input.request?.requestId ?? null,
    clientId: input.request?.clientId ? hashForLog(input.request.clientId) : null,
    userIdHash: input.auth?.userId ? hashForLog(input.auth.userId) : null,
    tenantIdHash: input.auth?.subject ? hashForLog(input.auth.subject) : input.auth?.email ? hashForLog(input.auth.email) : null,
    actorRole: input.auth?.actorRole ?? null,
    isInternalOperator: Boolean(input.auth?.isInternalOperator),
    toolName: input.toolName ?? null,
    toolCategory: input.toolCategory ?? null,
    status: input.status ?? null,
    latencyMs: input.latencyMs ?? null,
    errorCode: input.errorCode ?? null,
    message: input.message ?? null,
  })

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

function redactMcpAuditEvent(event: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(event).map(([key, value]) => {
      if (typeof value !== "string") return [key, value]
      return [key, value.replace(SECRET_VALUE_PATTERN, "[redacted]")]
    }),
  )
}

function hashForLog(value: string) {
  let hash = 0x811c9dc5
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }
  return `mcp_${(hash >>> 0).toString(16).padStart(8, "0")}`
}

function createRequestId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID()
  }

  return `mcp_${Math.random().toString(36).slice(2)}`
}
