import { createHash, randomBytes } from "node:crypto"
import { spawn } from "node:child_process"
import { mkdir, readFile, writeFile } from "node:fs/promises"
import path from "node:path"
import process from "node:process"

const root = process.cwd()
const sqlSuites = [
  "supabase/tests/review_policy_controls.sql",
  "supabase/tests/project_invitation_review_sharing.sql",
  "supabase/tests/epoch_project_packages.sql",
  "supabase/tests/epoch_financial_prep.sql",
  "supabase/tests/epoch_funded_allocation.sql",
  "supabase/tests/epoch_allocation_close.sql",
  "supabase/tests/withdrawal_obligation_control_plane.sql",
  "supabase/tests/base_safe_payout_control_plane.sql",
  "supabase/tests/stripe_connect_payout_control_plane.sql",
  "supabase/tests/financial_cutover_control_plane.sql",
]

function run(command, args, env = process.env) {
  return new Promise((resolve) => {
    const started = Date.now()
    const child = spawn(command, args, { cwd: root, env, stdio: "inherit" })
    child.on("error", () => resolve({ ok: false, durationMs: Date.now() - started }))
    child.on("exit", (code) => resolve({ ok: code === 0, durationMs: Date.now() - started }))
  })
}

function capture(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: root, env: process.env, stdio: ["ignore", "pipe", "pipe"] })
    let output = ""
    child.stdout.on("data", (chunk) => { output += chunk.toString() })
    child.on("error", reject)
    child.on("exit", (code) => code === 0 ? resolve(output) : reject(new Error("feature-118-command-failed")))
  })
}

function localStatus(raw) {
  const status = JSON.parse(raw)
  const dbUrl = new URL(status.DB_URL ?? status.db_url ?? "")
  const apiUrl = new URL(status.API_URL ?? status.api_url ?? "")
  if (dbUrl.protocol !== "postgresql:" || dbUrl.hostname !== "127.0.0.1" || dbUrl.port !== "55322" || dbUrl.pathname !== "/postgres") {
    throw new Error("feature-118-database-target-refused")
  }
  if (apiUrl.protocol !== "http:" || apiUrl.hostname !== "127.0.0.1" || apiUrl.port !== "55321") {
    throw new Error("feature-118-api-target-refused")
  }
  return {
    dbUrl: dbUrl.toString(),
    env: {
      ...process.env,
      NEXT_PUBLIC_SUPABASE_URL: apiUrl.origin,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: status.ANON_KEY,
      SUPABASE_SERVICE_ROLE_KEY: status.SERVICE_ROLE_KEY,
      FUNDLOOP_DEPLOYMENT_ENV: "local",
      NEXT_PUBLIC_POLICY_REVIEW_PREVIEW: "1",
      FUNDLOOP_E2E_SECRET: process.env.FUNDLOOP_E2E_SECRET?.trim() || `feature-118-${randomBytes(24).toString("base64url")}`,
      PLAYWRIGHT_PERSONA_DIAGNOSTICS: "1",
      SUPABASE_FUNCTIONS_WATCH_LIMIT: "4000",
    },
  }
}

async function main() {
  if (process.env.FUNDLOOP_DEPLOYMENT_ENV && process.env.FUNDLOOP_DEPLOYMENT_ENV !== "local") {
    throw new Error("feature-118-environment-refused")
  }
  const status = localStatus(await capture("supabase", ["status", "--output", "json"]))
  const matrixPath = path.join(root, "tests/e2e/operational/feature-118-capability-matrix.json")
  const matrixText = await readFile(matrixPath, "utf8")
  const runId = `feature-118-${new Date().toISOString().replace(/[-:.]/g, "")}-${randomBytes(4).toString("hex")}`
  const outputDirectory = path.join(root, "output", "feature-118-operational", runId)
  await mkdir(outputDirectory, { recursive: true, mode: 0o700 })
  const steps = []
  let failed = false

  const execute = async (id, command, args, env = status.env) => {
    if (failed) return
    const result = await run(command, args, env)
    steps.push({ id, status: result.ok ? "passed" : "failed", durationMs: result.durationMs })
    if (!result.ok) failed = true
  }

  const executeReset = async (id) => {
    if (failed) return
    const started = Date.now()
    let result = await run("supabase", ["db", "reset", "--local"], status.env)
    if (!result.ok) result = await run("supabase", ["db", "reset", "--local"], status.env)
    steps.push({ id, status: result.ok ? "passed" : "failed", durationMs: Date.now() - started })
    if (!result.ok) failed = true
  }

  try {
    await executeReset("fresh-local-replay")
    await execute("all-five-personas", "pnpm", ["test:e2e:personas"])
    await execute("base-local-wallet", "pnpm", ["test:e2e:local"])
    await executeReset("sql-baseline-reset")
    for (const suite of sqlSuites) {
      if (suite.endsWith("base_safe_payout_control_plane.sql")) {
        await execute(`sql:${path.basename(suite)}`, "bash", ["supabase/tests/base_safe_payout_control_plane.sh"], {
          ...status.env,
          FUNDLOOP_LOCAL_DATABASE_URL: status.dbUrl,
        })
      } else {
        await execute(`sql:${path.basename(suite)}`, "psql", [status.dbUrl, "-X", "-v", "ON_ERROR_STOP=1", "-f", suite])
      }
    }
    await execute("focused-contracts", "./node_modules/.bin/vitest", ["run",
      "tests/feature-118-operational-matrix.test.ts", "tests/persona-harness-contracts.test.ts",
      "tests/persona-harness-journey-runner.test.ts", "tests/persona-harness-reporting.test.ts",
      "--pool=threads", "--maxWorkers=1"])
    await execute("hardhat", "pnpm", ["--dir", "contracts", "test"])
    await execute("node22-full-check", "pnpm", ["check"], { ...status.env, CI: "1" })
  } finally {
    let cleanup = await run("supabase", ["db", "reset", "--local"], status.env)
    if (!cleanup.ok) cleanup = await run("supabase", ["db", "reset", "--local"], status.env)
    steps.push({ id: "final-zero-residue-reset", status: cleanup.ok ? "passed" : "failed", durationMs: cleanup.durationMs })
    if (!cleanup.ok) failed = true
    const summary = {
      schemaVersion: 1,
      runId,
      featureIssue: 118,
      taskIssue: 144,
      status: failed ? "failed" : "passed",
      productionValueFlowEnabled: false,
      capabilityMatrixDigest: createHash("sha256").update(matrixText).digest("hex"),
      steps,
    }
    await writeFile(path.join(outputDirectory, "summary.json"), `${JSON.stringify(summary, null, 2)}\n`, { mode: 0o600 })
    console.log(`Feature #118 operational matrix ${runId}: ${summary.status}`)
    if (failed) process.exitCode = 1
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "feature-118-operational-matrix-failed")
  process.exitCode = 1
})
