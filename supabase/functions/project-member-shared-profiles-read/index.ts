import { validateProjectMemberSharedProfilesReadInput } from "../../../lib/edge-functions/project-member-shared-profiles-contract.ts"
import { edgeCommandFailure, edgeCommandSuccess } from "../../../lib/edge-functions/result.ts"
import { executeProjectMemberSharedProfilesRead } from "../../../lib/invitations/project-member-shared-profiles-command.ts"
import { authenticateRequest, corsHeaders, getEnv, json, parseJsonBody, serve } from "../_shared/command-runtime.ts"

function reviewRuntimeEnabled() {
  if (getEnv("FUNDLOOP_DEPLOYMENT_ENV") === "production") return false
  return !getEnv("DENO_DEPLOYMENT_ID") || getEnv("FUNDLOOP_POLICY_REVIEW_PREVIEW") === "1"
}

async function handleRequest(request: Request) {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders })
  if (request.method !== "POST") return json(edgeCommandFailure("method_not_allowed", "Only POST requests are supported."))
  if (!reviewRuntimeEnabled()) return json(edgeCommandFailure("review_preview_disabled", "Project member review sharing is unavailable in this environment."))
  const body = await parseJsonBody(request)
  const validation = validateProjectMemberSharedProfilesReadInput(body.ok ? body.body : undefined)
  if (!validation.ok) return json(validation)
  const auth = await authenticateRequest(request)
  if (!auth.ok) return json(edgeCommandFailure(auth.code ?? "not_authenticated", auth.error))
  const result = await executeProjectMemberSharedProfilesRead(auth.adminClient, {
    ...validation.data, actorUserId: auth.user.id, reviewRuntimeEnabled: reviewRuntimeEnabled(),
  })
  return json(result.ok ? edgeCommandSuccess(result.data) : edgeCommandFailure(result.error.code, result.error.message))
}

serve(handleRequest)
export { handleRequest }
