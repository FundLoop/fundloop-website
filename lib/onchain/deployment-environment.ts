import { z } from "zod"

// Kept free of chain and manifest imports so lightweight server code (for example the
// payment-flow observability route) can read the deployment environment without loading
// viem/chains and the deployment manifests. runtime-config re-exports everything here.

export type DeploymentEnvironment = "local" | "preview" | "production"

export const deploymentEnvironmentSchema = z.enum(["local", "preview", "production"])

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
