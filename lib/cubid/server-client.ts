import "server-only"

import { createCubidApiClient } from "@cubid/api"
import { createCubidWeb2Client } from "@cubid/web2"
import { getCubidConfig, getCubidWeb2Config } from "./config.ts"

export function createServerCubidApiClient() {
  const config = getCubidConfig()

  return createCubidApiClient({
    apiKey: config.apiKey,
    baseUrl: config.baseUrl,
    dappId: config.dappId,
    fetch,
  })
}

export function createServerCubidWeb2Client() {
  const config = getCubidWeb2Config()
  const apiClient = createServerCubidApiClient()

  return createCubidWeb2Client(apiClient, {
    allowPath: "/widget-allow",
    passportOrigin: new URL(config.baseUrl).origin,
  })
}
