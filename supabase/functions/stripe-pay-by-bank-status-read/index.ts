import { edgeCommandFailure, edgeCommandSuccess } from "../../../lib/edge-functions/result.ts"
import { authenticateRequest, getEnv, json, parseJsonBody, serve } from "../_shared/command-runtime.ts"

async function handleRequest(request: Request) {
  if (request.method === "OPTIONS") return new Response("ok", {headers: {"access-control-allow-origin": "*", "access-control-allow-headers": "authorization,apikey,content-type"}})
  if (request.method !== "POST") return json(edgeCommandFailure("method_not_allowed", "POST required."))
  if (!["local", "development", "dev", "preview", "test"].includes((getEnv("FUNDLOOP_DEPLOYMENT_ENV") ?? "production").trim().toLowerCase())) {
    return json(edgeCommandFailure("production_disabled", "Pay by Bank status is unavailable in this environment."))
  }
  const body = await parseJsonBody(request)
  const value = body.ok && body.body && typeof body.body === "object" && !Array.isArray(body.body) ? body.body as Record<string, unknown> : {}
  const projectSlug = typeof value.projectSlug === "string" ? value.projectSlug : ""
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(projectSlug) || Object.keys(value).some((key) => key !== "projectSlug")) return json(edgeCommandFailure("invalid_payload", "Project slug is invalid."))
  const auth = await authenticateRequest(request)
  if (!auth.ok || !auth.user) return json(edgeCommandFailure(auth.code ?? "not_authenticated", auth.error))
  const {data, error} = await auth.adminClient.rpc("list_project_stripe_pay_by_bank_status", {p_actor_user_id: auth.user.id, p_project_slug: projectSlug})
  if (error) return json(edgeCommandFailure("stripe_pay_by_bank_status_failed", error.message))
  return json(edgeCommandSuccess((data ?? []).map((row: Record<string, unknown>) => ({commandId: row.command_id, paymentId: Number(row.payment_id),
    currencyCode: row.currency_code, expectedAmountMinor: String(row.expected_amount_minor), status: row.status, statusAt: row.status_at,
    availableForPackage: Boolean(row.available_for_package), reversed: Boolean(row.reversed)}))))
}
serve(handleRequest)
export {handleRequest}
