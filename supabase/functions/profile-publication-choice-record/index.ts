import { validateProfilePublicationChoiceInput } from "../../../lib/edge-functions/profile-publication-choice-contract.ts"
import { executeProfilePublicationChoiceCommand } from "../../../lib/policies/profile-publication-command.ts"
import { edgeCommandFailure, edgeCommandSuccess } from "../../../lib/edge-functions/result.ts"
import { authenticateRequest, corsHeaders, getEnv, json, parseJsonBody, serve } from "../_shared/command-runtime.ts"

function reviewRuntimeEnabled() {
  if (getEnv("FUNDLOOP_DEPLOYMENT_ENV") === "production") return false
  return !getEnv("DENO_DEPLOYMENT_ID") || getEnv("FUNDLOOP_POLICY_REVIEW_PREVIEW") === "1"
}
async function handleRequest(request) {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders })
  if (request.method !== "POST") return json(edgeCommandFailure("method_not_allowed", "Only POST requests are supported."))
  if (!reviewRuntimeEnabled()) return json(edgeCommandFailure("review_preview_disabled", "Review profile publication is disabled in this environment."))
  const body = await parseJsonBody(request); if (!body.ok) return json(edgeCommandFailure("invalid_payload", body.error))
  const auth = await authenticateRequest(request); if (!auth.ok) return json(edgeCommandFailure(auth.code ?? "not_authenticated", auth.error))
  const validation = validateProfilePublicationChoiceInput(body.body); if (!validation.ok) return json(validation)
  const result = await executeProfilePublicationChoiceCommand(auth.adminClient, auth.user.id, validation.data)
  return json(result.ok ? edgeCommandSuccess(result.data) : edgeCommandFailure(result.error.code, result.error.message))
}
serve(handleRequest)
export { handleRequest }

