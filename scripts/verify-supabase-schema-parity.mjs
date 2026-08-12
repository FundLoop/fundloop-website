import { createHash, randomBytes } from "node:crypto"
import { execFileSync } from "node:child_process"
import { mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs"
import net from "node:net"
import os from "node:os"
import path from "node:path"
import { pathToFileURL } from "node:url"

function run(command, args, options = {}) {
  return execFileSync(command, args, {
    cwd: options.cwd ?? process.cwd(),
    env: options.env ?? process.env,
    encoding: options.encoding,
    stdio: options.encoding ? "pipe" : "inherit",
    maxBuffer: options.maxBuffer ?? 32 * 1024 * 1024,
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

export function normalizePublicSchema(dump) {
  return dump
    .split("\n")
    .filter((line) => !line.startsWith("--") && !line.startsWith("SET ") && !line.startsWith("\\restrict") && !line.startsWith("\\unrestrict") && !line.startsWith("SELECT pg_catalog.set_config"))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}

function fingerprint(schema) {
  return createHash("sha256").update(schema).digest("hex")
}

function dumpPublicSchemaFromParityContainer(projectId, dbUrl) {
  return run("docker", ["exec", `supabase_db_${projectId}`, "pg_dump", "--schema-only", "--schema=public", "--no-owner", "--no-privileges", dbUrl], { encoding: "utf8" })
}

function assertValueFlowDisabled(dbUrl) {
  const tableNames = run("psql", [dbUrl, "-X", "-v", "ON_ERROR_STOP=1", "-Atqc", "select table_name from information_schema.columns where table_schema='public' and column_name='production_value_flow_enabled' order by table_name"], { encoding: "utf8" })
    .trim()
    .split("\n")
    .filter(Boolean)
  if (tableNames.length === 0) throw new Error("No production value-flow runtime controls were found")
  let enabledCount = 0
  for (const tableName of tableNames) {
    if (!/^[a-z][a-z0-9_]*$/.test(tableName)) throw new Error(`Unsafe runtime-control table name: ${tableName}`)
    enabledCount += Number(run("psql", [dbUrl, "-X", "-v", "ON_ERROR_STOP=1", "-Atqc", `select count(*) from public.${tableName} where production_value_flow_enabled`], { encoding: "utf8" }).trim())
  }
  if (enabledCount !== 0) throw new Error(`Delivery verification found ${enabledCount} enabled production value-flow controls`)
  return { enabledCount, tableCount: tableNames.length }
}

async function main() {
  const remoteDbUrl = process.env.SUPABASE_SCHEMA_DB_URL
  const remoteDumpDbUrl = process.env.SUPABASE_SCHEMA_DUMP_DB_URL ?? remoteDbUrl
  const projectRef = process.env.SUPABASE_PROJECT_REF
  const targetEnvironment = process.env.TARGET_ENVIRONMENT
  if (!remoteDbUrl || !projectRef || !["dev", "main"].includes(targetEnvironment)) {
    throw new Error("SUPABASE_SCHEMA_DB_URL, SUPABASE_PROJECT_REF, and TARGET_ENVIRONMENT=dev|main are required")
  }

  const projectId = `fundloop-schema-parity-${randomBytes(8).toString("hex")}`
  const bootstrapRoot = mkdtempSync(path.join(os.tmpdir(), `${projectId}-`))
  const bootstrapSupabase = path.join(bootstrapRoot, "supabase")
  const dbPort = await availablePort()
  const localDbUrl = `postgresql://postgres:postgres@127.0.0.1:${dbPort}/postgres`
  const localEnv = { ...process.env, PGSSLMODE: "disable", PGOPTIONS: `-c app.settings.fundloop_target_environment=${targetEnvironment}` }
  let startAttempted = false

  try {
    mkdirSync(path.join(bootstrapSupabase, "migrations"), { recursive: true })
    writeFileSync(path.join(bootstrapSupabase, "config.toml"), `project_id = "${projectId}"

[db]
port = ${dbPort}
major_version = 17
health_timeout = "2m"

[db.migrations]
enabled = true
schema_paths = []

[db.seed]
enabled = false
sql_paths = []
`, "utf8")
    startAttempted = true
    run("supabase", ["db", "start", "--yes", "--workdir", bootstrapRoot], { env: localEnv })
    run("psql", [localDbUrl, "-X", "-v", "ON_ERROR_STOP=1", "-c", `CREATE TABLE public.supabase_deploy_context (id boolean PRIMARY KEY DEFAULT true CHECK (id), target_environment text NOT NULL CHECK (target_environment IN ('dev', 'main')), updated_at timestamptz NOT NULL DEFAULT now()); INSERT INTO public.supabase_deploy_context (id, target_environment) VALUES (true, '${targetEnvironment}');`], { env: localEnv })
    run("supabase", ["db", "push", "--yes", "--include-all", "--db-url", localDbUrl], { env: localEnv })

    const expectedVersions = readdirSync("supabase/migrations").filter((name) => /^\d+_.+\.sql$/.test(name)).sort().map((name) => name.split("_", 1)[0])
    const observedVersions = run("psql", [remoteDbUrl, "-X", "-v", "ON_ERROR_STOP=1", "-Atqc", "select version from supabase_migrations.schema_migrations order by version"], { encoding: "utf8" }).trim().split("\n")
    if (JSON.stringify(expectedVersions) !== JSON.stringify(observedVersions)) {
      throw new Error(`Migration history drift: expected=${expectedVersions.join(",")} observed=${observedVersions.join(",")}`)
    }
    const valueFlowControls = assertValueFlowDisabled(remoteDbUrl)

    const containerLocalDbUrl = "postgresql://postgres:postgres@127.0.0.1:5432/postgres"
    const expectedSchema = normalizePublicSchema(dumpPublicSchemaFromParityContainer(projectId, containerLocalDbUrl))
    const observedSchema = normalizePublicSchema(dumpPublicSchemaFromParityContainer(projectId, remoteDumpDbUrl))
    const expectedSha256 = fingerprint(expectedSchema)
    const observedSha256 = fingerprint(observedSchema)
    if (expectedSchema !== observedSchema) {
      throw new Error(`Effective public schema drift: expected=${expectedSha256} observed=${observedSha256}`)
    }
    const result = {
      contractVersion: "fundloop.public-schema-parity/v1",
      candidateGitSha: process.env.GITHUB_SHA ?? "local-unbound",
      environment: targetEnvironment,
      projectRef,
      postgresMajor: 17,
      algorithm: "pg-dump-public-normalized-v1",
      expectedSha256,
      observedSha256,
      observedAt: new Date().toISOString(),
      migrationCount: observedVersions.length,
      productionValueFlowControlTableCount: valueFlowControls.tableCount,
      enabledProductionValueFlowControlCount: valueFlowControls.enabledCount,
    }
    if (process.env.SUPABASE_SCHEMA_PARITY_OUTPUT) writeFileSync(process.env.SUPABASE_SCHEMA_PARITY_OUTPUT, `${JSON.stringify(result, null, 2)}\n`, "utf8")
    console.log(`Verified effective public schema parity: ${observedSha256}`)
  } finally {
    if (startAttempted) {
      try { run("supabase", ["stop", "--no-backup", "--workdir", bootstrapRoot], { env: localEnv }) }
      catch (error) { console.error(`Could not fully stop task-owned schema project ${projectId}:`, error) }
    }
    rmSync(bootstrapRoot, { recursive: true, force: true })
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main()
