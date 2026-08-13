import { createHash } from "node:crypto"
import { readFileSync, statSync } from "node:fs"
import path from "node:path"
import { setTimeout as delay } from "node:timers/promises"
import { expectedSourceClosure } from "./verify-supabase-function-parity.mjs"

const readinessRegistryPath = "tests/e2e/personas/readiness-boundaries.json"
const sourceContractsPath = "supabase/functions/persona-readiness-identity/source-contracts.json"

export function personaReadinessRegistry(root = process.cwd()) {
  return JSON.parse(readFileSync(path.join(root, readinessRegistryPath), "utf8"))
}

export function derivePersonaReadiness(selected, root = process.cwd()) {
  const registry = personaReadinessRegistry(root)
  const sourceContracts = JSON.parse(readFileSync(path.join(root, sourceContractsPath), "utf8"))
  if (sourceContracts.contractVersion !== "fundloop.persona-selected-function-contracts.v1") {
    throw new Error("persona-readiness-source-contract-stale-version")
  }
  const boundaries = []
  for (const persona of selected) {
    const definition = registry[persona]
    if (!definition) throw new Error(`persona-readiness-registry-missing:${persona}`)
    const journey = readFileSync(path.join(root, definition.journeySource), "utf8")
    for (const [checkpoint, functions] of Object.entries(definition.commandBoundaries)) {
      if (!journey.includes(`id: "${checkpoint}"`)) throw new Error(`persona-readiness-checkpoint-stale:${persona}:${checkpoint}`)
      for (const functionName of functions) boundaries.push({ persona, checkpoint, functionName })
    }
    if (Object.keys(definition.commandBoundaries).length === 0) {
      if (!Array.isArray(definition.readOnlyRoutes) || definition.readOnlyRoutes.length === 0 ||
        !Array.isArray(definition.readOnlySources) || definition.readOnlySources.length !== definition.readOnlyRoutes.length) {
        throw new Error(`persona-readiness-empty-unjustified:${persona}`)
      }
      for (const sourcePath of definition.readOnlySources) {
        const source = readFileSync(path.join(root, sourcePath), "utf8")
        if (/\.functions\.invoke\s*\(|invoke[A-Za-z0-9]+(?:Browser|Server)\s*\(|@\/app\/actions|@\/lib\/edge-functions\//.test(source)) {
          throw new Error(`persona-readiness-read-only-source-mutates:${persona}:${sourcePath}`)
        }
      }
    }
  }
  const functions = [...new Set(boundaries.map((entry) => entry.functionName))].sort()
  const hash = createHash("sha256")
  const functionContracts = {}
  for (const functionName of functions) {
    const entrypoint = path.join(root, "supabase/functions", functionName, "index.ts")
    if (!statSync(entrypoint, { throwIfNoEntry: false })?.isFile()) throw new Error(`persona-readiness-function-missing:${functionName}`)
    const closureHash = createHash("sha256")
    for (const sourcePath of expectedSourceClosure(functionName, root)) {
      closureHash.update(sourcePath).update("\0").update(createHash("sha256").update(readFileSync(path.join(root, sourcePath))).digest("hex")).update("\n")
    }
    const closureDigest = closureHash.digest("hex")
    if (sourceContracts.functions?.[functionName] !== closureDigest) throw new Error(`persona-readiness-source-contract-stale:${functionName}`)
    functionContracts[functionName] = closureDigest
    hash.update(functionName).update("\0").update(closureDigest).update("\n")
  }
  return { boundaries, functions, functionContracts, functionContractDigest: hash.digest("hex") }
}

export function requiredPersonaFunctions(selected, root = process.cwd()) {
  return derivePersonaReadiness(selected, root).functions
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
  if (message.includes("identity-mismatch") || message.includes("schema-identity-stale") || message.includes("runtime-identity-stale")) return "stale"
  if (message.includes("http-404") || message.includes("schema-identity-partial") || message.includes("runtime-identity-partial")) return "partial"
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
  const rest = await expectHttp(fetcher, `${env.supabaseUrl}/rest/v1/rpc/persona_goal2_schema_readiness`, {
    method: "POST", headers: { ...sentinelHeaders, "content-type": "application/json" }, body: "{}",
  }, [200])
  let schemaIdentity
  try { schemaIdentity = await rest.json() } catch { throw new Error("schema-identity-partial-json") }
  if (schemaIdentity?.contractVersion !== "fundloop.persona-goal2-schema-readiness.v1" || schemaIdentity?.migrationVersion !== "20260813133000") {
    throw new Error("schema-identity-stale-version")
  }
  if (schemaIdentity?.ready !== true || schemaIdentity?.featureCount !== 18 || !Array.isArray(schemaIdentity?.missingFeatures) || schemaIdentity.missingFeatures.length > 0) {
    throw new Error("schema-identity-partial-features")
  }
  const storage = await expectHttp(fetcher, `${env.supabaseUrl}/storage/v1/status`, { headers: commonHeaders })
  const mailpit = await expectHttp(fetcher, `${env.mailpitUrl}/api/v1/info`, {})
  return {
    auth: auth.status,
    rest: rest.status,
    storage: storage.status,
    mailpit: mailpit.status,
    schemaIdentity,
  }
}

export async function probeEdgeFunctions(env, functions, expectedIdentity, fetcher = fetch) {
  const statuses = {}
  for (const functionName of functions) {
    const response = await expectHttp(fetcher, `${env.supabaseUrl}/functions/v1/${functionName}`, {
      method: "OPTIONS",
      headers: { apikey: env.anonKey },
    }, [200, 204])
    statuses[functionName] = response.status
  }
  const identityResponse = await expectHttp(fetcher, `${env.supabaseUrl}/functions/v1/persona-readiness-identity`, {
    method: "POST",
    headers: { apikey: env.anonKey, "content-type": "application/json", "x-fundloop-readiness-secret": expectedIdentity.secret },
    body: JSON.stringify({ selectedFunctions: functions }),
  }, [200])
  let identity
  try { identity = await identityResponse.json() } catch { throw new Error("runtime-identity-partial-json") }
  if (identity?.contractVersion !== "fundloop.persona-runtime-readiness.v1" || identity?.environment !== "local" ||
    identity?.sourceContractVersion !== "fundloop.persona-selected-function-contracts.v1" ||
    identity?.readinessNonce !== expectedIdentity.readinessNonce || identity?.commitSha !== expectedIdentity.commitSha ||
    identity?.selectedFunctionContractDigest !== expectedIdentity.functionContractDigest ||
    JSON.stringify(identity?.selectedFunctionContracts) !== JSON.stringify(expectedIdentity.functionContracts)) {
    throw new Error("runtime-identity-stale-mismatch")
  }
  if (identity?.productionValueFlowEnabled !== false) throw new Error("runtime-identity-partial-value-flow")
  return { statuses, identity }
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
