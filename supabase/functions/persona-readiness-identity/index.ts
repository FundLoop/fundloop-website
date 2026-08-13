import { getEnv, json, serve } from "../_shared/command-runtime.ts"
import sourceContracts from "./source-contracts.json" with { type: "json" }

export const PERSONA_READINESS_RUNTIME_CONTRACT = "fundloop.persona-runtime-readiness.v1"

async function handleRequest(request: Request) {
  if (request.method !== "POST") return json({ ok: false, error: "method_not_allowed" }, { status: 405 })
  const environment = (getEnv("FUNDLOOP_DEPLOYMENT_ENV") ?? "").trim().toLowerCase()
  const expectedSecret = getEnv("FUNDLOOP_PERSONA_READINESS_SECRET")?.trim()
  const presentedSecret = request.headers.get("x-fundloop-readiness-secret")?.trim()
  if (environment !== "local" || !expectedSecret || presentedSecret !== expectedSecret) {
    return json({ ok: false, error: "readiness_identity_forbidden" }, { status: 403 })
  }
  let body: { selectedFunctions?: unknown }
  try { body = await request.json() } catch { return json({ ok: false, error: "invalid_json" }, { status: 400 }) }
  if (!Array.isArray(body.selectedFunctions) || body.selectedFunctions.some((name) => typeof name !== "string")) {
    return json({ ok: false, error: "selected_functions_invalid" }, { status: 400 })
  }
  const selectedFunctions = [...new Set(body.selectedFunctions)].sort()
  const selectedFunctionContracts: Record<string, string> = {}
  for (const name of selectedFunctions) {
    const digest = sourceContracts.functions[name as keyof typeof sourceContracts.functions]
    if (!digest) return json({ ok: false, error: "selected_function_unknown" }, { status: 400 })
    selectedFunctionContracts[name] = digest
  }
  const contractBytes = selectedFunctions.map((name) => `${name}\0${selectedFunctionContracts[name]}\n`).join("")
  const selectedFunctionContractDigest = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(contractBytes))))
    .map((byte) => byte.toString(16).padStart(2, "0")).join("")
  return json({
    ok: true,
    contractVersion: PERSONA_READINESS_RUNTIME_CONTRACT,
    environment,
    readinessNonce: getEnv("FUNDLOOP_PERSONA_READINESS_NONCE") ?? null,
    commitSha: getEnv("FUNDLOOP_PERSONA_COMMIT_SHA") ?? null,
    sourceContractVersion: sourceContracts.contractVersion,
    selectedFunctionContracts,
    selectedFunctionContractDigest,
    productionValueFlowEnabled: false,
  })
}

serve(handleRequest)
export { handleRequest }
