import { validateCubidIdentityDisconnectInput } from "../../../lib/edge-functions/cubid-identity-contract.ts"
import { executeCubidIdentityDisconnectCommand } from "../../../lib/auth/cubid-identity-disconnect-command.ts"
import { edgeCommandFailure, edgeCommandSuccess } from "../../../lib/edge-functions/result.ts"
import { authenticateRequest, corsHeaders, json, serve } from "../_shared/command-runtime.ts"

// POST cubid-identity-disconnect — removes the caller's Cubid link (#275, stage 2c UI).
//
// The caller's own identity is the only target: there is no input naming a user, so one person can
// never disconnect another's.

async function handleRequest(request) {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders })
  if (request.method !== "POST") return json(edgeCommandFailure("method_not_allowed", "Only POST requests are supported."))
  // An empty body is normal for a command with no arguments; a malformed one is not, and must not
  // be read as an empty one. This is a destructive command, so an unparseable request is refused
  // rather than interpreted.
  const raw = (await request.text()).trim()
  let parsed = {}
  if (raw.length > 0) {
    try {
      parsed = JSON.parse(raw)
    } catch {
      return json(edgeCommandFailure("invalid_payload", "Request body must be a JSON object or empty."))
    }
  }
  const validation = validateCubidIdentityDisconnectInput(parsed)
  if (!validation.ok) return json(validation)
  const auth = await authenticateRequest(request)
  if (!auth.ok) return json(edgeCommandFailure(auth.code ?? "not_authenticated", auth.error))
  const result = await executeCubidIdentityDisconnectCommand(auth.adminClient, auth.user.id)
  return json(result.ok ? edgeCommandSuccess(result.data) : edgeCommandFailure(result.error.code, result.error.message))
}

serve(handleRequest)
export { handleRequest }
