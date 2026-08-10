import "server-only"
import { createServerSupabaseClient } from "@/lib/supabase-server"

export type StripeConnectOverview = {
  available: boolean
  account: null | {
    status: "incomplete" | "requirements_due" | "ready" | "restricted"
    countryCode: "US" | "CA"
    defaultCurrency: "USD" | "CAD"
    payoutsEnabled: boolean
    externalAccountEnabled: boolean
    externalAccountLast4: string | null
    currentlyDueCount: number
    disabledReason: string | null
    updatedAt: string
  }
  payouts: Array<{ id: number; currencyCode: string; grossMinor: string; feeMinor: string; netMinor: string; status: string; failureCode: string | null; createdAt: string; settledAt: string | null }>
}

export function isStripeConnectSandboxEnabled(environment: Record<string, string | undefined> = process.env) {
  const value = (environment.FUNDLOOP_DEPLOYMENT_ENV ?? environment.NEXT_PUBLIC_FUNDLOOP_DEPLOYMENT_ENV ?? environment.VERCEL_ENV)?.toLowerCase()
  return value !== undefined && ["local", "development", "dev", "preview", "test"].includes(value)
}

export async function getStripeConnectOverview(userId: string | undefined): Promise<StripeConnectOverview> {
  if (!userId || !isStripeConnectSandboxEnabled()) return { available: false, account: null, payouts: [] }
  const supabase = await createServerSupabaseClient()
  const [account, payouts] = await Promise.all([
    supabase.from("stripe_connect_accounts").select("onboarding_status,country_code,default_currency,payouts_enabled,external_account_enabled,external_account_last4,currently_due_count,disabled_reason,updated_at").eq("user_id", userId).maybeSingle(),
    supabase.from("user_stripe_connect_payouts").select("id,currency_code,gross_minor,user_fee_minor,net_minor,status,failure_code,created_at,settled_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(5),
  ])
  const row = account.data
  const accountStatus = row?.onboarding_status as NonNullable<StripeConnectOverview["account"]>["status"]
  return { available: true, account: row ? { status: accountStatus, countryCode: row.country_code as "US" | "CA", defaultCurrency: row.default_currency as "USD" | "CAD",
    payoutsEnabled: row.payouts_enabled, externalAccountEnabled: row.external_account_enabled, externalAccountLast4: row.external_account_last4,
    currentlyDueCount: row.currently_due_count, disabledReason: row.disabled_reason, updatedAt: row.updated_at } : null,
    payouts: (payouts.data ?? []).filter((item) => item.id !== null && item.currency_code !== null && item.status !== null && item.created_at !== null)
      .map((item) => ({ id: item.id!, currencyCode: item.currency_code!, grossMinor: String(item.gross_minor), feeMinor: String(item.user_fee_minor),
        netMinor: String(item.net_minor), status: item.status!, failureCode: item.failure_code, createdAt: item.created_at!, settledAt: item.settled_at })) }
}
