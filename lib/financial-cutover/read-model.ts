import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/types/supabase"

export type FinancialCutoverReadMode = "legacy" | "canonical" | "unavailable"

export function resolveFinancialCutoverReadMode(input: {
  data: Pick<Database["public"]["Tables"]["financial_cutover_instance_state"]["Row"],
    "active_run_id" | "canonical_reads_enabled" | "legacy_writes_enabled"> | null
  error: { message?: string } | null
}): FinancialCutoverReadMode {
  if (input.error || !input.data) return "unavailable"
  if (input.data.active_run_id !== null && input.data.canonical_reads_enabled && !input.data.legacy_writes_enabled) {
    return "canonical"
  }
  if (input.data.active_run_id === null && !input.data.canonical_reads_enabled && input.data.legacy_writes_enabled) {
    return "legacy"
  }
  return "unavailable"
}

export async function readFinancialCutoverMode(
  admin: SupabaseClient<Database>,
): Promise<FinancialCutoverReadMode> {
  const result = await admin
    .from("financial_cutover_instance_state")
    .select("active_run_id, canonical_reads_enabled, legacy_writes_enabled")
    .eq("singleton", true)
    .maybeSingle()

  return resolveFinancialCutoverReadMode(result)
}
