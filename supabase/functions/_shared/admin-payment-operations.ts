import { edgeCommandFailure, edgeCommandSuccess } from "../../../lib/edge-functions/result.ts"
import { isInternalAdminEmail } from "../../../lib/internal-admin-emails.ts"
import {
  authenticateRequest,
  authenticateRequestOrInternalSecret,
  corsHeaders,
  getEnv,
  json,
  parseJsonBody,
  serve,
} from "./command-runtime.ts"

const DEPLOYMENT_ENVIRONMENTS = new Set(["local", "preview", "production"])

function resolveDeploymentEnvironment() {
  const explicitEnvironment = getEnv("FUNDLOOP_DEPLOYMENT_ENV")?.trim().toLowerCase()
  if (explicitEnvironment && DEPLOYMENT_ENVIRONMENTS.has(explicitEnvironment)) {
    return explicitEnvironment
  }

  const vercelEnvironment = getEnv("VERCEL_ENV")?.trim().toLowerCase()
  if (vercelEnvironment && DEPLOYMENT_ENVIRONMENTS.has(vercelEnvironment)) {
    return vercelEnvironment
  }

  return "local"
}

function getActorRole(user) {
  if (!user?.email || !isInternalAdminEmail(user.email, getEnv("FUNDLOOP_INTERNAL_ADMIN_EMAILS"))) {
    return null
  }

  return "internal_admin"
}

export function createAdminPaymentOperationHandler({
  validate,
  execute,
  allowInternalSecret = false,
  buildCommandInput,
}) {
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

    const auth = allowInternalSecret
      ? await authenticateRequestOrInternalSecret(request)
      : await authenticateRequest(request)

    if (!auth.ok) {
      return json(edgeCommandFailure(auth.code ?? "not_authenticated", auth.error))
    }

    const validation = validate(bodyResult.body)
    if (!validation.ok) {
      return json(validation)
    }

    const actorRole =
      auth.mode === "internal_secret"
        ? "system"
        : getActorRole(auth.user)

    if (!actorRole) {
      return json(edgeCommandFailure("forbidden", "You do not have internal admin access."))
    }

    const commandResult = await execute(
      auth.adminClient,
      buildCommandInput(validation.data, {
        actorRole,
        actorUserId: auth.mode === "internal_secret" ? null : auth.user.id,
        source: auth.mode === "internal_secret" ? "cron" : "admin_manual",
      }),
      {
        environment: resolveDeploymentEnvironment(),
      },
    )

    if (!commandResult.ok) {
      return json(edgeCommandFailure(commandResult.error.code, commandResult.error.message))
    }

    return json(edgeCommandSuccess(commandResult.data))
  }
}

export function serveAdminPaymentOperation(options) {
  const handler = createAdminPaymentOperationHandler(options)
  serve(handler)
  return handler
}
