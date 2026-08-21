import { z } from "zod"
import localManifestJson from "./deployments/local.json" with { type: "json" }
import previewManifestJson from "./deployments/preview.json" with { type: "json" }
import productionManifestJson from "./deployments/production.json" with { type: "json" }
import { isSolanaDepositAddressRoute } from "./route-availability.ts"
import { SUPPORTED_CHAIN_CONFIGS, SUPPORTED_CHAIN_KEYS, type SupportedChainKey } from "./supported-chains.ts"

export const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000"
export const ZERO_REOWN_PROJECT_ID = "00000000000000000000000000000000"
export const LOCAL_WALLET_MANIFEST_OVERRIDE_ENV = "NEXT_PUBLIC_FUNDLOOP_LOCAL_WALLET_MANIFEST_JSON"

export type DeploymentEnvironment = "local" | "preview" | "production"

export type WalletRuntimeIssue = {
  code: string
  message: string
  severity: "error" | "warning"
}

export type WalletRuntimeChain = {
  networkKey: SupportedChainKey
  displayName: string
  evmChainId: number
  rpcUrl: string
  confirmationDepth: number
  abiVersion: string
  contractAddress: string
  treasuryAddress: string
}

export type WalletRuntimeConfig = {
  environment: DeploymentEnvironment
  manifestVersion: string
  reownProjectId: string | null
  reownProjectIdConfigured: boolean
  walletEnabled: boolean
  activeChains: WalletRuntimeChain[]
  issues: WalletRuntimeIssue[]
}

export type DeploymentAvailability = {
  available: boolean
  reason: string | null
}

export type RuntimeEnv = Record<string, string | undefined>

function getDenoRuntime() {
  const runtime = globalThis as typeof globalThis & {
    Deno?: {
      env?: {
        get?: (name: string) => string | undefined
      }
    }
  }

  return typeof globalThis === "object" && globalThis && "Deno" in runtime ? runtime.Deno : undefined
}

export function getDefaultRuntimeEnv(): RuntimeEnv {
  if (typeof process !== "undefined" && process?.env) {
    return process.env as RuntimeEnv
  }

  const denoRuntime = getDenoRuntime()
  return new Proxy(
    {},
    {
      get(_target, property) {
        if (typeof property !== "string") {
          return undefined
        }

        return denoRuntime?.env?.get?.(property)
      },
    },
  ) as RuntimeEnv
}

const deploymentEnvironmentSchema = z.enum(["local", "preview", "production"])

const manifestChainSchema = z.object({
  networkKey: z.enum(SUPPORTED_CHAIN_KEYS),
  evmChainId: z.number().int().positive(),
  enabled: z.boolean(),
  confirmationDepth: z.number().int().positive(),
  abiVersion: z.string().trim().min(1),
  contractAddress: z.string().trim().regex(/^0x[a-fA-F0-9]{40}$/),
  treasuryAddress: z.string().trim().regex(/^0x[a-fA-F0-9]{40}$/),
})

