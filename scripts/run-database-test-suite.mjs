import { spawnSync } from "node:child_process"
import { readdirSync } from "node:fs"
import path from "node:path"
import process from "node:process"

const ownedByShell = new Map([
  ["base_safe_payout_control_plane.sql", "base_safe_payout_control_plane.sh"],
  ["epoch_allocation_v2_four_epoch_lifecycle.sql", "epoch_allocation_v2_four_epoch_lifecycle.sh"],
  ["epoch_allocation_v2_four_epoch_setup.sql", "epoch_allocation_v2_four_epoch_lifecycle.sh"],
])
const isolatedShells = new Set(["base_safe_payout_control_plane.sh", "epoch_allocation_v2_four_epoch_lifecycle.sh", "withdrawal_reservation_concurrency.sh", "financial_cutover_pre_feature_migration.sh"])
const nonTapShellContracts = new Map([
  ["base_safe_payout_control_plane.sh", "wrapper-owned:setup-psql-and-assertion-psql"],
  ["epoch_allocation_v2_four_epoch_lifecycle.sh", "wrapper-owned:integrated-fixture-concurrency-and-assertion-psql"],
  ["withdrawal_reservation_concurrency.sh", "wrapper-owned:two-session-claim-serialization"],
  ["financial_cutover_pre_feature_migration.sh", "wrapper-owned:versioned-reset-migration-and-assertion-psql"],
])

function suiteContract(name) {
  if (name.endsWith(".sql")) return "psql-on-error-stop"
  return nonTapShellContracts.get(name) ?? null
}

export function discoverDatabaseSuites(directory = "supabase/tests") {
  const files = readdirSync(directory).filter((name) => /\.(sql|sh)$/.test(name)).sort()
  const suites = files.filter((name) => !ownedByShell.has(name))
  const accounted = new Set([...suites, ...ownedByShell.keys()])
  if (files.some((name) => !accounted.has(name))) throw new Error("database_suite_discovery_incomplete")
  for (const [owned, owner] of ownedByShell) {
    if (!files.includes(owned) || !files.includes(owner)) throw new Error(`database_suite_owner_missing:${owned}:${owner}`)
  }
  for (const name of suites.filter((candidate) => candidate.endsWith(".sh"))) {
    if (!suiteContract(name)) throw new Error(`database_suite_contract_missing:${name}`)
  }
  return suites.map((name) => ({ name, path: path.join(directory, name), isolated: isolatedShells.has(name), contract: suiteContract(name) }))
}

