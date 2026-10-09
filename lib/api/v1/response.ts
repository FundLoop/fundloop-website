import { randomUUID } from "node:crypto"
import { NextResponse } from "next/server"

// Shared response contract for the public /api/v1 surface (#266).
// Shapes come from WondrBot's integration contract: data is always wrapped in `data`, errors in
// `error` with a stable `code` and a `request_id`, lists paginate by opaque cursor, and times are
// ISO-8601 UTC. Response text is plain text, never HTML, and never instructions aimed at an agent.

export const API_V1_MAX_LIMIT = 100
export const API_V1_DEFAULT_LIMIT = 25

export type ApiErrorCode =
  | "unauthorized"
  | "insufficient_scope"
  | "forbidden"
  | "not_found"
  | "conflict"
  | "validation_failed"
  | "rate_limited"
  | "internal_error"

const statusByCode: Record<ApiErrorCode, number> = {
  unauthorized: 401,
  insufficient_scope: 403,
  forbidden: 403,
  not_found: 404,
  conflict: 409,
  validation_failed: 422,
  rate_limited: 429,
  internal_error: 500,
}

export type ApiMeta = { next_cursor?: string | null }

export function requestId() {
  return `fl_req_${randomUUID().replace(/-/g, "")}`
}

function baseHeaders(id: string, extra?: Record<string, string>) {
  // No caching: these answers are per-token or reflect live cycle state.
  return { "Cache-Control": "no-store", "X-Request-Id": id, ...extra }
}

export function apiData<T>(data: T, options?: { meta?: ApiMeta; requestId?: string; headers?: Record<string, string>; status?: number }) {
  const id = options?.requestId ?? requestId()
  const body: { data: T; meta?: ApiMeta } = { data }
  if (options?.meta) body.meta = options.meta
  return NextResponse.json(body, { status: options?.status ?? 200, headers: baseHeaders(id, options?.headers) })
}

export function apiError(
  code: ApiErrorCode,
  message: string,
  options?: { details?: unknown; requestId?: string; headers?: Record<string, string>; status?: number },
) {
  const id = options?.requestId ?? requestId()
  const error: { code: ApiErrorCode; message: string; request_id: string; details?: unknown } = { code, message, request_id: id }
  if (options?.details !== undefined) error.details = options.details
  return NextResponse.json({ error }, { status: options?.status ?? statusByCode[code], headers: baseHeaders(id, options?.headers) })
}

export function insufficientScope(missingScope: string, options?: { requestId?: string }) {
  return apiError("insufficient_scope", `This token is missing the ${missingScope} scope.`, {
    requestId: options?.requestId,
    // RFC 6750 §3.1: name the scope the resource needs.
    headers: { "WWW-Authenticate": `Bearer error="insufficient_scope", scope="${missingScope}"` },
  })
}

export function rateLimited(retryAfterSeconds: number, options?: { requestId?: string }) {
  return apiError("rate_limited", "Too many requests for this grant. Retry after the Retry-After interval.", {
    requestId: options?.requestId,
    headers: { "Retry-After": String(Math.max(1, Math.ceil(retryAfterSeconds))) },
  })
}

// Opaque cursors: callers must not parse them, so the payload stays an implementation detail.
export function encodeCursor(value: Record<string, string | number>) {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64url")
}

export function decodeCursor(cursor: string | null): Record<string, string | number> | null {
  if (!cursor) return null
  try {
    const parsed: unknown = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8"))
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null
    const entries = Object.entries(parsed as Record<string, unknown>).filter(
      (entry): entry is [string, string | number] => typeof entry[1] === "string" || typeof entry[1] === "number",
    )
    return entries.length > 0 ? Object.fromEntries(entries) : null
  } catch {
    return null
  }
}

export function parseLimit(raw: string | null) {
  if (raw === null || raw.trim() === "") return { ok: true as const, limit: API_V1_DEFAULT_LIMIT }
  if (!/^\d{1,4}$/.test(raw.trim())) return { ok: false as const, message: "limit must be a positive integer." }
  const parsed = Number(raw)
  if (parsed < 1) return { ok: false as const, message: "limit must be at least 1." }
  return { ok: true as const, limit: Math.min(parsed, API_V1_MAX_LIMIT) }
}

export function isoOrNull(value: string | null | undefined) {
  if (!value) return null
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString()
}