const manifestSchema = z
  .object({
    version: z.string().trim().min(1),
    environment: deploymentEnvironmentSchema,
    chains: z.array(manifestChainSchema),
  })
  .superRefine((manifest, context) => {
    const seen = new Set<string>()

    manifest.chains.forEach((chain, index) => {
      if (seen.has(chain.networkKey)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Duplicate chain manifest entry for ${chain.networkKey}.`,
          path: ["chains", index, "networkKey"],
        })
      }

      seen.add(chain.networkKey)

      const supported = SUPPORTED_CHAIN_CONFIGS[chain.networkKey]
      if (supported.chain.id !== chain.evmChainId) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Manifest EVM chain ID ${chain.evmChainId} does not match curated support for ${chain.networkKey}.`,
          path: ["chains", index, "evmChainId"],
        })
      }

      if (chain.enabled && chain.contractAddress.toLowerCase() === ZERO_ADDRESS) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Enabled manifest chains must not use the zero intake contract address.`,
          path: ["chains", index, "contractAddress"],
        })
      }

      if (chain.enabled && chain.treasuryAddress.toLowerCase() === ZERO_ADDRESS) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Enabled manifest chains must not use the zero treasury address.`,
          path: ["chains", index, "treasuryAddress"],
        })
      }
    })

    SUPPORTED_CHAIN_KEYS.forEach((networkKey) => {
      if (!manifest.chains.some((chain) => chain.networkKey === networkKey)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Manifest is missing the curated ${networkKey} chain entry.`,
          path: ["chains"],
        })
      }
    })
  })

export type DeploymentManifestChain = z.infer<typeof manifestChainSchema>
export type DeploymentManifest = z.infer<typeof manifestSchema>

const DEPLOYMENT_MANIFESTS: Record<DeploymentEnvironment, DeploymentManifest> = {
  local: manifestSchema.parse(localManifestJson),
  preview: manifestSchema.parse(previewManifestJson),
  production: manifestSchema.parse(productionManifestJson),
}

function getManifestOverride(environment: DeploymentEnvironment, env: RuntimeEnv = getDefaultRuntimeEnv()) {
  if (environment !== "local") {
    return null
  }

  const override = env[LOCAL_WALLET_MANIFEST_OVERRIDE_ENV]?.trim()
  if (!override) {
    return null
  }

  return manifestSchema.parse(JSON.parse(override))
}

function normalizeAddress(value: string) {
  return value.trim().toLowerCase()
}

function isConfiguredReownProjectId(value: string | undefined) {
  if (!value) {
    return false
  }

  const normalized = value.trim()
  return normalized.length > 0 && normalized !== ZERO_REOWN_PROJECT_ID
}

export function resolveDeploymentEnvironment(env: RuntimeEnv = getDefaultRuntimeEnv()): DeploymentEnvironment {
  const explicitValue = env.FUNDLOOP_DEPLOYMENT_ENV?.trim().toLowerCase()
  const parsedExplicit = deploymentEnvironmentSchema.safeParse(explicitValue)
  if (parsedExplicit.success) {
    return parsedExplicit.data
  }

  const vercelValue = env.VERCEL_ENV?.trim().toLowerCase()
  const parsedVercel = deploymentEnvironmentSchema.safeParse(vercelValue)
  if (parsedVercel.success) {
    return parsedVercel.data
  }

  return "local"
}

export function getDeploymentManifest(environment: DeploymentEnvironment, env: RuntimeEnv = getDefaultRuntimeEnv()): DeploymentManifest {
  return getManifestOverride(environment, env) ?? DEPLOYMENT_MANIFESTS[environment]
}

export function isStrictWalletValidationEnvironment(environment: DeploymentEnvironment) {
  return environment === "preview" || environment === "production"
}

export function buildWalletRuntimeConfig(
  env: RuntimeEnv = getDefaultRuntimeEnv(),
  environment = resolveDeploymentEnvironment(env),
): WalletRuntimeConfig {
  const manifest = getDeploymentManifest(environment, env)
  const issues: WalletRuntimeIssue[] = []
  const reownProjectId = env.NEXT_PUBLIC_REOWN_PROJECT_ID?.trim() || null
  const reownProjectIdConfigured = isConfiguredReownProjectId(reownProjectId ?? undefined)

  if (!reownProjectIdConfigured) {
    issues.push({
      code: "missing_reown_project_id",
      message: "NEXT_PUBLIC_REOWN_PROJECT_ID is missing or still set to the placeholder value.",
      severity: "error",
    })
  }

  const activeChains: WalletRuntimeChain[] = []

  manifest.chains.forEach((chain) => {
    if (!chain.enabled) {
      return
    }

    const supported = SUPPORTED_CHAIN_CONFIGS[chain.networkKey]
    const rpcUrl = env[supported.rpcEnvVar]?.trim()

    if (!rpcUrl) {
      issues.push({
        code: `missing_rpc_${chain.networkKey}`,
        message: `${supported.rpcEnvVar} is required for the enabled ${chain.networkKey} wallet deployment.`,
        severity: "error",
      })
      return
    }

    activeChains.push({
      networkKey: chain.networkKey,
      displayName: supported.chain.name,
      evmChainId: chain.evmChainId,
      rpcUrl,
      confirmationDepth: chain.confirmationDepth,
      abiVersion: chain.abiVersion,
      contractAddress: chain.contractAddress,
      treasuryAddress: chain.treasuryAddress,
    })
  })

  if (activeChains.length === 0) {
    issues.push({
      code: "no_enabled_wallet_chains",
      message: `No enabled wallet chains are configured in the ${environment} deployment manifest.`,
      severity: "error",
    })
  }

  return {
    environment,
    manifestVersion: manifest.version,
    reownProjectId,
    reownProjectIdConfigured,
    walletEnabled: reownProjectIdConfigured && activeChains.length > 0 && issues.every((issue) => issue.severity !== "error"),
    activeChains,
    issues,
  }
}

export function getWalletRuntimeConfig(env: RuntimeEnv = getDefaultRuntimeEnv()) {
  return buildWalletRuntimeConfig(env)
}

export function assertWalletRuntimeConfigForStartup(config = getWalletRuntimeConfig()) {
  if (!isStrictWalletValidationEnvironment(config.environment)) {
    return config
  }

  const blockingIssues = config.issues.filter((issue) => issue.severity === "error")
  if (blockingIssues.length === 0) {
    return config
  }

  throw new Error(
    `Wallet runtime configuration is invalid for ${config.environment}: ${blockingIssues.map((issue) => issue.message).join(" ")}`,
  )
}

export function getRuntimeChainByNetworkKey(
  runtimeConfig: WalletRuntimeConfig,
  networkKey: string,
): WalletRuntimeChain | null {
  return runtimeConfig.activeChains.find((chain) => chain.networkKey === networkKey) ?? null
}

export function getManifestChainByNetworkKey(environment: DeploymentEnvironment, networkKey: string) {
  return getDeploymentManifest(environment).chains.find((chain) => chain.networkKey === networkKey) ?? null
}

export function getRequiredConfirmationDepth(runtimeConfig: WalletRuntimeConfig, networkKey: string) {
  const runtimeChain = getRuntimeChainByNetworkKey(runtimeConfig, networkKey)
  if (runtimeChain) {
    return runtimeChain.confirmationDepth
  }

  return getManifestChainByNetworkKey(runtimeConfig.environment, networkKey)?.confirmationDepth ?? 1
}

export function getDeploymentAvailabilityForRoute(
  runtimeConfig: WalletRuntimeConfig,
  input: {
    networkKey: string
    contractAddress: string
    treasuryAddress: string
    abiVersion: string
  },
): DeploymentAvailability {
  if (isSolanaDepositAddressRoute(input)) {
    return { available: true, reason: null }
  }

  const runtimeChain = getRuntimeChainByNetworkKey(runtimeConfig, input.networkKey)
  if (!runtimeChain) {
    return {
      available: false,
      reason: `No enabled ${input.networkKey} wallet deployment is configured for ${runtimeConfig.environment}.`,
    }
  }

  if (normalizeAddress(runtimeChain.contractAddress) !== normalizeAddress(input.contractAddress)) {
    return {
      available: false,
      reason: `${runtimeChain.displayName} intake contract does not match the active ${runtimeConfig.environment} deployment manifest.`,
    }
  }

  if (normalizeAddress(runtimeChain.treasuryAddress) !== normalizeAddress(input.treasuryAddress)) {
    return {
      available: false,
      reason: `${runtimeChain.displayName} treasury address does not match the active ${runtimeConfig.environment} deployment manifest.`,
    }
  }

  if (runtimeChain.abiVersion !== input.abiVersion) {
    return {
      available: false,
      reason: `${runtimeChain.displayName} ABI version does not match the active ${runtimeConfig.environment} deployment manifest.`,
    }
  }

  return { available: true, reason: null }
}

export function isRouteExecutableForRuntime(
  runtimeConfig: WalletRuntimeConfig,
  input: {
    networkKey: string
    contractAddress: string
    treasuryAddress: string
    abiVersion: string
  },
) {
  return getDeploymentAvailabilityForRoute(runtimeConfig, input).available
}
