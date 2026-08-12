import { execFileSync } from "node:child_process"
import { readdirSync } from "node:fs"

const expectedCliVersion = "2.113.0"
const requiredRegressionMigrations = ["20260809020000", "20260811120000"]
const representativeSuites = [
  "supabase/tests/review_policy_controls.sql",
  "supabase/tests/epoch_funded_allocation.sql",
  "supabase/tests/project_payment_rail_integrity.sql",
]

function localDatabaseUrl() {
  const raw = process.env.SUPABASE_REPLAY_DB_URL
  if (!raw) {
    throw new Error("SUPABASE_REPLAY_DB_URL is required")
  }

  const url = new URL(raw)
  if (!["127.0.0.1", "localhost", "::1", "[::1]"].includes(url.hostname)) {
    throw new Error(`Refusing non-loopback replay target: ${url.hostname}`)
  }

  return raw
}

function run(command, args, options = {}) {
  execFileSync(command, args, {
    cwd: process.cwd(),
    env: { ...process.env, PGSSLMODE: "disable" },
    stdio: "inherit",
    ...options,
  })
}

function query(dbUrl, sql) {
  return execFileSync("psql", [dbUrl, "-X", "-v", "ON_ERROR_STOP=1", "-Atqc", sql], {
    cwd: process.cwd(),
    env: { ...process.env, PGSSLMODE: "disable" },
    encoding: "utf8",
  }).trim()
}

const dbUrl = localDatabaseUrl()
const cliVersion = execFileSync("supabase", ["--version"], { encoding: "utf8" }).trim()
if (cliVersion !== expectedCliVersion) {
  throw new Error(`Expected Supabase CLI ${expectedCliVersion}, received ${cliVersion}`)
}

const expectedVersions = readdirSync("supabase/migrations")
  .filter((name) => /^\d+_.+\.sql$/.test(name))
  .sort()
  .map((name) => name.split("_", 1)[0])

if (new Set(expectedVersions).size !== expectedVersions.length) {
  throw new Error("Migration filenames contain duplicate versions")
}

for (const requiredVersion of requiredRegressionMigrations) {
  if (!expectedVersions.includes(requiredVersion)) {
    throw new Error(`Required regression migration ${requiredVersion} is not tracked`)
  }
}

run("psql", [
  dbUrl,
  "-X",
  "-v",
  "ON_ERROR_STOP=1",
  "-c",
  `DO $preflight$
  DECLARE migration_count bigint;
  BEGIN
    IF to_regclass('supabase_migrations.schema_migrations') IS NOT NULL THEN
      EXECUTE 'SELECT count(*) FROM supabase_migrations.schema_migrations' INTO migration_count;
      IF migration_count <> 0 THEN
        RAISE EXCEPTION 'replay database already contains % application migrations', migration_count;
      END IF;
    END IF;
  END
  $preflight$;`,
])
console.log("Replay preflight passed: application migration history is empty.")

// This is the same executable db-push contract used for shared deployments. On an
// empty local database, --include-all makes the full-history intent explicit.
run("supabase", ["db", "push", "--yes", "--include-all", "--db-url", dbUrl])

const appliedVersions = query(
  dbUrl,
  "select version from supabase_migrations.schema_migrations order by version",
).split("\n")

if (JSON.stringify(appliedVersions) !== JSON.stringify(expectedVersions)) {
  throw new Error(
    `Applied migration history differs from tracked full history:\nexpected=${expectedVersions.join(",")}\napplied=${appliedVersions.join(",")}`,
  )
}

run("psql", [dbUrl, "-X", "-v", "ON_ERROR_STOP=1", "-f", "supabase/seed.sql"])
for (const suite of representativeSuites) {
  run("psql", [dbUrl, "-X", "-v", "ON_ERROR_STOP=1", "-f", suite])
}

console.log(
  `Fresh-schema replay passed: ${appliedVersions.length} migrations through ${appliedVersions.at(-1)} and ${representativeSuites.length} representative SQL suites.`,
)
