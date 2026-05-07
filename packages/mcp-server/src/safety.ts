import type { McpToolDefinition, McpToolInputProperty, McpToolResult } from "./protocol.ts"

export type McpSafetyResult =
  | {
      ok: true
    }
  | {
      ok: false
      code: "invalid_payload" | "payload_too_large"
      message: string
    }

const DEFAULT_MAX_INPUT_BYTES = 16_384
const DEFAULT_MAX_STRING_LENGTH = 512
const DEFAULT_MAX_OBJECT_KEYS = 32
const DEFAULT_MAX_DEPTH = 5
const DEFAULT_MAX_ARRAY_LENGTH = 20
const DEFAULT_MAX_OUTPUT_TEXT_LENGTH = 12_000
const URL_LIKE_PATTERN = /^https?:\/\//i
const LOCAL_URL_PATTERN = /^https?:\/\/(?:localhost|127\.|10\.|172\.(?:1[6-9]|2\d|3[01])\.|192\.168\.|169\.254\.|\[?::1\]?)/i
const JWT_LIKE_PATTERN = /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g
const BEARER_PATTERN = /\bBearer\s+[A-Za-z0-9._~+/-]+=*/gi
const SECRET_ASSIGNMENT_PATTERN = /\b(?:service[_-]?role|api[_-]?key|secret|token|password)\s*[:=]\s*["']?[^"',\s}]+/gi
const PROMPT_INJECTION_PATTERNS = [
  /ignore\s+(?:all\s+)?previous\s+instructions/gi,
  /reveal\s+(?:the\s+)?secrets?/gi,
  /exfiltrate/gi,
  /call\s+(?:another\s+)?tools?/gi,
  /system\s+prompt/gi,
]

export function validateMcpToolInput(definition: McpToolDefinition, input: unknown): McpSafetyResult {
  const serialized = safeStringify(input)
  if (serialized && serialized.length > DEFAULT_MAX_INPUT_BYTES) {
    return {
      ok: false,
      code: "payload_too_large",
      message: `Tool input exceeds the ${DEFAULT_MAX_INPUT_BYTES} byte MCP payload limit.`,
    }
  }

  const record = asRecord(input)
  if (!record) {
    return { ok: false, code: "invalid_payload", message: "Tool input must be a JSON object." }
  }

  const keyLimit = definition.inputSchema.maxProperties ?? DEFAULT_MAX_OBJECT_KEYS
  if (Object.keys(record).length > keyLimit) {
    return { ok: false, code: "payload_too_large", message: `Tool input has more than ${keyLimit} fields.` }
  }

  const properties = definition.inputSchema.properties ?? {}
  const required = new Set(definition.inputSchema.required ?? [])

  for (const key of required) {
    if (!(key in record)) {
      return { ok: false, code: "invalid_payload", message: `${key} is required.` }
    }
  }

  if (definition.inputSchema.additionalProperties === false) {
    for (const key of Object.keys(record)) {
      if (!(key in properties)) {
        return { ok: false, code: "invalid_payload", message: `${key} is not a supported input field.` }
      }
    }
  }

  for (const [key, property] of Object.entries(properties)) {
    if (!(key in record) || record[key] === undefined) continue
    const result = validateProperty(record[key], property, key, 0)
    if (!result.ok) return result
  }

  return { ok: true }
}

export function sanitizeMcpToolResult(result: McpToolResult): McpToolResult {
  return {
    ...result,
    content: result.content.map((item) => ({
      ...item,
      text: sanitizeMcpText(item.text),
    })),
    structuredContent: sanitizeMcpStructuredContent(result.structuredContent),
  }
}

export function sanitizeMcpText(source: string) {
  let text = source.slice(0, DEFAULT_MAX_OUTPUT_TEXT_LENGTH)
  if (source.length > DEFAULT_MAX_OUTPUT_TEXT_LENGTH) {
    text += "\n[truncated]"
  }

  text = text.replace(BEARER_PATTERN, "Bearer [redacted]")
  text = text.replace(JWT_LIKE_PATTERN, "[redacted-jwt]")
  text = text.replace(SECRET_ASSIGNMENT_PATTERN, (match) => `${match.split(/[:=]/)[0]}=[redacted]`)
  text = text.replace(/<script/gi, "&lt;script")
  for (const pattern of PROMPT_INJECTION_PATTERNS) {
    text = text.replace(pattern, "[redacted-instruction]")
  }

  return text
}

function sanitizeMcpStructuredContent(value: unknown): unknown {
  if (typeof value === "string") return sanitizeMcpText(value)
  if (Array.isArray(value)) return value.map((item) => sanitizeMcpStructuredContent(item))
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, nested]) => [key, sanitizeMcpStructuredContent(nested)]),
    )
  }

  return value
}

function validateProperty(value: unknown, property: McpToolInputProperty, path: string, depth: number): McpSafetyResult {
  const maxDepth = property.maxDepth ?? DEFAULT_MAX_DEPTH
  if (depth > maxDepth) {
    return { ok: false, code: "payload_too_large", message: `${path} is nested too deeply.` }
  }

  if (property.type === "string") return validateString(value, property, path)
  if (property.type === "number") return validateNumber(value, property, path)
  if (property.type === "boolean") {
    return typeof value === "boolean" ? { ok: true } : { ok: false, code: "invalid_payload", message: `${path} must be a boolean.` }
  }
  if (property.type === "object") return validateObject(value, property, path, depth, maxDepth)
  if (property.type === "array") {
    return Array.isArray(value) ? validateUnknown(value, path, depth, maxDepth) : { ok: false, code: "invalid_payload", message: `${path} must be an array.` }
  }

  return validateUnknown(value, path, depth, maxDepth)
}

