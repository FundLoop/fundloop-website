import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "../../types/supabase"

export type OnboardingCommandClient = SupabaseClient<Database>

export function parseInteger(value: string) {
  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) ? parsed : null
}

export function parseDecimal(value: string) {
  const parsed = Number.parseFloat(value)
  return Number.isFinite(parsed) ? parsed : null
}

export async function getCryptoContractMethodId(supabase: OnboardingCommandClient) {
  const { data, error } = await supabase.from("ref_payment_methods").select("id").eq("code", "crypto_contract").single()

  if (error || !data) {
    throw new Error(error?.message ?? "Crypto payment method reference is missing")
  }

  return data.id
}
