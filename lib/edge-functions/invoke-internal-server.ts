import "server-only"

import { edgeCommandFailure, isEdgeCommandResult, type EdgeCommandResult } from "./result"
import { normalizeEdgeCommandInvokeError } from "./invoke-server"

const INTERNAL_SECRET_HEADER = "x-fundloop-cron-secret"

function getSupabaseFunctionUrl(functionName: string) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  if (!supabaseUrl) {
    return null
  }

  return `${supabaseUrl.replace(/\/+$/, "")}/functions/v1/${functionName}`
}

export async function invokeInternalServerEdgeCommand<TInput, TOutput>(
  functionName: string,
  input: TInput,
): Promise<EdgeCommandResult<TOutput>> {
  const functionUrl = getSupabaseFunctionUrl(functionName)
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()
  const internalSecret = process.env.FUNDLOOP_PAYMENTS_CRON_SECRET?.trim()

  if (!functionUrl || !anonKey || !internalSecret) {
    return edgeCommandFailure(
      "misconfigured_server",
      "Supabase function invocation is not configured for internal payment operations.",
    )
  }

  try {
    const response = await fetch(functionUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        apikey: anonKey,
        authorization: `Bearer ${anonKey}`,
        [INTERNAL_SECRET_HEADER]: internalSecret,
      },
      body: JSON.stringify(input),
      cache: "no-store",
    })

    const data: unknown = await response.json().catch(() => null)
    if (isEdgeCommandResult<TOutput>(data)) {
      return data
    }

    if (!response.ok) {
      return edgeCommandFailure(
        "function_invoke_failed",
        `Edge Function ${functionName} returned HTTP ${response.status}.`,
      )
    }

    return edgeCommandFailure(
      "invalid_edge_response",
      `Edge Function ${functionName} returned an invalid response envelope.`,
    )
  } catch (error) {
    return normalizeEdgeCommandInvokeError(error)
  }
}
