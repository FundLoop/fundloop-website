import { edgeCommandFailure, edgeCommandSuccess } from "../../../lib/edge-functions/result.ts"
import localManifestJson from "../../../lib/onchain/deployments/local.json" with { type: "json" }
import previewManifestJson from "../../../lib/onchain/deployments/preview.json" with { type: "json" }
import productionManifestJson from "../../../lib/onchain/deployments/production.json" with { type: "json" }
import { authenticateRequest, corsHeaders, json, parseJsonBody, serve } from "./command-runtime.ts"

const ZERO_REOWN_PROJECT_ID = "00000000000000000000000000000000"

const DEPLOYMENT_MANIFESTS = {
  local: localManifestJson,
  preview: previewManifestJson,
  production: productionManifestJson,
}

const RPC_ENV_BY_NETWORK = {
  ethereum: "NEXT_PUBLIC_ETHEREUM_RPC_URL",
  base: "NEXT_PUBLIC_BASE_RPC_URL",
  celo: "NEXT_PUBLIC_CELO_RPC_URL",
}

const DISPLAY_NAME_BY_NETWORK = {
  ethereum: "Ethereum",
  base: "Base",
  celo: "Celo",
}

function getDenoRuntime() {
  return typeof globalThis === "object" && globalThis && "Deno" in globalThis ? globalThis.Deno : undefined
}

function getEnv(name) {
  return getDenoRuntime()?.env?.get?.(name)
}

function resolveDeploymentEnvironment() {
  const explicitValue = getEnv("FUNDLOOP_DEPLOYMENT_ENV")?.trim()?.toLowerCase()
  if (explicitValue === "local" || explicitValue === "preview" || explicitValue === "production") {
    return explicitValue
  }

  const vercelValue = getEnv("VERCEL_ENV")?.trim()?.toLowerCase()
  if (vercelValue === "local" || vercelValue === "preview" || vercelValue === "production") {
    return vercelValue
  }

  return "local"
}

function getManifest(environment) {
  if (environment === "local") {
    const override = getEnv("NEXT_PUBLIC_FUNDLOOP_LOCAL_WALLET_MANIFEST_JSON")?.trim()
    if (override) {
      try {
        return JSON.parse(override)
      } catch {
        return DEPLOYMENT_MANIFESTS.local
      }
    }
  }

  return DEPLOYMENT_MANIFESTS[environment]
}

function normalizeAddress(value) {
  return String(value ?? "").trim().toLowerCase()
}

function buildPaymentOperationDeps() {
  const environment = resolveDeploymentEnvironment()
  const manifest = getManifest(environment)
  const reownProjectId = getEnv("NEXT_PUBLIC_REOWN_PROJECT_ID")?.trim()
  const reownConfigured = Boolean(reownProjectId && reownProjectId !== ZERO_REOWN_PROJECT_ID)

  return {
    environment,
    getDeploymentAvailabilityForRoute(input) {
      const networkKey = input.networkKey
      const rpcEnvName = RPC_ENV_BY_NETWORK[networkKey]
      if (!rpcEnvName) {
        return {
          available: false,
          reason: `No enabled ${networkKey} wallet deployment is configured for ${environment}.`,
        }
      }

      const manifestChain = (manifest.chains ?? []).find((chain) => chain.networkKey === networkKey && chain.enabled)
      if (!manifestChain || !reownConfigured || !getEnv(rpcEnvName)) {
        return {
          available: false,
          reason: `No enabled ${networkKey} wallet deployment is configured for ${environment}.`,
        }
      }

      const displayName = DISPLAY_NAME_BY_NETWORK[networkKey] ?? networkKey
      if (normalizeAddress(manifestChain.contractAddress) !== normalizeAddress(input.contractAddress)) {
        return {
          available: false,
          reason: `${displayName} intake contract does not match the active ${environment} deployment manifest.`,
        }
      }

      if (normalizeAddress(manifestChain.treasuryAddress) !== normalizeAddress(input.treasuryAddress)) {
        return {
          available: false,
          reason: `${displayName} treasury address does not match the active ${environment} deployment manifest.`,
        }
      }

      if (manifestChain.abiVersion !== input.abiVersion) {
        return {
          available: false,
          reason: `${displayName} ABI version does not match the active ${environment} deployment manifest.`,
        }
      }

      return { available: true, reason: null }
    },
  }
}

export function createProjectPaymentOperationHandler({ validate, execute }) {
  return async function handleRequest(request) {
    if (request.method === "OPTIONS") {
      return new Response("ok", { headers: corsHeaders })
    }

    if (request.method !== "POST") {
      return json(edgeCommandFailure("method_not_allowed", "Only POST requests are supported."))
    }

    const bodyResult = await parseJsonBody(request)
    if (!bodyResult.ok) {
      return json(edgeCommandFailure("invalid_payload", bodyResult.error))
    }

    const auth = await authenticateRequest(request)
    if (!auth.ok) {
      return json(edgeCommandFailure(auth.code ?? "not_authenticated", auth.error))
    }

    const validation = validate(bodyResult.body)
    if (!validation.ok) {
      return json(validation)
    }

    const commandResult = await execute(auth.adminClient, {
      ...validation.data,
      actorUserId: auth.user.id,
      attemptId: validation.data.attemptId ?? crypto.randomUUID(),
    }, buildPaymentOperationDeps())

    if (!commandResult.ok) {
      return json(edgeCommandFailure(commandResult.error.code, commandResult.error.message))
    }

    return json(edgeCommandSuccess(commandResult.data))
  }
}

export function serveProjectPaymentOperation(options) {
  const handler = createProjectPaymentOperationHandler(options)
  serve(handler)
  return handler
}
