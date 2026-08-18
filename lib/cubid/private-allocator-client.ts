import { createHash, createPrivateKey, sign, randomUUID, randomBytes } from "node:crypto"

export const CUBID_ALLOCATOR_CONTRACT_VERSION = "2026-08-14" as const
export const CUBID_ALLOCATOR_CLIENT_NAME = "fundloop-allocator" as const
export const CUBID_ALLOCATOR_DEFAULT_ROUTE = "/api/internal/v1/allocator/resolve" as const

export type CubidAllocatorEnvironment = "development" | "preview" | "production"

export type CubidAllocatorRequestItem = {
  project_scoped_uuid: string
}

export type CubidAllocatorRequestBody = {
  contract_version: typeof CUBID_ALLOCATOR_CONTRACT_VERSION
  project_id: number
  items: CubidAllocatorRequestItem[]
}

export type CubidAllocatorResponseItemStatus = "resolved" | "not_found" | "stale" | "conflict"

export type CubidAllocatorResponseItem = {
  project_scoped_uuid: string
  fundloop_scoped_uid: string | null
  score: number | null
  score_version: string | null
  score_observed_at: string | null
  evidence_hash: string | null
  status: CubidAllocatorResponseItemStatus
}

export type CubidAllocatorResponseBody = {
  contract_version: typeof CUBID_ALLOCATOR_CONTRACT_VERSION
  request_id: string
  items: CubidAllocatorResponseItem[]
}

export type CubidAllocatorKeyConfig = {
  keyId: string
  privateKeyPem: string
}

export type CubidAllocatorClientConfig = {
  baseUrl: string
  route?: string
  environment: CubidAllocatorEnvironment
  primaryKey: CubidAllocatorKeyConfig
  secondaryKey?: CubidAllocatorKeyConfig
  timeoutMs?: number
  fetchFn?: typeof fetch
}

export type SignedRequestHeaders = {
  "Content-Type": "application/json"
  "X-Cubid-Allocator-Client": typeof CUBID_ALLOCATOR_CLIENT_NAME
  "X-Cubid-Allocator-Environment": CubidAllocatorEnvironment
  "X-Cubid-Allocator-Key-Id": string
  "X-Cubid-Allocator-Contract-Version": typeof CUBID_ALLOCATOR_CONTRACT_VERSION
  "X-Cubid-Allocator-Request-Id": string
  "X-Cubid-Allocator-Timestamp": string
  "X-Cubid-Allocator-Nonce": string
  "Idempotency-Key": string
  "X-Cubid-Allocator-Signature": string
}

export type PrivateAllocatorResolveResult =
  | { ok: true; data: CubidAllocatorResponseBody; rawResponse: unknown }
  | { ok: false; error: string; code: string; status?: number; retryable: boolean }

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function canonicalJsonStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value)
  }
  if (Array.isArray(value)) {
    return "[" + value.map(item => canonicalJsonStringify(item)).join(",") + "]"
  }
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([_, v]) => v !== undefined)
    .sort(([a], [b]) => a.localeCompare(b))
  return "{" + entries.map(([k, v]) => JSON.stringify(k) + ":" + canonicalJsonStringify(v)).join(",") + "}"
}

export function buildSigningString(params: {
  method: string
  route: string
  contractVersion: string
  client: string
  environment: string
  keyId: string
  requestId: string
  timestamp: string
  nonce: string
  canonicalBody: string
}): string {
  const bodySha256 = createHash("sha256").update(params.canonicalBody, "utf8").digest("hex")
  return [
    params.method.toUpperCase(),
    params.route,
    params.contractVersion,
    params.client,
    params.environment,
    params.keyId,
    params.requestId,
    params.timestamp,
    params.nonce,
    bodySha256,
  ].join("\n")
}

export function signPayloadWithEd25519(signingString: string, privateKeyPem: string): string {
  const privKey = createPrivateKey(privateKeyPem)
  const signatureBuffer = sign(null, Buffer.from(signingString, "utf8"), privKey)
  return signatureBuffer.toString("base64url")
}

