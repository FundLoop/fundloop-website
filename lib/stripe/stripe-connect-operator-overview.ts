import "server-only"
import { getAdminSupabaseClient } from "@/lib/supabase-admin"

export function isStripeConnectReviewEnabled(env: NodeJS.ProcessEnv = process.env) {
  const deployment = (env.FUNDLOOP_DEPLOYMENT_ENV ?? "production").trim().toLowerCase()
  return ["local", "development", "dev", "preview", "test"].includes(deployment) && env.NEXT_PUBLIC_STRIPE_CONNECT_REVIEW_ENABLED === "true"
}

export async function loadStripeConnectOperatorOverview(monthlyCycleId: number) {
  if (!isStripeConnectReviewEnabled()) return { enabled: false, accounts: [], commands: [] }
  const supabase = getAdminSupabaseClient()
  const [accounts, commands] = await Promise.all([
    supabase.from("stripe_connect_accounts").select("id,user_id,onboarding_status,country_code,default_currency,payouts_enabled,external_account_enabled,external_account_last4,currently_due_count,disabled_reason").order("id"),
    supabase.from("stripe_connect_payout_commands").select("id,payout_intent_id,status,currency_code,gross_minor,user_fee_minor,net_minor,provider_payout_minor,failure_code,submitted_at,settled_at,ledger_transaction_id,payout_intents!inner(monthly_cycle_id)")
      .eq("payout_intents.monthly_cycle_id", monthlyCycleId).order("id", { ascending: false }),
  ])
  return { enabled: true, accounts: accounts.data ?? [], commands: commands.data ?? [], warnings: [accounts.error?.message, commands.error?.message].filter(Boolean) }
}
