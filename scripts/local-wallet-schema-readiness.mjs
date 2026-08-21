import { setTimeout as delay } from "node:timers/promises"

const expectedBaseChain = Object.freeze({
  network_key: "base",
  ecosystem: "evm",
  evm_chain_id: 8453,
  is_active: true,
})

function readinessError(reason) {
  return new Error(`local-wallet-schema-sentinel-${reason}`)
}

export async function probeLocalWalletSchema(env, fetcher = fetch) {
  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (!supabaseUrl || !serviceRoleKey) throw readinessError("environment-invalid")

  const url = new URL("/rest/v1/ref_chains", supabaseUrl)
  url.searchParams.set("select", "id,network_key,ecosystem,evm_chain_id,is_active")
  url.searchParams.set("network_key", "eq.base")
  url.searchParams.set("limit", "1")

  let response
  try {
    response = await fetcher(url, {
      headers: {
        apikey: serviceRoleKey,
        authorization: `Bearer ${serviceRoleKey}`,
      },
      signal: AbortSignal.timeout(2_000),
    })
  } catch {
    throw readinessError("connection")
  }

  if (response.status !== 200) throw readinessError(`http-${response.status}`)

  let rows
  try {
    rows = await response.json()
  } catch {
    throw readinessError("json-invalid")
  }

  if (!Array.isArray(rows) || rows.length !== 1) throw readinessError("base-row-missing")
  const row = rows[0]
  if (!Number.isInteger(row?.id) || row.id <= 0 ||
    Object.entries(expectedBaseChain).some(([field, value]) => row?.[field] !== value)) {
    throw readinessError("base-row-stale")
  }

  return { status: response.status, row }
}

export async function waitForLocalWalletSchema({
  env,
  fetcher = fetch,
  attempts = 60,
  intervalMs = 500,
  delayFn = async (milliseconds) => { await delay(milliseconds) },
}) {
  let lastReason = "unhealthy"
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const evidence = await probeLocalWalletSchema(env, fetcher)
      return { attempt, ...evidence }
    } catch (error) {
      lastReason = error instanceof Error
        ? error.message.replace(/^local-wallet-schema-sentinel-/, "")
        : "unhealthy"
      if (attempt < attempts) await delayFn(intervalMs)
    }
  }

  throw readinessError(`${lastReason}-timeout`)
}