export function buildSignedHeaders(params: {
  route?: string
  environment: CubidAllocatorEnvironment
  keyConfig: CubidAllocatorKeyConfig
  canonicalBody: string
  idempotencyKey?: string
  requestId?: string
  timestamp?: string
  nonce?: string
}): SignedRequestHeaders {
  const route = params.route ?? CUBID_ALLOCATOR_DEFAULT_ROUTE
  const requestId = params.requestId ?? `fl_req_${randomUUID().replace(/-/g, "")}`
  const timestamp = params.timestamp ?? new Date().toISOString()
  const nonce = params.nonce ?? `fl_nonce_${randomBytes(16).toString("hex")}`
  const idempotencyKey = params.idempotencyKey ?? `fl_idem_${randomUUID().replace(/-/g, "")}`

  const signingString = buildSigningString({
    method: "POST",
    route,
    contractVersion: CUBID_ALLOCATOR_CONTRACT_VERSION,
    client: CUBID_ALLOCATOR_CLIENT_NAME,
    environment: params.environment,
    keyId: params.keyConfig.keyId,
    requestId,
    timestamp,
    nonce,
    canonicalBody: params.canonicalBody,
  })

  const signature = signPayloadWithEd25519(signingString, params.keyConfig.privateKeyPem)

  return {
    "Content-Type": "application/json",
    "X-Cubid-Allocator-Client": CUBID_ALLOCATOR_CLIENT_NAME,
    "X-Cubid-Allocator-Environment": params.environment,
    "X-Cubid-Allocator-Key-Id": params.keyConfig.keyId,
    "X-Cubid-Allocator-Contract-Version": CUBID_ALLOCATOR_CONTRACT_VERSION,
    "X-Cubid-Allocator-Request-Id": requestId,
    "X-Cubid-Allocator-Timestamp": timestamp,
    "X-Cubid-Allocator-Nonce": nonce,
    "Idempotency-Key": idempotencyKey,
    "X-Cubid-Allocator-Signature": signature,
  }
}

export function validateCubidAllocatorRequestBody(body: unknown): { ok: true; data: CubidAllocatorRequestBody } | { ok: false; error: string } {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, error: "Request body must be a non-null object." }
  }
  const obj = body as Record<string, unknown>
  const allowedKeys = new Set(["contract_version", "project_id", "items"])
  for (const k of Object.keys(obj)) {
    if (!allowedKeys.has(k)) {
      return { ok: false, error: `Forbidden or unexpected key in request body: ${k}` }
    }
  }
  if (obj.contract_version !== CUBID_ALLOCATOR_CONTRACT_VERSION) {
    return { ok: false, error: `contract_version must be '${CUBID_ALLOCATOR_CONTRACT_VERSION}'` }
  }
  if (typeof obj.project_id !== "number" || !Number.isSafeInteger(obj.project_id) || obj.project_id <= 0) {
    return { ok: false, error: "project_id must be a positive integer" }
  }
  if (!Array.isArray(obj.items)) {
    return { ok: false, error: "items must be an array" }
  }
  if (obj.items.length < 1 || obj.items.length > 50) {
    return { ok: false, error: `items length must be between 1 and 50 (got ${obj.items.length})` }
  }

  const seenUuids = new Set<string>()
  const items: CubidAllocatorRequestItem[] = []

  for (let i = 0; i < obj.items.length; i++) {
    const item = obj.items[i]
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      return { ok: false, error: `Item at index ${i} must be an object` }
    }
    const itemObj = item as Record<string, unknown>
    const itemKeys = Object.keys(itemObj)
    if (itemKeys.length !== 1 || itemKeys[0] !== "project_scoped_uuid") {
      return { ok: false, error: `Item at index ${i} must only contain 'project_scoped_uuid'` }
    }
    const uuid = itemObj.project_scoped_uuid
    if (typeof uuid !== "string" || !uuidPattern.test(uuid)) {
      return { ok: false, error: `Invalid UUID format for project_scoped_uuid at index ${i}` }
    }
    if (seenUuids.has(uuid)) {
      return { ok: false, error: `Duplicate project_scoped_uuid at index ${i}: ${uuid}` }
    }
    seenUuids.add(uuid)
    items.push({ project_scoped_uuid: uuid })
  }

  return {
    ok: true,
    data: {
      contract_version: CUBID_ALLOCATOR_CONTRACT_VERSION,
      project_id: obj.project_id,
      items,
    },
  }
}

