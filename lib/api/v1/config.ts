// Hosts for the public API (#266). Kept as configuration so the sandbox, and later the OAuth
// issuer and redirect allowlist, move without code changes.
//
// Production: https://www.fundloop.org
// Sandbox:    https://dev.fundloop.org (publicly reachable, backed by the FundLoop Dev project)

const PRODUCTION_BASE_URL = "https://www.fundloop.org"
const SANDBOX_BASE_URL = "https://dev.fundloop.org"

// A plain record rather than NodeJS.ProcessEnv, so callers and tests can pass a literal.
export type EnvLike = Record<string, string | undefined>

function normalize(value: string | undefined, fallback: string) {
  const trimmed = value?.trim()
  if (!trimmed) return fallback
  try {
    const url = new URL(trimmed)
    if (url.protocol !== "https:") return fallback
    return url.origin
  } catch {
    return fallback
  }
}

export function publicApiBaseUrl(env: EnvLike = process.env) {
  return normalize(env.FUNDLOOP_PUBLIC_API_BASE_URL, PRODUCTION_BASE_URL)
}

export function sandboxApiBaseUrl(env: EnvLike = process.env) {
  return normalize(env.FUNDLOOP_SANDBOX_API_BASE_URL, SANDBOX_BASE_URL)
}

export function apiServers(env: EnvLike = process.env) {
  const production = publicApiBaseUrl(env)
  const sandbox = sandboxApiBaseUrl(env)
  const servers = [{ url: `${production}/api/v1`, description: "Production" }]
  if (sandbox !== production) servers.push({ url: `${sandbox}/api/v1`, description: "Sandbox" })
  return servers
}
