const DEFAULT_CUBID_API_BASE_URL = "https://passport.cubid.me/api/v2"

function readEnv(name: string) {
  if (typeof process !== "undefined" && process.env && typeof process.env[name] === "string") {
    const value = process.env[name]
    if (value && value.trim()) {
      return value.trim()
    }
  }

  const denoEnv = (globalThis as { Deno?: { env?: { get?: (key: string) => string | undefined } } }).Deno?.env?.get
  const runtimeValue = denoEnv?.(name)
  return runtimeValue?.trim() || undefined
}

export type CubidConfig = {
  dappId: string
  apiKey: string
  baseUrl: string
}

export type CubidWeb2Config = CubidConfig & {
  stampPageId: string | null
}

export function getCubidConfig(): CubidConfig {
  const dappId = readEnv("CUBID_DAPP_ID")
  const apiKey = readEnv("CUBID_API_KEY")
  const baseUrl = readEnv("CUBID_API_BASE_URL") ?? DEFAULT_CUBID_API_BASE_URL

  if (!dappId || !apiKey) {
    throw new Error("CUBID_DAPP_ID and CUBID_API_KEY must be configured.")
  }

  return {
    dappId,
    apiKey,
    baseUrl,
  }
}

export function getCubidWeb2Config(): CubidWeb2Config {
  const config = getCubidConfig()
  const stampPageId = readEnv("CUBID_STAMP_PAGE_ID") ?? null

  return {
    ...config,
    stampPageId,
  }
}

export function getCubidPassportOrigin(baseUrl = getCubidConfig().baseUrl) {
  return new URL(baseUrl).origin
}

export { DEFAULT_CUBID_API_BASE_URL }