export function validateCubidAllocatorResponseBody(body: unknown): { ok: true; data: CubidAllocatorResponseBody } | { ok: false; error: string } {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, error: "Response body must be an object." }
  }
  const obj = body as Record<string, unknown>
  const allowedKeys = new Set(["contract_version", "request_id", "items"])
  for (const k of Object.keys(obj)) {
    if (!allowedKeys.has(k)) {
      return { ok: false, error: `Forbidden or unexpected key in response body: ${k}` }
    }
  }
  if (obj.contract_version !== CUBID_ALLOCATOR_CONTRACT_VERSION) {
    return { ok: false, error: `Response contract_version must be '${CUBID_ALLOCATOR_CONTRACT_VERSION}'` }
  }
  if (typeof obj.request_id !== "string" || obj.request_id.length < 8) {
    return { ok: false, error: "Response request_id is invalid" }
  }
  if (!Array.isArray(obj.items)) {
    return { ok: false, error: "Response items must be an array" }
  }

  const items: CubidAllocatorResponseItem[] = []
  const allowedItemKeys = new Set([
    "project_scoped_uuid",
    "fundloop_scoped_uid",
    "score",
    "score_version",
    "score_observed_at",
    "evidence_hash",
    "status",
  ])

  for (let i = 0; i < obj.items.length; i++) {
    const item = obj.items[i]
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      return { ok: false, error: `Response item at index ${i} must be an object` }
    }
    const itemObj = item as Record<string, unknown>
    for (const k of Object.keys(itemObj)) {
      if (!allowedItemKeys.has(k)) {
        return { ok: false, error: `Forbidden or unexpected key '${k}' in response item at index ${i}` }
      }
    }

    const uuid = itemObj.project_scoped_uuid
    if (typeof uuid !== "string" || !uuidPattern.test(uuid)) {
      return { ok: false, error: `Invalid project_scoped_uuid in response at index ${i}` }
    }

    const status = itemObj.status
    if (status !== "resolved" && status !== "not_found" && status !== "stale" && status !== "conflict") {
      return { ok: false, error: `Invalid status '${status}' in response item at index ${i}` }
    }

    if (status === "resolved") {
      if (typeof itemObj.fundloop_scoped_uid !== "string" || !uuidPattern.test(itemObj.fundloop_scoped_uid)) {
        return { ok: false, error: `Resolved item at index ${i} missing valid fundloop_scoped_uid` }
      }
      if (typeof itemObj.score !== "number" || itemObj.score < 0) {
        return { ok: false, error: `Resolved item at index ${i} missing valid numeric score` }
      }
      if (typeof itemObj.score_version !== "string" || itemObj.score_version.length === 0) {
        return { ok: false, error: `Resolved item at index ${i} missing score_version` }
      }
      if (typeof itemObj.score_observed_at !== "string" || Number.isNaN(Date.parse(itemObj.score_observed_at))) {
        return { ok: false, error: `Resolved item at index ${i} missing valid score_observed_at timestamp` }
      }
      if (typeof itemObj.evidence_hash !== "string" || !/^[0-9a-f]{64}$/i.test(itemObj.evidence_hash)) {
        return { ok: false, error: `Resolved item at index ${i} missing valid sha256 evidence_hash` }
      }
    } else {
      if (
        itemObj.fundloop_scoped_uid !== null ||
        itemObj.score !== null ||
        itemObj.score_version !== null ||
        itemObj.score_observed_at !== null ||
        itemObj.evidence_hash !== null
      ) {
        return { ok: false, error: `Non-resolved item at index ${i} (status: ${status}) must have null resolution fields` }
      }
    }

    items.push({
      project_scoped_uuid: uuid,
      fundloop_scoped_uid: (itemObj.fundloop_scoped_uid as string) ?? null,
      score: (itemObj.score as number) ?? null,
      score_version: (itemObj.score_version as string) ?? null,
      score_observed_at: (itemObj.score_observed_at as string) ?? null,
      evidence_hash: (itemObj.evidence_hash as string) ?? null,
      status,
    })
  }

  return {
    ok: true,
    data: {
      contract_version: CUBID_ALLOCATOR_CONTRACT_VERSION,
      request_id: obj.request_id,
      items,
    },
  }
}

export class PrivateCubidAllocatorClient {
  private config: CubidAllocatorClientConfig

