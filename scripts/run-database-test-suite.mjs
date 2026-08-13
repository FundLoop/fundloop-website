import { spawnSync } from "node:child_process"
import { readdirSync } from "node:fs"
import path from "node:path"
import process from "node:process"

const ownedByShell = new Map([
  ["base_safe_payout_control_plane.sql", "base_safe_payout_control_plane.sh"],
  ["epoch_allocation_v2_four_epoch_lifecycle.sql", "epoch_allocation_v2_four_epoch_lifecycle.sh"],
])
const isolatedShells = new Set(["base_safe_payout_control_plane.sh", "epoch_allocation_v2_four_epoch_lifecycle.sh", "withdrawal_reservation_concurrency.sh", "financial_cutover_pre_feature_migration.sh"])

export function discoverDatabaseSuites(directory = "supabase/tests") {
  const files = readdirSync(directory).filter((name) => /\.(sql|sh)$/.test(name)).sort()
  const suites = files.filter((name) => !ownedByShell.has(name))
  const accounted = new Set([...suites, ...ownedByShell.keys()])
  if (files.some((name) => !accounted.has(name))) throw new Error("database_suite_discovery_incomplete")
  for (const [owned, owner] of ownedByShell) {
    if (!files.includes(owned) || !files.includes(owner)) throw new Error(`database_suite_owner_missing:${owned}:${owner}`)
  }
  return suites.map((name) => ({ name, path: path.join(directory, name), isolated: isolatedShells.has(name) }))
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
    if (suite.isolated) {
      const reset = resetLocal()
      if (reset.status !== 0) {
        lines.push(tapLine(position + 1, suite, { ...reset, stderr: `setup reset failed: ${reset.stderr || reset.stdout}` }))
        failed = true
        continue
      }
    }
    const result = suite.name.endsWith(".sh")
      ? execute("bash", [suite.path], env)
      : execute("psql", [dbUrl, "-X", "-v", "ON_ERROR_STOP=1", "-f", suite.path], env)
    lines.push(tapLine(position + 1, suite, result))
    if (result.status !== 0) failed = true
    if (suite.isolated) {
      const cleanup = resetLocal()
      if (cleanup.status !== 0) {
        lines.push(`# cleanup failure after ${suite.name}: ${JSON.stringify((cleanup.stderr || cleanup.stdout || "").trim().slice(-2000))}`)
        failed = true
      }
    }
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
