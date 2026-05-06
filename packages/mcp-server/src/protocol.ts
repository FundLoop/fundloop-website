export type McpToolContent = {
  type: "text"
  text: string
}

export type McpToolInputProperty = {
  type?: "string" | "number" | "boolean" | "object" | "array"
  description?: string
  enum?: string[]
  format?: "slug" | "cycle_key" | "tx_hash" | "wallet_address" | "attempt_id"
  pattern?: string
  minLength?: number
  maxLength?: number
  minimum?: number
  maximum?: number
  integer?: boolean
  maxProperties?: number
  maxDepth?: number
  additionalProperties?: boolean
}

export type McpToolResult = {
  content: McpToolContent[]
  structuredContent?: unknown
  isError?: boolean
  errorCode?: string
}

export type McpToolDefinition = {
  name: string
  title?: string
  description: string
  annotations?: {
    readOnlyHint?: boolean
    destructiveHint?: boolean
    openWorldHint?: boolean
  }
  inputSchema: {
    type: "object"
    properties?: Record<string, McpToolInputProperty>
    required?: string[]
    additionalProperties?: boolean
    maxProperties?: number
  }
  outputSchema?: {
    type: "object"
    properties?: Record<string, McpToolInputProperty>
    required?: string[]
    additionalProperties?: boolean
  }
}

export type JsonRpcRequest = {
  jsonrpc: "2.0"
  id?: string | number | null
  method: string
  params?: unknown
}

export type JsonRpcResponse =
  | {
      jsonrpc: "2.0"
      id: string | number | null
      result: unknown
    }
  | {
      jsonrpc: "2.0"
      id: string | number | null
      error: {
        code: number
        message: string
      }
    }

export function textResult(text: string): McpToolResult {
  return {
    content: [{ type: "text", text }],
  }
}

export function errorResult(text: string): McpToolResult {
  return {
    content: [{ type: "text", text }],
    isError: true,
  }
}

export function jsonTextResult(value: unknown): McpToolResult {
  return {
    ...textResult(JSON.stringify(value, null, 2)),
    structuredContent: value,
  }
}

export function isJsonRpcRequest(value: unknown): value is JsonRpcRequest {
  return Boolean(
    value &&
      typeof value === "object" &&
      (value as { jsonrpc?: unknown }).jsonrpc === "2.0" &&
      typeof (value as { method?: unknown }).method === "string",
  )
}
