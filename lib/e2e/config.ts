import "server-only"

export const FUNDLOOP_E2E_ENABLED_ENV = "FUNDLOOP_E2E_ENABLED"
export const FUNDLOOP_E2E_SECRET_ENV = "FUNDLOOP_E2E_SECRET"

export function isE2EAuthEnabled(env: NodeJS.ProcessEnv = process.env) {
  const deploymentEnvironment = env.FUNDLOOP_DEPLOYMENT_ENV?.trim().toLowerCase()
  const isProductionDeployment =
    deploymentEnvironment && deploymentEnvironment.length > 0
      ? deploymentEnvironment === "production"
      : env.NODE_ENV === "production"

  return env[FUNDLOOP_E2E_ENABLED_ENV]?.trim() === "true" && !isProductionDeployment
}

export function getConfiguredE2ESecret(env: NodeJS.ProcessEnv = process.env) {
  const secret = env[FUNDLOOP_E2E_SECRET_ENV]?.trim()
  return secret && secret.length > 0 ? secret : null
}

export function getRequestSecret(request: Request) {
  const authorization = request.headers.get("authorization")
  if (authorization?.toLowerCase().startsWith("bearer ")) {
    return authorization.slice(7).trim()
  }

  return request.headers.get("x-fundloop-e2e-secret")?.trim() ?? null
}

export function isAuthorizedE2ERequest(request: Request, env: NodeJS.ProcessEnv = process.env) {
  const configuredSecret = getConfiguredE2ESecret(env)
  const requestSecret = getRequestSecret(request)

  return Boolean(configuredSecret && requestSecret && configuredSecret === requestSecret)
}
