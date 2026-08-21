import { execFileSync } from "node:child_process"
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import net from "node:net"
import os from "node:os"
import path from "node:path"
import { randomBytes } from "node:crypto"

function run(command, args, options = {}) {
  execFileSync(command, args, {
    cwd: process.cwd(),
    env: options.env ?? process.env,
    stdio: "inherit",
  })
}

function availablePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer()
    server.unref()
    server.once("error", reject)
    server.listen(0, "127.0.0.1", () => {
      const address = server.address()
      const port = typeof address === "object" && address ? address.port : null
      server.close((error) => (error ? reject(error) : resolve(port)))
    })
  })
}

const projectId = `fundloop-pr-replay-${randomBytes(8).toString("hex")}`
const bootstrapRoot = mkdtempSync(path.join(os.tmpdir(), `${projectId}-`))
const bootstrapSupabase = path.join(bootstrapRoot, "supabase")
const dbPort = await availablePort()
let startAttempted = false

if (!dbPort) {
  throw new Error("Could not allocate a loopback port for the replay database")
}

const isolatedEnv = { ...process.env }
for (const key of [
  "DEV_SUPABASE_SESSION_POOLER_URL",
  "MAIN_SUPABASE_SESSION_POOLER_URL",
  "SUPABASE_ACCESS_TOKEN",
]) {
  delete isolatedEnv[key]
}
isolatedEnv.PGSSLMODE = "disable"
isolatedEnv.SUPABASE_REPLAY_DB_URL = `postgresql://postgres:postgres@127.0.0.1:${dbPort}/postgres`

try {
  mkdirSync(path.join(bootstrapSupabase, "migrations"), { recursive: true })
  writeFileSync(
    path.join(bootstrapSupabase, "config.toml"),
    `project_id = "${projectId}"

[db]
port = ${dbPort}
major_version = 15
health_timeout = "2m"

[db.migrations]
enabled = true
schema_paths = []

[db.seed]
enabled = false
sql_paths = []
`,
    "utf8",
  )

  startAttempted = true
  run("supabase", ["db", "start", "--yes", "--workdir", bootstrapRoot], {
    env: isolatedEnv,
  })

  run("node", ["scripts/run-supabase-pr-replay.mjs"], { env: isolatedEnv })
  run("node", ["scripts/smoke-supabase-pr-replay-failure.mjs"], { env: isolatedEnv })
} finally {
  if (startAttempted) {
    try {
      run("supabase", ["stop", "--no-backup", "--workdir", bootstrapRoot], {
        env: isolatedEnv,
      })
    } catch (error) {
      console.error(`Could not fully stop task-owned Supabase project ${projectId}:`, error)
    }
  }
  rmSync(bootstrapRoot, { recursive: true, force: true })
}
