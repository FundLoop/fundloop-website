import { validateProjectInvitationDeclineInput } from "../../../lib/edge-functions/project-invitation-contract.ts"
import { edgeCommandFailure, edgeCommandSuccess } from "../../../lib/edge-functions/result.ts"
import { executeProjectInvitationDecline } from "../../../lib/invitations/project-invitation-command.ts"
import { authenticateRequest, corsHeaders, getEnv, json, parseJsonBody, serve } from "../_shared/command-runtime.ts"

function reviewRuntimeEnabled() {
  if (getEnv("FUNDLOOP_DEPLOYMENT_ENV") === "production") return false
  return !getEnv("DENO_DEPLOYMENT_ID") || getEnv("FUNDLOOP_POLICY_REVIEW_PREVIEW") === "1"
}

async function handleRequest(request: Request) {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders })
  if (request.method !== "POST") return json(edgeCommandFailure("method_not_allowed", "Only POST requests are supported."))
  const body = await parseJsonBody(request)
  const validation = validateProjectInvitationDeclineInput(body.ok ? body.body : undefined)
  if (!validation.ok) return json(validation)
  const auth = await authenticateRequest(request)
  if (!auth.ok) return json(edgeCommandFailure(auth.code ?? "not_authenticated", auth.error))
  const email = auth.user.email?.trim().toLowerCase()
  if (!email) return json(edgeCommandFailure("email_unavailable", "The authenticated account does not have an email address."))
  const result = await executeProjectInvitationDecline(auth.adminClient, {
    ...validation.data, actorUserId: auth.user.id, actorEmail: email, reviewRuntimeEnabled: reviewRuntimeEnabled(),
  })
  return json(result.ok ? edgeCommandSuccess(result.data) : edgeCommandFailure(result.error.code, result.error.message))
}

serve(handleRequest)
export { handleRequest }
