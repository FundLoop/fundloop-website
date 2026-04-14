import "server-only"

import { createServerSupabaseClient } from "../supabase-server"
import { invokeEdgeCommandWithClient } from "./invoke"

export { normalizeEdgeCommandInvokeError } from "./invoke"

export async function invokeServerEdgeCommand<TInput, TOutput>(functionName: string, input: TInput) {
  const client = await createServerSupabaseClient()
  return invokeEdgeCommandWithClient<TInput, TOutput>(client, functionName, input)
}
