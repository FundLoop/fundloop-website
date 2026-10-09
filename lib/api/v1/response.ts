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

// Token-bound answers must never be stored. A tokenless public read is the same for every caller,
// so it may be cached at the edge: that is what keeps an unauthenticated endpoint from turning every
// request into database work.
export const PUBLIC_READ_CACHE_CONTROL = "public, s-maxage=60, stale-while-revalidate=300"

function baseHeaders(id: string, extra?: Record<string, string>) {
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

// Every /api/v1 answer comes through here, so an unknown path or an unsupported method stays inside
// the same envelope instead of falling through to an HTML 404 or a bare 405.
export function methodNotAllowed(allowed: readonly string[], options?: { requestId?: string }) {
  return apiError("not_found", "That method is not supported for this endpoint.", {
    requestId: options?.requestId,
    status: 405,
    headers: { Allow: allowed.join(", ") },
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
  const trimmed = raw.trim()
  // Any digit string clamps to the maximum. Refusing a longer one only differed by how many digits
  // the caller typed: limit=101 and limit=10000 both mean "more than the maximum".
  if (!/^\d+$/.test(trimmed)) return { ok: false as const, message: "limit must be a positive integer." }
  const parsed = Number(trimmed)
  if (parsed < 1) return { ok: false as const, message: "limit must be at least 1." }
  return { ok: true as const, limit: Math.min(parsed, API_V1_MAX_LIMIT) }
}

export function isoOrNull(value: string | null | undefined) {
  if (!value) return null
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString()
}