  constructor(config: CubidAllocatorClientConfig) {
    if (!config.baseUrl) throw new Error("PrivateCubidAllocatorClient requires baseUrl")
    if (!config.primaryKey?.keyId || !config.primaryKey?.privateKeyPem) {
      throw new Error("PrivateCubidAllocatorClient requires valid primaryKey with keyId and privateKeyPem")
    }
    this.config = {
      ...config,
      route: config.route ?? CUBID_ALLOCATOR_DEFAULT_ROUTE,
      timeoutMs: config.timeoutMs ?? 5000,
      fetchFn: config.fetchFn ?? globalThis.fetch,
    }
  }

  async resolveBatch(
    request: CubidAllocatorRequestBody,
    options?: {
      idempotencyKey?: string
      useSecondaryKey?: boolean
      maxRetries?: number
    }
  ): Promise<PrivateAllocatorResolveResult> {
    const validatedRequest = validateCubidAllocatorRequestBody(request)
    if (!validatedRequest.ok) {
      return { ok: false, error: validatedRequest.error, code: "invalid_request_body", retryable: false }
    }

    const keyConfig = options?.useSecondaryKey && this.config.secondaryKey
      ? this.config.secondaryKey
      : this.config.primaryKey

    const canonicalBody = canonicalJsonStringify(validatedRequest.data)
    const url = `${this.config.baseUrl.replace(/\/$/, "")}${this.config.route}`
    const idempotencyKey = options?.idempotencyKey ?? `fl_idem_${randomUUID().replace(/-/g, "")}`
    const maxRetries = options?.maxRetries ?? 2

    let lastError = "Request failed"
    let lastCode = "request_failed"
    let lastStatus: number | undefined
    let isRetryable = false

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      const headers = buildSignedHeaders({
        route: this.config.route,
        environment: this.config.environment,
        keyConfig,
        canonicalBody,
        idempotencyKey,
      })

      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), this.config.timeoutMs)

      try {
        const response = await this.config.fetchFn!(url, {
          method: "POST",
          headers,
          body: canonicalBody,
          signal: controller.signal,
        })
        clearTimeout(timeoutId)
        lastStatus = response.status

        const rawJson: unknown = await response.json().catch(() => null)

        if (response.ok) {
          const validatedResponse = validateCubidAllocatorResponseBody(rawJson)
          if (!validatedResponse.ok) {
            return {
              ok: false,
              error: `Invalid response schema from Cubid allocator: ${validatedResponse.error}`,
              code: "invalid_response_schema",
              status: response.status,
              retryable: false,
            }
          }
          return { ok: true, data: validatedResponse.data, rawResponse: rawJson }
        }

        if (response.status === 400 || response.status === 401 || response.status === 403 || response.status === 422) {
          const errObj = rawJson && typeof rawJson === "object" ? (rawJson as Record<string, unknown>) : {}
          const errorMsg = (errObj.error as string) || (errObj.message as string) || `HTTP ${response.status}`
          const code = (errObj.code as string) || "client_error"
          return { ok: false, error: errorMsg, code, status: response.status, retryable: false }
        }

        if (response.status === 502 || response.status === 503 || response.status === 504 || response.status === 429) {
          isRetryable = true
          lastError = `Temporary upstream error HTTP ${response.status}`
          lastCode = response.status === 429 ? "rate_limited" : "upstream_unavailable"
          if (attempt < maxRetries) {
            const backoffMs = Math.min(200 * Math.pow(2, attempt), 1000)
            await new Promise(r => setTimeout(r, backoffMs))
            continue
          }
        } else {
          lastError = `Upstream error HTTP ${response.status}`
          lastCode = "upstream_error"
          isRetryable = false
          break
        }
      } catch (err: unknown) {
        clearTimeout(timeoutId)
        const isAbort = (err as Error)?.name === "AbortError"
        lastError = isAbort ? `Request timed out after ${this.config.timeoutMs}ms` : (err as Error)?.message || "Network error"
        lastCode = isAbort ? "timeout" : "network_error"
        isRetryable = true

        if (attempt < maxRetries) {
          const backoffMs = Math.min(200 * Math.pow(2, attempt), 1000)
          await new Promise(r => setTimeout(r, backoffMs))
          continue
        }
      }
    }

    return {
      ok: false,
      error: lastError,
      code: lastCode,
      status: lastStatus,
      retryable: isRetryable,
    }
  }
}
