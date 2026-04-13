export type RemoteE2EEnv = {
  baseURL: string
  supabaseUrl: string
  serviceRoleKey: string
  e2eSecret: string
}

export type LocalWalletE2EEnv = {
  baseURL: string
  supabaseUrl: string
  serviceRoleKey: string
  e2eSecret: string
  cronSecret: string
  rpcUrl: string
  chainId: number
  injectedAccount: string
}

function readRequiredEnv(name: string) {
  const value = process.env[name]?.trim()
  return value && value.length > 0 ? value : null
}

export function getRemoteE2EEnv(): RemoteE2EEnv | null {
  const baseURL = readRequiredEnv("PLAYWRIGHT_REMOTE_BASE_URL")
  const supabaseUrl = readRequiredEnv("PLAYWRIGHT_REMOTE_SUPABASE_URL")
  const serviceRoleKey = readRequiredEnv("PLAYWRIGHT_REMOTE_SUPABASE_SERVICE_ROLE_KEY")
  const e2eSecret = readRequiredEnv("FUNDLOOP_E2E_SECRET")

  if (!baseURL || !supabaseUrl || !serviceRoleKey || !e2eSecret) {
    return null
  }

  return {
    baseURL,
    supabaseUrl,
    serviceRoleKey,
    e2eSecret,
  }
}

export function getLocalWalletE2EEnv(): LocalWalletE2EEnv | null {
  const baseURL = readRequiredEnv("PLAYWRIGHT_LOCAL_BASE_URL")
  const supabaseUrl = readRequiredEnv("NEXT_PUBLIC_SUPABASE_URL")
  const serviceRoleKey = readRequiredEnv("SUPABASE_SERVICE_ROLE_KEY")
  const e2eSecret = readRequiredEnv("FUNDLOOP_E2E_SECRET")
  const cronSecret = readRequiredEnv("FUNDLOOP_PAYMENTS_CRON_SECRET")
  const rpcUrl = readRequiredEnv("PLAYWRIGHT_LOCAL_RPC_URL")
  const injectedAccount = readRequiredEnv("PLAYWRIGHT_LOCAL_WALLET_ADDRESS")

  if (!baseURL || !supabaseUrl || !serviceRoleKey || !e2eSecret || !cronSecret || !rpcUrl || !injectedAccount) {
    return null
  }

  return {
    baseURL,
    supabaseUrl,
    serviceRoleKey,
    e2eSecret,
    cronSecret,
    rpcUrl,
    chainId: Number.parseInt(process.env.PLAYWRIGHT_LOCAL_CHAIN_ID ?? "8453", 10),
    injectedAccount,
  }
}
