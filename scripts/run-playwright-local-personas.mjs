import { randomBytes } from "node:crypto"
import { spawn } from "node:child_process"
import { closeSync, existsSync, mkdirSync, openSync, readFileSync, readdirSync, rmSync } from "node:fs"
import { mkdir, open, readFile, rename } from "node:fs/promises"
import path from "node:path"
import process from "node:process"
import { setTimeout as delay } from "node:timers/promises"
import { fileURLToPath } from "node:url"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const outputRoot = path.join(root, "output", "persona-harness")
const personaIds = ["new-member", "returning-member", "new-founder", "returning-founder", "returning-operator"]
const cycleOffsets = { "new-member": 0, "returning-member": 1, "new-founder": 2, "returning-founder": 3, "returning-operator": 4 }
const localOperatorEmail = "maya@fundloop.example.com"

function addCycleMonths(cycleKey, offset) {
  const [year, month] = cycleKey.split("-").map(Number)
  const date = new Date(Date.UTC(year, month - 1 + offset, 1))
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`
}

function loadLocalEnv() {
  const envPath = path.join(root, ".env.local")
  if (existsSync(envPath) && typeof process.loadEnvFile === "function") process.loadEnvFile(envPath)
}

function parseArgs(argv) {
  const options = { persona: null, cleanupRun: null, selfTest: false, forceFailure: false, forceTimeout: false }
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    if (arg === "--") continue
    if (arg === "--persona") options.persona = argv[++index] ?? ""
    else if (arg.startsWith("--persona=")) options.persona = arg.slice(10)
    else if (arg === "--cleanup-run") options.cleanupRun = argv[++index] ?? ""
    else if (arg.startsWith("--cleanup-run=")) options.cleanupRun = arg.slice(14)
    else if (arg === "--self-test") options.selfTest = true
    else if (arg === "--force-failure") options.forceFailure = true
    else if (arg === "--force-timeout") options.forceTimeout = true
    else throw new Error("persona-cli-option-unknown")
  }
  if (options.cleanupRun && (options.persona !== null || options.selfTest || options.forceFailure || options.forceTimeout)) {
    throw new Error("persona-cleanup-option-conflict")
  }
  if (options.forceFailure && !options.selfTest) throw new Error("persona-force-failure-requires-self-test")
  if (options.forceTimeout && !options.selfTest) throw new Error("persona-force-timeout-requires-self-test")
  if (options.forceTimeout && options.forceFailure) throw new Error("persona-forced-outcome-conflict")
  return options
}

function selectedPersonas(value) {
  if (value === null) return [...personaIds]
  const requested = [...new Set(value.split(",").map((item) => item.trim()).filter(Boolean))]
  if (requested.length === 0) throw new Error("persona-filter-empty")
  if (requested.some((item) => !personaIds.includes(item))) throw new Error("persona-filter-unknown")
  return personaIds.filter((id) => requested.includes(id))
}

function required(name) {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`persona-env-missing-${name.toLowerCase().replaceAll("_", "-")}`)
  return value
}

function normalizeLoopback(value) {
  const url = new URL(value)
  if (url.hostname === "localhost") url.hostname = "127.0.0.1"
  return url
}

function readEnv() {
  if (process.env.FUNDLOOP_DEPLOYMENT_ENV?.trim() !== "local") throw new Error("persona-env-not-local")
  const supabase = normalizeLoopback(required("NEXT_PUBLIC_SUPABASE_URL"))
  const base = normalizeLoopback(process.env.PLAYWRIGHT_PERSONA_BASE_URL?.trim() || "http://127.0.0.1:3002")
  const mailpit = normalizeLoopback(process.env.PLAYWRIGHT_PERSONA_MAILPIT_URL?.trim() || "http://127.0.0.1:55324")
  if (supabase.origin !== "http://127.0.0.1:55321") throw new Error("persona-supabase-origin-refused")
  if (base.hostname !== "127.0.0.1" || base.port !== "3002") throw new Error("persona-base-url-refused")
  if (mailpit.hostname !== "127.0.0.1" || mailpit.port !== "55324") throw new Error("persona-mailpit-url-refused")
  return {
    baseURL: base.origin,
    supabaseUrl: supabase.origin,
    mailpitUrl: mailpit.origin,
    anonKey: required("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    serviceRoleKey: required("SUPABASE_SERVICE_ROLE_KEY"),
  }
}

async function probe(url, headers, reasonCode) {
  try {
    const response = await fetch(url, { headers, signal: AbortSignal.timeout(5_000) })
    if (!response.ok) throw new Error("not-ok")
  } catch {
    throw new Error(reasonCode)
  }
}

async function preflight(env) {
  await probe(`${env.supabaseUrl}/auth/v1/health`, { apikey: env.anonKey }, "persona-supabase-unavailable")
  await probe(`${env.mailpitUrl}/api/v1/info`, {}, "persona-mailpit-unavailable")
  const status = await capture("supabase", ["status", "--output", "json"], process.env)
  let localStatus
  try { localStatus = JSON.parse(status) } catch { throw new Error("persona-supabase-status-invalid") }
  const reportedApi = localStatus.API_URL ?? localStatus.api_url
  if (reportedApi && normalizeLoopback(reportedApi).origin !== env.supabaseUrl) throw new Error("persona-supabase-status-mismatch")
}

function spawnChild(command, args, env, stdio = "inherit") {
  return spawn(command, args, { cwd: root, env, stdio })
}

function capture(command, args, env) {
  return new Promise((resolve, reject) => {
    const child = spawnChild(command, args, env, ["ignore", "pipe", "pipe"])
    let stdout = ""
    child.stdout.on("data", (chunk) => { stdout += chunk.toString() })
    child.on("error", () => reject(new Error("persona-command-start-failed")))
    child.on("exit", (code) => code === 0 ? resolve(stdout) : reject(new Error("persona-command-failed")))
  })
}

function run(command, args, env) {
  return new Promise((resolve, reject) => {
    const child = spawnChild(command, args, env)
    child.on("error", () => reject(new Error("persona-command-start-failed")))
    child.on("exit", (code) => resolve(code ?? 1))
  })
}

async function waitForApp(baseURL, child) {
  for (let attempt = 0; attempt < 90; attempt += 1) {
    if (child.exitCode !== null) throw new Error("persona-next-exited")
    try {
      const response = await fetch(baseURL, { redirect: "manual", signal: AbortSignal.timeout(2_000) })
      if (response.status < 500) return
    } catch {}
    await delay(1_000)
  }
  throw new Error("persona-next-readiness-timeout")
}

async function assertPortFree(baseURL) {
  try {
    await fetch(baseURL, { signal: AbortSignal.timeout(1_000) })
  } catch { return }
  throw new Error("persona-next-port-occupied")
}

async function writeAtomic(filePath, value) {
  await mkdir(path.dirname(filePath), { recursive: true, mode: 0o700 })
  const temp = `${filePath}.tmp`
  const handle = await open(temp, "w", 0o600)
  try { await handle.writeFile(`${JSON.stringify(value, null, 2)}\n`); await handle.sync() } finally { await handle.close() }
  await rename(temp, filePath)
}

async function aggregate(run, selected, startedAt, services, playwrightExitCode, cycleBase) {
  const personas = []
  for (const persona of selected) {
    const file = path.join(outputRoot, run, "personas", `${persona}.json`)
    if (existsSync(file)) personas.push(JSON.parse(await readFile(file, "utf8")))
  }
  const missing = selected.filter((id) => !personas.some((result) => result.personaId === id))
  const status = playwrightExitCode !== 0 || missing.length || personas.some((result) => result.status === "failed" || result.cleanup.status === "residual")
    ? "failed"
    : personas.some((result) => result.status === "incomplete") ? "incomplete" : "passed"
  const summary = {
    schemaVersion: 1,
    runId: run,
    selectedPersonas: selected,
    unselectedPersonas: personaIds.filter((id) => !selected.includes(id)),
    status,
    exitCode: status === "passed" ? 0 : status === "incomplete" ? 2 : 1,
    startedAt,
    durationMs: Date.now() - Date.parse(startedAt),
    cycleKeys: Object.fromEntries(selected.map((persona) => [persona, addCycleMonths(cycleBase, cycleOffsets[persona])])),
    services,
    personas,
    cleanup: personas.length !== selected.length || personas.some((result) => result.cleanup.status === "residual")
      ? {
          status: "residual",
          deletedCount: personas.reduce((total, result) => total + result.cleanup.deletedCount, 0),
          residualCount: personas.reduce((total, result) => total + result.cleanup.residualCount, 0),
          reasonCode: personas.length !== selected.length ? "persona-cleanup-unproven" : "persona-cleanup-residual",
        }
      : {
          status: "clean",
          deletedCount: personas.reduce((total, result) => total + result.cleanup.deletedCount, 0),
          residualCount: 0,
          reasonCode: null,
        },
  }
  await writeAtomic(path.join(outputRoot, run, "summary.json"), summary)
  console.log(`persona harness ${run}: ${status}`)
  console.log("persona | status | checkpoints | cleanup")
  for (const result of personas) {
    const checkpoints = result.checkpoints.map((item) => `${item.checkpointId}:${item.status}`).join(",") || "none"
    console.log(`${result.personaId} | ${result.status} | ${checkpoints} | ${result.cleanup.status}`)
  }
  if (missing.length) console.log(`missing persona results: ${missing.join(",")}`)
  return summary
}

function ledgerPathsForRun(runId) {
  const directory = path.join(outputRoot, runId)
  if (!existsSync(directory)) return []
  return readdirSync(directory)
    .filter((name) => /^ownership-ledger(?:-[a-z][a-z0-9-]+)?\.json$/.test(name))
    .map((name) => path.join(directory, name))
}

async function cleanupLedger(ledgerPath, env) {
  const ledger = JSON.parse(readFileSync(ledgerPath, "utf8"))
  if (ledger.schemaVersion !== 1 || !/^persona-[A-Za-z0-9-]+$/.test(ledger.run?.runId ?? "")) throw new Error("ownership-ledger-invalid")
  if (ledger.state === "clean") return { status: "clean", deletedCount: 0, residualCount: 0, reasonCode: null }
  let deletedCount = 0

  const serviceHeaders = {
    apikey: env.serviceRoleKey,
    authorization: `Bearer ${env.serviceRoleKey}`,
    "content-type": "application/json",
  }
  const serviceFetch = async (url, options = {}, reason = "cleanup-request-failed") => {
    const response = await fetch(url, { ...options, headers: { ...serviceHeaders, ...options.headers } })
    if (!response.ok) throw new Error(reason)
    return response
  }

  const deleteStorageObject = async (bucket, objectPath) => {
    const objectUrl = `${env.supabaseUrl}/storage/v1/object/${bucket}/${objectPath}`
    const deletion = await fetch(objectUrl, { method: "DELETE", headers: serviceHeaders })
    if (deletion.ok) return
    const verification = await fetch(`${env.supabaseUrl}/storage/v1/object/authenticated/${bucket}/${objectPath}`, { headers: serviceHeaders })
    if (verification.ok || ![400, 404].includes(verification.status)) throw new Error("cleanup-request-failed")
  }

  ledger.state = "cleaning"
  await writeAtomic(ledgerPath, ledger)

  for (const bucketAndPath of [...ledger.storagePaths].reverse()) {
    const separator = bucketAndPath.indexOf("/")
    if (separator <= 0) throw new Error("ownership-ledger-invalid")
    const bucket = encodeURIComponent(bucketAndPath.slice(0, separator))
    const objectPath = bucketAndPath.slice(separator + 1).split("/").map(encodeURIComponent).join("/")
    await deleteStorageObject(bucket, objectPath)
    deletedCount += 1
  }

  const orderedRecords = [...ledger.records].sort((left, right) => right.cleanupPhase - left.cleanupPhase)
  const deleteRecord = async (record) => {
    if (!/^[a-z][a-z0-9_]*$/.test(record.table) || Object.keys(record.primaryKey).length === 0) {
      throw new Error("ownership-ledger-invalid")
    }
    const query = new URLSearchParams()
    for (const [key, value] of Object.entries(record.primaryKey)) {
      if (!/^[a-z][a-z0-9_]*$/.test(key)) throw new Error("ownership-ledger-invalid")
      query.set(key, `eq.${value}`)
    }
    await serviceFetch(
      `${env.supabaseUrl}/rest/v1/${record.table}?${query}`,
      { method: "DELETE", headers: { prefer: "return=minimal" } },
      `cleanup-record-delete-failed-${record.table}`,
    )
    deletedCount += 1
  }
  for (const record of orderedRecords.filter((record) => record.table !== "users")) {
    await deleteRecord(record)
  }

  for (const cycle of [...ledger.cycles].reverse()) {
    if (cycle.state === "clean") continue
    const query = new URLSearchParams({
      select: "id,cycle_key,operator_note,created_by_user_id",
      cycle_key: `eq.${cycle.cycleKey}`,
    })
    const response = await serviceFetch(`${env.supabaseUrl}/rest/v1/monthly_cycles?${query}`, {}, "cleanup-cycle-query-failed")
    const rows = await response.json()
    if (!Array.isArray(rows) || rows.length > 1) throw new Error("ownership-mismatch")
    if (rows.length === 1) {
      const row = rows[0]
      const idMatches = cycle.cycleId === null || row.id === cycle.cycleId
      if (!idMatches || row.operator_note !== cycle.operatorNoteMarker || row.created_by_user_id !== cycle.createdByUserId) {
        throw new Error("ownership-mismatch")
      }
      const eventQuery = new URLSearchParams({ monthly_cycle_id: `eq.${row.id}`, cycle_key: `eq.${cycle.cycleKey}` })
      await serviceFetch(
        `${env.supabaseUrl}/rest/v1/monthly_cycle_events?${eventQuery}`,
        { method: "DELETE", headers: { prefer: "return=minimal" } },
        "cleanup-cycle-events-delete-failed",
      )
      const eventVerification = new URLSearchParams({ select: "id", monthly_cycle_id: `eq.${row.id}`, cycle_key: `eq.${cycle.cycleKey}`, limit: "1" })
      const remainingEventsResponse = await serviceFetch(
        `${env.supabaseUrl}/rest/v1/monthly_cycle_events?${eventVerification}`,
        {},
        "cleanup-cycle-events-query-failed",
      )
      const remainingEvents = await remainingEventsResponse.json()
      if (!Array.isArray(remainingEvents) || remainingEvents.length > 0) throw new Error("cleanup-cycle-events-residual")
      deletedCount += 1
      const deletion = new URLSearchParams({ id: `eq.${row.id}` })
      await serviceFetch(`${env.supabaseUrl}/rest/v1/monthly_cycles?${deletion}`, { method: "DELETE", headers: { prefer: "return=minimal" } }, "cleanup-cycle-delete-failed")
      cycle.cycleId = row.id
      deletedCount += 1
    }
    cycle.state = "clean"
    await writeAtomic(ledgerPath, ledger)
  }

  for (const record of orderedRecords.filter((record) => record.table === "users")) {
    await deleteRecord(record)
  }

  const inviterIds = new Set(ledger.invitations.map((invitation) => invitation.createdByUserId))
  for (const authUserId of [...ledger.authUserIds].reverse().filter((id) => !inviterIds.has(id))) {
    await serviceFetch(`${env.supabaseUrl}/auth/v1/admin/users/${encodeURIComponent(authUserId)}`, { method: "DELETE" }, "cleanup-auth-delete-failed")
    deletedCount += 1
  }

  for (const invitation of [...ledger.invitations].reverse()) {
    const query = new URLSearchParams({ code: `eq.${invitation.code}`, created_by: `eq.${invitation.createdByUserId}` })
    await serviceFetch(`${env.supabaseUrl}/rest/v1/invitation_codes?${query}`, { method: "DELETE", headers: { prefer: "return=minimal" } }, "cleanup-invitation-delete-failed")
    deletedCount += 1
  }

  for (const authUserId of [...ledger.authUserIds].reverse().filter((id) => inviterIds.has(id))) {
    await serviceFetch(`${env.supabaseUrl}/auth/v1/admin/users/${encodeURIComponent(authUserId)}`, { method: "DELETE" }, "cleanup-auth-delete-failed")
    deletedCount += 1
  }

  ledger.state = "clean"
  ledger.records = []
  ledger.authUserIds = []
  ledger.storagePaths = []
  ledger.invitations = []
  await writeAtomic(ledgerPath, ledger)
  return { status: "clean", deletedCount, residualCount: 0, reasonCode: null }
}

async function cleanupRun(runId, env) {
  if (!/^persona-[A-Za-z0-9-]+$/.test(runId)) throw new Error("cleanup-run-id-invalid")
  const ledgerPaths = ledgerPathsForRun(runId)
  if (ledgerPaths.length === 0) throw new Error("ownership-ledger-missing")
  for (const ledgerPath of ledgerPaths) await cleanupLedger(ledgerPath, env)
}

function residualCountForLedger(ledgerPath) {
  if (!existsSync(ledgerPath)) return 1
  const ledger = JSON.parse(readFileSync(ledgerPath, "utf8"))
  return ledger.records.length + ledger.authUserIds.length + ledger.storagePaths.length + ledger.invitations.length +
    ledger.cycles.filter((cycle) => cycle.state !== "clean").length
}

async function recoverAfterPlaywright(runId, selected, env) {
  for (const personaId of selected) {
    const personaPath = path.join(outputRoot, runId, "personas", `${personaId}.json`)
    const namedLedgerPath = path.join(outputRoot, runId, `ownership-ledger-${personaId}.json`)
    const legacyLedgerPath = path.join(outputRoot, runId, "ownership-ledger.json")
    const ledgerPath = existsSync(namedLedgerPath) ? namedLedgerPath : selected.length === 1 && existsSync(legacyLedgerPath) ? legacyLedgerPath : null
    let cleanup
    if (ledgerPath) {
      try {
        cleanup = await cleanupLedger(ledgerPath, env)
      } catch {
        cleanup = { status: "residual", deletedCount: 0, residualCount: residualCountForLedger(ledgerPath), reasonCode: "cleanup-recovery-failed" }
      }
    } else {
      cleanup = { status: "residual", deletedCount: 0, residualCount: 1, reasonCode: "cleanup-ledger-missing" }
    }

    if (!existsSync(personaPath)) {
      await writeAtomic(personaPath, {
        personaId,
        status: "failed",
        durationMs: 0,
        checkpoints: [{
          checkpointId: "harness.playwright-process",
          capabilityId: "harness-process-lifecycle",
          status: "fail",
          durationMs: 0,
          reasonCode: "playwright-result-missing",
          evidence: {},
        }],
        cleanup,
      })
    } else if (cleanup.status === "clean") {
      const result = JSON.parse(readFileSync(personaPath, "utf8"))
      if (result.cleanup?.status !== "clean") {
        result.status = "failed"
        result.cleanup = cleanup
        await writeAtomic(personaPath, result)
      }
    }
  }
}

function removePrivateFailureArtifacts() {
  const testResults = path.join(root, "output", "playwright", "test-results")
  if (existsSync(testResults)) {
    for (const name of readdirSync(testResults)) {
      if (/^(personas-|harness-self-test)/.test(name)) rmSync(path.join(testResults, name), { recursive: true, force: true })
    }
  }
  rmSync(path.join(root, "output", "playwright", "report"), { recursive: true, force: true })
}

async function main() {
  loadLocalEnv()
  const options = parseArgs(process.argv.slice(2))
  mkdirSync(outputRoot, { recursive: true, mode: 0o700 })
  const lockPath = path.join(outputRoot, "local.lock")
  let lockDescriptor
  let app = null
  let stopping = false
  const stop = () => {
    if (stopping) return
    stopping = true
    if (app && app.exitCode === null) app.kill("SIGTERM")
  }
  process.once("SIGINT", () => { stop(); process.exitCode = 1 })
  process.once("SIGTERM", () => { stop(); process.exitCode = 1 })

  try {
    lockDescriptor = openSync(lockPath, "wx", 0o600)
  } catch {
    throw new Error("persona-run-lock-held")
  }

  try {
    const env = readEnv()
    await preflight(env)
    if (options.cleanupRun) {
      await cleanupRun(options.cleanupRun, env)
      console.log(`persona cleanup ${options.cleanupRun}: clean`)
      return
    }

    const selected = selectedPersonas(options.persona)
    const startedAt = new Date().toISOString()
    const runId = `persona-${startedAt.replace(/[-:.]/g, "")}-${randomBytes(4).toString("hex")}`
    const cycleBase = process.env.FUNDLOOP_PERSONA_CYCLE_BASE?.trim() || "2035-01"
    await assertPortFree(env.baseURL)
    const sharedEnv = {
      ...process.env,
      PLAYWRIGHT_PERSONA_BASE_URL: env.baseURL,
      PLAYWRIGHT_PERSONA_MAILPIT_URL: env.mailpitUrl,
      PLAYWRIGHT_PERSONA_OUTPUT_ROOT: outputRoot,
      PLAYWRIGHT_PERSONA_RUN_ID: runId,
      PLAYWRIGHT_PERSONA_STARTED_AT: startedAt,
      PLAYWRIGHT_PERSONA_SELECTED: selected.join(","),
      PLAYWRIGHT_PERSONA_FORCE_FAILURE: options.forceFailure ? "true" : "false",
      PLAYWRIGHT_PERSONA_FORCE_TIMEOUT: options.forceTimeout ? "true" : "false",
      FUNDLOOP_DEPLOYMENT_ENV: "local",
      FUNDLOOP_E2E_ENABLED: "true",
      FUNDLOOP_E2E_SECRET: process.env.FUNDLOOP_E2E_SECRET?.trim() || `persona-${randomBytes(24).toString("base64url")}`,
      FUNDLOOP_INTERNAL_ADMIN_EMAILS: localOperatorEmail,
      FUNDLOOP_ZKAS_SUPERADMIN_EMAILS: localOperatorEmail,
    }
    app = spawnChild("pnpm", ["dev", "--port", "3002", "--hostname", "127.0.0.1"], sharedEnv)
    await waitForApp(env.baseURL, app)
    const grep = options.selfTest ? "@harness:self-test" : `@persona:(${selected.join("|")})`
    removePrivateFailureArtifacts()
    const playwrightExitCode = await run("pnpm", ["exec", "playwright", "test", "--project=local-personas", "--reporter=list", "--grep", grep], sharedEnv)
    await recoverAfterPlaywright(runId, selected, env)
    removePrivateFailureArtifacts()
    const summary = await aggregate(
      runId,
      selected,
      startedAt,
      { supabase: "caller", mailpit: "caller", next: "runner" },
      playwrightExitCode,
      cycleBase,
    )
    process.exitCode = summary.exitCode
  } finally {
    stop()
    if (lockDescriptor !== undefined) closeSync(lockDescriptor)
    rmSync(lockPath, { force: true })
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "persona-run-failed")
  process.exitCode = 1
})
