export type LocalPersonaEnv = {
  baseURL: string
  supabaseUrl: string
  anonKey: string
  serviceRoleKey: string
  mailpitUrl: string
  cycleBase: string
}
export type PersonaPreflightOptions = {
  remoteFixtures?: boolean
  remoteBaseUrl?: boolean
  supabaseMutation?: "none" | "link" | "push" | "reset-remote"
  payoutExecution?: boolean
}

function required(env: NodeJS.ProcessEnv, name: string) {
  const value = env[name]?.trim()
  if (!value) throw new Error(`persona-env-missing-${name.toLowerCase().replaceAll("_", "-")}`)
  return value
}

function normalizedOrigin(value: string) {
  const url = new URL(value)
  if (url.hostname === "localhost") url.hostname = "127.0.0.1"
  return url.origin
}

function assertLoopback(value: string, expectedPort: string, reasonCode: string) {
  const url = new URL(value)
  const hostname = url.hostname === "localhost" ? "127.0.0.1" : url.hostname
  if (hostname !== "127.0.0.1" || url.port !== expectedPort || !["http:", "https:"].includes(url.protocol)) {
    throw new Error(reasonCode)
  }
}

export function readLocalPersonaEnv(env: NodeJS.ProcessEnv = process.env): LocalPersonaEnv {
  if (env.FUNDLOOP_DEPLOYMENT_ENV?.trim() !== "local") throw new Error("persona-env-not-local")

  const supabaseUrl = required(env, "NEXT_PUBLIC_SUPABASE_URL")
  const baseURL = env.PLAYWRIGHT_PERSONA_BASE_URL?.trim() || "http://127.0.0.1:3002"
  const mailpitUrl = env.PLAYWRIGHT_PERSONA_MAILPIT_URL?.trim() || "http://127.0.0.1:55324"
  if (normalizedOrigin(supabaseUrl) !== "http://127.0.0.1:55321") throw new Error("persona-supabase-origin-refused")
  assertLoopback(baseURL, "3002", "persona-base-url-refused")
  assertLoopback(mailpitUrl, "55324", "persona-mailpit-url-refused")

  const cycleBase = env.FUNDLOOP_PERSONA_CYCLE_BASE?.trim() || "2035-01"
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(cycleBase)) throw new Error("persona-cycle-base-invalid")

  return {
    baseURL,
    supabaseUrl: normalizedOrigin(supabaseUrl),
    anonKey: required(env, "NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    serviceRoleKey: required(env, "SUPABASE_SERVICE_ROLE_KEY"),
    mailpitUrl: normalizedOrigin(mailpitUrl),
    cycleBase,
  }
}

export function assertPersonaOptions(options: PersonaPreflightOptions) {
  if (options.remoteFixtures || options.remoteBaseUrl) throw new Error("persona-remote-option-refused")
  if (options.supabaseMutation && options.supabaseMutation !== "none") throw new Error("persona-supabase-operation-refused")
  if (options.payoutExecution) throw new Error("persona-payout-execution-refused")
}

export async function probeLocalPersonaServices(
  env: LocalPersonaEnv,
  fetcher: typeof fetch = fetch,
) {
  const checks = [
    [`${env.supabaseUrl}/auth/v1/health`, { apikey: env.anonKey }],
    [`${env.mailpitUrl}/api/v1/info`, {}],
  ] as const

  for (const [url, headers] of checks) {
    try {
      const response = await fetcher(url, { headers, signal: AbortSignal.timeout(5_000) })
      if (!response.ok) throw new Error("not-ok")
    } catch {
      throw new Error(url.includes("/auth/") ? "persona-supabase-unavailable" : "persona-mailpit-unavailable")
    }
  }
}
