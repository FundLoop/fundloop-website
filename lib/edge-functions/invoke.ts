import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "../../types/supabase"
import { getSupabaseBrowserClient } from "../supabase"
import { edgeCommandFailure, isEdgeCommandResult, type EdgeCommandFailure, type EdgeCommandResult } from "./result"

type FunctionsCapableClient = Pick<SupabaseClient<Database>, "functions">
type FunctionInvokeOptions = NonNullable<Parameters<FunctionsCapableClient["functions"]["invoke"]>[1]>

function getInvokeErrorMessage(error: unknown) {
  if (error instanceof Error && error.message.trim()) {
    return error.message.trim()
  }

  if (error && typeof error === "object" && "message" in error && typeof (error as { message?: unknown }).message === "string") {
    return (error as { message: string }).message.trim()
  }

  return "Supabase Edge Function invocation failed."
}

export function normalizeEdgeCommandInvokeError(error: unknown): EdgeCommandFailure {
  const code =
    error && typeof error === "object" && "name" in error && typeof (error as { name?: unknown }).name === "string"
      ? (error as { name: string }).name
      : "function_invoke_failed"

  return edgeCommandFailure(code, getInvokeErrorMessage(error))
}

export async function invokeEdgeCommandWithClient<TInput, TOutput>(
  client: FunctionsCapableClient,
  functionName: string,
  input: TInput,
): Promise<EdgeCommandResult<TOutput>> {
  const { data, error } = await client.functions.invoke(functionName, {
    body: input as FunctionInvokeOptions["body"],
  })

  if (error) {
    const context = error && typeof error === "object" && "context" in error
      ? (error as { context?: unknown }).context
      : null
    if (context && typeof context === "object" && "json" in context && typeof (context as { json?: unknown }).json === "function") {
      try {
        const responseBody = await (context as { json: () => Promise<unknown> }).json()
        if (isEdgeCommandResult<TOutput>(responseBody)) return responseBody
      } catch {
        // Fall through to the normalized transport error when the response body is not readable JSON.
      }
    }
    return normalizeEdgeCommandInvokeError(error)
  }

  if (!isEdgeCommandResult<TOutput>(data)) {
    return edgeCommandFailure("invalid_edge_response", `Edge Function ${functionName} returned an invalid response envelope.`)
  }

  return data
}

export async function invokeBrowserEdgeCommand<TInput, TOutput>(functionName: string, input: TInput) {
  return invokeEdgeCommandWithClient<TInput, TOutput>(getSupabaseBrowserClient(), functionName, input)
}