export function validateTapOutput(output) {
  const lines = String(output ?? "").replaceAll("\r\n", "\n").split("\n")
  while (lines.at(-1) === "") lines.pop()
  if (lines.length === 0) throw new Error("suite_tap_missing")
  let plan = null
  const numbers = new Set()
  let testCount = 0
  for (const line of lines) {
    if (line === "" || /^\s*#/.test(line) || /^TAP version 13$/.test(line)) continue
    if (/^Bail out!/.test(line)) throw new Error("suite_tap_bailout")
    const planMatch = line.match(/^1\.\.(\d+)(?:\s+#.*)?$/)
    if (planMatch) {
      if (plan !== null) throw new Error("suite_tap_duplicate_plan")
      plan = Number.parseInt(planMatch[1], 10)
      continue
    }
    const testMatch = line.match(/^(not )?ok\s+(\d+)(?:\s+-\s+[^#]+)?(?:\s+#.*)?$/)
    if (testMatch) {
      const number = Number.parseInt(testMatch[2], 10)
      if (testMatch[1]) throw new Error(`suite_tap_not_ok:${number}`)
      if (numbers.has(number)) throw new Error(`suite_tap_duplicate_number:${number}`)
      numbers.add(number)
      testCount += 1
      continue
    }
    throw new Error(`suite_tap_unaccounted:${line.slice(0, 120)}`)
  }
  if (plan === null) throw new Error("suite_tap_plan_missing")
  if (plan !== testCount) throw new Error(`suite_tap_plan_mismatch:${plan}:${testCount}`)
  for (let number = 1; number <= plan; number += 1) {
    if (!numbers.has(number)) throw new Error(`suite_tap_number_out_of_range:${number}`)
  }
  return { plan, testCount }
}

function outputLooksLikeTap(output) {
  return String(output ?? "").split(/\r?\n/).some((line) =>
    /^TAP version\b|^1\.\.\d+|^(?:not )?ok\s+\d+|^Bail out!/.test(line))
}

export function validateSuiteResult(suite, result) {
  if (result.status !== 0) throw new Error(`suite_process_failed:${result.status ?? "null"}`)
  if (outputLooksLikeTap(result.stdout)) return { mode: "tap", ...validateTapOutput(result.stdout) }
  if (!suite.contract) throw new Error("suite_tap_missing")
  if (suite.contract === "psql-on-error-stop" && !suite.name.endsWith(".sql")) throw new Error("suite_contract_invalid")
  if (suite.contract.startsWith("wrapper-owned:") && !suite.name.endsWith(".sh")) throw new Error("suite_contract_invalid")
  return { mode: "accountable-non-tap", contract: suite.contract }
}

export function tapLine(index, suite, result) {
  if (result.status === 0) return `ok ${index} - ${suite.name}`
  const signal = result.signal ? ` signal=${result.signal}` : ""
  return `not ok ${index} - ${suite.name}\n  ---\n  exit: ${result.status ?? "null"}${signal}\n  stderr: ${JSON.stringify((result.stderr || result.stdout || "").trim().slice(-2000))}\n  ...`
}

function localDatabaseUrl() {
  const raw = process.env.FUNDLOOP_LOCAL_DATABASE_URL || process.env.SUPABASE_REPLAY_DB_URL
  if (!raw) throw new Error("FUNDLOOP_LOCAL_DATABASE_URL is required")
  const parsed = new URL(raw)
  if (!["127.0.0.1", "localhost", "::1", "[::1]"].includes(parsed.hostname)) throw new Error("database_test_target_refused")
  return raw
}

function run(command, args, env) {
  const timeout = Number.parseInt(env.FUNDLOOP_DATABASE_SUITE_TIMEOUT_MS || "300000", 10)
  return spawnSync(command, args, { cwd: process.cwd(), env, encoding: "utf8", timeout })
}

/**
 * @param {{suites?: Array<{name: string, path: string, isolated: boolean}>, dbUrl?: string,
 * execute?: (command: string, args: string[], env: NodeJS.ProcessEnv) => {status: number|null, stdout?: string, stderr?: string, signal?: string|null}}} options
 */
export function runDatabaseSuites({ suites = discoverDatabaseSuites(), dbUrl = localDatabaseUrl(), execute = run } = {}) {
  const env = { ...process.env, FUNDLOOP_LOCAL_DATABASE_URL: dbUrl, PGSSLMODE: "disable" }
  const lines = [`TAP version 13`, `1..${suites.length}`]
  let failed = false
  const resetLocal = () => {
    const first = execute("supabase", ["db", "reset", "--local"], env)
    if (first.status === 0) return first
    const recovery = execute("supabase", ["db", "reset", "--local"], env)
    return recovery.status === 0 ? recovery : { ...recovery, stderr: `initial reset failed: ${first.stderr || first.stdout}\nrecovery reset failed: ${recovery.stderr || recovery.stdout}` }
  }
  for (const [position, suite] of suites.entries()) {
    let suiteResult = null
    if (suite.isolated) {
      const reset = resetLocal()
      if (reset.status !== 0) {
        suiteResult = { ...reset, stderr: `setup reset failed: ${reset.stderr || reset.stdout}` }
      }
    }
    if (!suiteResult) {
      const result = suite.name.endsWith(".sh")
        ? execute("bash", [suite.path], env)
        : execute("psql", [dbUrl, "-X", "-v", "ON_ERROR_STOP=1", "-f", suite.path], env)
      try {
        validateSuiteResult({ ...suite, contract: suite.contract ?? suiteContract(suite.name) }, result)
        suiteResult = result
      } catch (error) {
        suiteResult = { ...result, status: result.status === 0 ? 1 : result.status, stderr: `${result.stderr || ""}\n${error instanceof Error ? error.message : "suite_output_invalid"}`.trim() }
      }
    }
    if (suite.isolated && !String(suiteResult.stderr ?? "").startsWith("setup reset failed:")) {
      const cleanup = resetLocal()
      if (cleanup.status !== 0) {
        suiteResult = { ...cleanup, stderr: `${suiteResult.status === 0 ? "" : `assertion failed: ${suiteResult.stderr || suiteResult.stdout}\n`}cleanup reset failed after ${suite.name}: ${cleanup.stderr || cleanup.stdout}` }
      }
    }
    lines.push(tapLine(position + 1, suite, suiteResult))
    if (suiteResult.status !== 0) failed = true
  }
  return { output: `${lines.join("\n")}\n`, exitCode: failed ? 1 : 0, suiteCount: suites.length }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    const result = runDatabaseSuites()
    process.stdout.write(result.output)
    process.exitCode = result.exitCode
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : "database_test_runner_failed"}\n`)
    process.exitCode = 1
  }
}
