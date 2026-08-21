import { createCubidApiClient } from "@cubid/core"
import { getCubidConfig } from "./config.ts"

export function createServerCubidApiClient() {
  const config = getCubidConfig()

  return createCubidApiClient({
    apiKey: config.apiKey,
    baseUrl: config.baseUrl,
    dappId: config.dappId,
    fetch,
  })
}