function validateString(value: unknown, property: McpToolInputProperty, path: string): McpSafetyResult {
  if (typeof value !== "string") {
    return { ok: false, code: "invalid_payload", message: `${path} must be a string.` }
  }

  const maxLength = property.maxLength ?? DEFAULT_MAX_STRING_LENGTH
  if (value.length > maxLength) {
    return { ok: false, code: "payload_too_large", message: `${path} exceeds the ${maxLength} character limit.` }
  }

  if (property.minLength !== undefined && value.trim().length < property.minLength) {
    return { ok: false, code: "invalid_payload", message: `${path} is too short.` }
  }

  if (property.enum && !property.enum.includes(value)) {
    return { ok: false, code: "invalid_payload", message: `${path} is not an allowed value.` }
  }

  if (property.pattern && !new RegExp(property.pattern).test(value)) {
    return { ok: false, code: "invalid_payload", message: `${path} has an invalid format.` }
  }

  const formatResult = validateStringFormat(value, property.format, path)
  if (!formatResult.ok) return formatResult

  if (!property.format && URL_LIKE_PATTERN.test(value)) {
    return { ok: false, code: "invalid_payload", message: `${path} does not accept URLs.` }
  }

  return { ok: true }
}

function validateStringFormat(value: string, format: McpToolInputProperty["format"], path: string): McpSafetyResult {
  if (!format) return { ok: true }
  if (format === "slug" && !/^[a-z0-9][a-z0-9-]{0,78}[a-z0-9]$/.test(value)) {
    return { ok: false, code: "invalid_payload", message: `${path} must be a valid slug.` }
  }
  if (format === "cycle_key" && !/^\d{4}-(0[1-9]|1[0-2])$/.test(value)) {
    return { ok: false, code: "invalid_payload", message: `${path} must use YYYY-MM format.` }
  }
  if (format === "tx_hash" && !/^0x[a-fA-F0-9]{64}$/.test(value)) {
    return { ok: false, code: "invalid_payload", message: `${path} must be a valid transaction hash.` }
  }
  if (format === "wallet_address" && !/^0x[a-fA-F0-9]{40}$/.test(value)) {
    return { ok: false, code: "invalid_payload", message: `${path} must be a valid wallet address.` }
  }
  if (format === "attempt_id" && !/^[A-Za-z0-9_.:-]{1,128}$/.test(value)) {
    return { ok: false, code: "invalid_payload", message: `${path} must be a valid attempt id.` }
  }
  if (URL_LIKE_PATTERN.test(value) && LOCAL_URL_PATTERN.test(value)) {
    return { ok: false, code: "invalid_payload", message: `${path} cannot target local or private network URLs.` }
  }
  return { ok: true }
}

function validateNumber(value: unknown, property: McpToolInputProperty, path: string): McpSafetyResult {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return { ok: false, code: "invalid_payload", message: `${path} must be a finite number.` }
  }

  if (property.integer && !Number.isInteger(value)) {
    return { ok: false, code: "invalid_payload", message: `${path} must be an integer.` }
  }
  if (property.minimum !== undefined && value < property.minimum) {
    return { ok: false, code: "invalid_payload", message: `${path} is below the allowed range.` }
  }
  if (property.maximum !== undefined && value > property.maximum) {
    return { ok: false, code: "invalid_payload", message: `${path} is above the allowed range.` }
  }

  return { ok: true }
}

function validateObject(value: unknown, property: McpToolInputProperty, path: string, depth: number, maxDepth = DEFAULT_MAX_DEPTH): McpSafetyResult {
  const record = asRecord(value)
  if (!record) return { ok: false, code: "invalid_payload", message: `${path} must be a JSON object.` }

  const keyLimit = property.maxProperties ?? DEFAULT_MAX_OBJECT_KEYS
  if (Object.keys(record).length > keyLimit) {
    return { ok: false, code: "payload_too_large", message: `${path} has more than ${keyLimit} fields.` }
  }

  if (property.additionalProperties === false && Object.keys(record).length > 0) {
    return { ok: false, code: "invalid_payload", message: `${path} does not accept nested fields.` }
  }

  for (const [key, nestedValue] of Object.entries(record)) {
    const nestedPath = `${path}.${key}`
    const result = validateUnknown(nestedValue, nestedPath, depth + 1, maxDepth)
    if (!result.ok) return result
  }

  return { ok: true }
}

function validateUnknown(value: unknown, path: string, depth: number, maxDepth = DEFAULT_MAX_DEPTH): McpSafetyResult {
  if (depth > maxDepth) {
    return { ok: false, code: "payload_too_large", message: `${path} is nested too deeply.` }
  }
  if (typeof value === "string") return validateString(value, { type: "string" }, path)
  if (typeof value === "number") return validateNumber(value, { type: "number" }, path)
  if (typeof value === "boolean" || value === null) return { ok: true }
  if (Array.isArray(value)) {
    if (value.length > DEFAULT_MAX_ARRAY_LENGTH) {
      return { ok: false, code: "payload_too_large", message: `${path} has too many values.` }
    }
    for (const [index, nested] of value.entries()) {
      const result = validateUnknown(nested, `${path}.${index}`, depth + 1, maxDepth)
      if (!result.ok) return result
    }
    return { ok: true }
  }
  return validateObject(value, { type: "object" }, path, depth, maxDepth)
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null
}

function safeStringify(value: unknown) {
  try {
    return JSON.stringify(value)
  } catch {
    return null
  }
}
