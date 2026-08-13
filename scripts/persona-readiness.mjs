import { setTimeout as delay } from "node:timers/promises"

export const PERSONA_EDGE_FUNCTIONS = Object.freeze({
  "new-member": ["profile-publication-choice-record"],
  "returning-member": [],
  "new-founder": [
    "profile-publication-choice-record",
    "project-onboarding-publish",
    "project-invitation-create",
    "project-invitation-list",
    "project-invitation-inspect",
    "project-invitation-accept",
    "project-invitation-revoke",
    "project-monthly-contribution-submit",
    "project-attribution-dataset-submit",
  ],
  "returning-founder": [
    "project-invitation-create",
    "project-invitation-list",
    "project-invitation-inspect",
    "project-invitation-accept",
    "project-invitation-revoke",
    "project-monthly-contribution-submit",
    "project-attribution-dataset-submit",
  ],
  "returning-operator": [
    "monthly-cycle-lock",
    "monthly-cycle-calculation-package",
    "monthly-cycle-verification-review",
    "monthly-cycle-approval",
    "monthly-cycle-bookkeeping-credits-create",
  ],
})

export function requiredPersonaFunctions(selected) {
  return [...new Set(selected.flatMap((persona) => PERSONA_EDGE_FUNCTIONS[persona] ?? []))].sort()
}

export async function recoverLocalGateway(projectId, commandRunner) {
  if (!/^[a-z][a-z0-9_-]{1,40}$/.test(projectId)) throw new Error("persona-local-project-id-invalid")
  await commandRunner("docker", ["restart", `supabase_kong_${projectId}`])
  return `supabase_kong_${projectId}`
}

export function classifyReadinessFailure(error) {
  if (error?.name === "TimeoutError") return "timeout"
  if (error instanceof TypeError) return "connection"
  const message = error instanceof Error ? error.message : String(error)
  if (message.includes("identity-mismatch") || message.includes("schema-generation-mismatch")) return "stale"
  if (message.includes("http-404") || message.includes("schema-sentinel")) return "partial"
  return "unhealthy"
}

export async function waitForReadinessProbe({
  id,
  probe,
  attempts = 30,
  intervalMs = 500,
  delayFn = delay,
}) {
  let lastClassification = "unhealthy"
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const evidence = await probe()
      return { id, attempt, evidence }
    } catch (error) {
      lastClassification = classifyReadinessFailure(error)
      if (attempt < attempts) await delayFn(intervalMs)
    }
  }
  throw new Error(`persona-readiness-${id}-${lastClassification}-timeout`)
}

async function expectHttp(fetcher, url, init, acceptedStatuses = [200]) {
  const response = await fetcher(url, { ...init, signal: AbortSignal.timeout(2_000) })
  if (!acceptedStatuses.includes(response.status)) throw new Error(`http-${response.status}`)
  return response
}

export async function probeSupabaseFoundation(env, fetcher = fetch) {
  const commonHeaders = { apikey: env.anonKey }
  const auth = await expectHttp(fetcher, `${env.supabaseUrl}/auth/v1/health`, { headers: commonHeaders })
  const sentinelHeaders = { apikey: env.serviceRoleKey, authorization: `Bearer ${env.serviceRoleKey}` }
  const rest = await expectHttp(fetcher,
    `${env.supabaseUrl}/rest/v1/supabase_deploy_completion_evidence?select=id&limit=0`,
    { headers: sentinelHeaders }, [200])
  const storage = await expectHttp(fetcher, `${env.supabaseUrl}/storage/v1/status`, { headers: commonHeaders })
  const mailpit = await expectHttp(fetcher, `${env.mailpitUrl}/api/v1/info`, {})
  const schemaGeneration = rest.headers.get("x-supabase-api-version") ?? rest.headers.get("content-profile") ?? "public"
  return {
    auth: auth.status,
    rest: rest.status,
    storage: storage.status,
    mailpit: mailpit.status,
    schemaSentinel: "supabase_deploy_completion_evidence",
    schemaGeneration,
  }
}

export async function probeEdgeFunctions(env, functions, fetcher = fetch) {
  const statuses = {}
  for (const functionName of functions) {
    const response = await expectHttp(fetcher, `${env.supabaseUrl}/functions/v1/${functionName}`, {
      method: "OPTIONS",
      headers: { apikey: env.anonKey },
    }, [200, 204])
    statuses[functionName] = response.status
  }
  return statuses
}

export async function probeAppIdentity(baseURL, expected, fetcher = fetch) {
  const response = await expectHttp(fetcher, `${baseURL}/api/internal/health`, {}, [200])
  const body = await response.json()
  if (body?.runtime !== "fundloop-next" || body?.environment !== "local" || body?.readinessNonce !== expected.readinessNonce ||
    body?.commitSha !== expected.commitSha) {
    throw new Error("app-identity-mismatch")
  }
  return body
}
