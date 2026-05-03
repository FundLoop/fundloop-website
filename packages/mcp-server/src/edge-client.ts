import { edgeCommandFailure, isEdgeCommandResult, type EdgeCommandResult } from "../../../lib/edge-functions/result.ts"
import type { McpAuthContext } from "./auth.ts"

export type EdgeCommandClient = {
  invoke<TInput, TOutput>(functionName: string, input: TInput, auth: McpAuthContext): Promise<EdgeCommandResult<TOutput>>
}

export type SupabaseEdgeCommandClientConfig = {
  supabaseUrl: string
  anonKey: string
}

export function readSupabaseEdgeCommandClientConfig(
  env: Record<string, string | undefined> = process.env,
): SupabaseEdgeCommandClientConfig {
  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL ?? env.SUPABASE_URL
  const anonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? env.SUPABASE_ANON_KEY

  if (!supabaseUrl?.trim()) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL or SUPABASE_URL is required for the MCP server.")
  }

  if (!anonKey?.trim()) {
    throw new Error("NEXT_PUBLIC_SUPABASE_ANON_KEY or SUPABASE_ANON_KEY is required for the MCP server.")
  }

  return {
    supabaseUrl: supabaseUrl.replace(/\/$/, ""),
    anonKey: anonKey.trim(),
  }
}

export class SupabaseEdgeCommandClient implements EdgeCommandClient {
  private readonly config: SupabaseEdgeCommandClientConfig

  constructor(config: SupabaseEdgeCommandClientConfig) {
    this.config = config
  }

  async invoke<TInput, TOutput>(
    functionName: string,
    input: TInput,
    auth: McpAuthContext,
  ): Promise<EdgeCommandResult<TOutput>> {
    const response = await fetch(`${this.config.supabaseUrl}/functions/v1/${functionName}`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${auth.bearerToken}`,
        apikey: this.config.anonKey,
        "content-type": "application/json",
      },
      body: JSON.stringify(input ?? {}),
    })

    const data = (await response.json().catch(() => null)) as unknown
    if (!response.ok) {
      return edgeCommandFailure("function_invoke_failed", `Edge Function ${functionName} returned HTTP ${response.status}.`)
    }

    if (!isEdgeCommandResult<TOutput>(data)) {
      return edgeCommandFailure("invalid_edge_response", `Edge Function ${functionName} returned an invalid response envelope.`)
    }

    return data
  }
}

export function createSupabaseEdgeCommandClient(env: Record<string, string | undefined> = process.env) {
  return new SupabaseEdgeCommandClient(readSupabaseEdgeCommandClientConfig(env))
}
