import { execFileSync, spawnSync } from "node:child_process"
import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import os from "node:os"
import path from "node:path"

const invalidVersion = "20991231235959"
const rawDbUrl = process.env.SUPABASE_REPLAY_DB_URL
if (!rawDbUrl) {
  throw new Error("SUPABASE_REPLAY_DB_URL is required")
}

const parsedDbUrl = new URL(rawDbUrl)
if (!["127.0.0.1", "localhost", "::1", "[::1]"].includes(parsedDbUrl.hostname)) {
  throw new Error(`Refusing non-loopback replay target: ${parsedDbUrl.hostname}`)
}

const tempRoot = mkdtempSync(path.join(os.tmpdir(), "fundloop-invalid-migration-"))
const tempSupabase = path.join(tempRoot, "supabase")
const invalidMigration = path.join(
  tempSupabase,
  "migrations",
  `${invalidVersion}_deliberate_ci_failure.sql`,
)

try {
  mkdirSync(tempSupabase, { recursive: true })
  cpSync("supabase/config.toml", path.join(tempSupabase, "config.toml"), { recursive: true })
  cpSync("supabase/migrations", path.join(tempSupabase, "migrations"), { recursive: true })
  writeFileSync(invalidMigration, "SELECT * FROM deliberate_missing_ci_relation;\n", "utf8")

  const result = spawnSync(
    "supabase",
    ["db", "push", "--yes", "--include-all", "--db-url", rawDbUrl],
    {
      cwd: tempRoot,
      env: { ...process.env, PGSSLMODE: "disable" },
      encoding: "utf8",
    },
  )
  process.stdout.write(result.stdout ?? "")
  process.stderr.write(result.stderr ?? "")

  if (result.status === 0) {
    throw new Error("Deliberately invalid migration unexpectedly succeeded")
  }

  const history = execFileSync(
    "psql",
    [
      rawDbUrl,
      "-X",
      "-v",
      "ON_ERROR_STOP=1",
      "-Atqc",
      `select version from supabase_migrations.schema_migrations where version in ('20260811120000', '${invalidVersion}') order by version`,
    ],
    {
      env: { ...process.env, PGSSLMODE: "disable" },
      encoding: "utf8",
    },
  ).trim()

  if (history !== "20260811120000") {
    throw new Error(`Invalid migration smoke changed migration history: ${history}`)
  }

  console.log("Invalid migration was rejected and the valid local migration history remained intact.")
} finally {
  rmSync(tempRoot, { recursive: true, force: true })
}
