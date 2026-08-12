import { createHash, randomBytes } from "node:crypto"
import { execFileSync } from "node:child_process"
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs"
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
  const lines = dump
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.replace(/ +$/g, ""))
    .filter((line) => line.length > 0 && !line.startsWith("--") && !line.startsWith("\\restrict") && !line.startsWith("\\unrestrict"))
  return `${lines.join("\n")}\n`
}

function fingerprint(schema) {
  return createHash("sha256").update(schema).digest("hex")
}

function safeObjectIdentity(value) {
  return value.replace(/[^A-Za-z0-9_.:#\- ()\[\]]/g, "?").slice(0, 240)
}

export function schemaObjectManifest(dump) {
  const sections = []
  let identity = "preamble"
  let lines = []
  const occurrences = new Map()
  const flush = () => {
    const normalized = normalizePublicSchema(lines.join("\n"))
    if (normalized === "\n") return
    const occurrence = (occurrences.get(identity) ?? 0) + 1
    occurrences.set(identity, occurrence)
    sections.push({
      objectKey: `${identity}#${occurrence}`,
      sha256: fingerprint(normalized),
      normalizedLineCount: normalized.split("\n").length - 1,
    })
  }
  for (const line of dump.replace(/\r\n?/g, "\n").split("\n")) {
    const header = line.match(/^-- Name: (.*); Type: (.*); Schema: (.*); Owner: .*$/)
    if (header) {
      flush()
      identity = `${header[3]}.${header[1]} [${header[2]}]`
      lines = []
    } else {
      lines.push(line)
    }
  }
  flush()
  return sections
}

export function buildSchemaDiagnostic(expectedDump, observedDump, metadata = {}, maxLineDifferences = 200) {
  const expectedSchema = normalizePublicSchema(expectedDump)
  const observedSchema = normalizePublicSchema(observedDump)
  const expectedObjects = schemaObjectManifest(expectedDump)
  const observedObjects = schemaObjectManifest(observedDump)
  const expectedByKey = new Map(expectedObjects.map((entry) => [entry.objectKey, entry]))
  const observedByKey = new Map(observedObjects.map((entry) => [entry.objectKey, entry]))
  const allKeys = [...new Set([...expectedByKey.keys(), ...observedByKey.keys()])].sort()
  const objectDifferences = allKeys.flatMap((objectKey) => {
    const expected = expectedByKey.get(objectKey)
    const observed = observedByKey.get(objectKey)
    const objectKeySha256 = fingerprint(objectKey)
    if (!expected) return [{ objectKeySha256, status: "unexpected", observedSha256: observed.sha256 }]
    if (!observed) return [{ reviewedObjectKey: safeObjectIdentity(objectKey), objectKeySha256, status: "missing", expectedSha256: expected.sha256 }]
    if (expected.sha256 !== observed.sha256) return [{ reviewedObjectKey: safeObjectIdentity(objectKey), objectKeySha256, status: "changed", expectedSha256: expected.sha256, observedSha256: observed.sha256 }]
    return []
  })
  const expectedLines = expectedSchema.split("\n").slice(0, -1)
  const observedLines = observedSchema.split("\n").slice(0, -1)
  const lineDifferenceCount = Math.max(expectedLines.length, observedLines.length) - expectedLines.filter((line, index) => line === observedLines[index]).length
  const lineDifferences = []
  for (let index = 0; index < Math.max(expectedLines.length, observedLines.length) && lineDifferences.length < maxLineDifferences; index += 1) {
    if (expectedLines[index] === observedLines[index]) continue
    lineDifferences.push({
      lineNumber: index + 1,
      expectedLineSha256: expectedLines[index] === undefined ? null : fingerprint(expectedLines[index]),
      observedLineSha256: observedLines[index] === undefined ? null : fingerprint(observedLines[index]),
    })
  }
  const expectedSha256 = fingerprint(expectedSchema)
  const observedSha256 = fingerprint(observedSchema)
  return {
    contractVersion: "fundloop.public-schema-diagnostic/v1",
    status: expectedSha256 === observedSha256 ? "pass" : "drift",
    ...metadata,
    expectedSha256,
    observedSha256,
    expectedNormalizedLineCount: expectedLines.length,
    observedNormalizedLineCount: observedLines.length,
    expectedObjectCount: expectedObjects.length,
    observedObjectCount: observedObjects.length,
    expectedObjects: expectedObjects.map(({ objectKey, ...entry }) => ({ reviewedObjectKey: safeObjectIdentity(objectKey), objectKeySha256: fingerprint(objectKey), ...entry })),
    observedObjects: observedObjects.map(({ objectKey, ...entry }) => ({ reviewedObjectKey: expectedByKey.has(objectKey) ? safeObjectIdentity(objectKey) : null, objectKeySha256: fingerprint(objectKey), ...entry })),
    objectDifferenceCount: objectDifferences.length,
    objectDifferences,
    lineDifferenceCount,
    lineDifferencesTruncated: lineDifferenceCount > lineDifferences.length,
    lineDifferences,
  }
}

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`
  if (value && typeof value === "object") return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`
  return JSON.stringify(value)
}

export function expectedMigrationInventory(root = process.cwd()) {
  const names = readdirSync(path.join(root, "supabase/migrations"))
    .filter((name) => /^\d{14}_[A-Za-z0-9_]+\.sql$/.test(name))
    .sort()
  const versions = new Set()
  return names.map((name) => {
    const version = name.slice(0, 14)
    if (versions.has(version)) throw new Error(`Duplicate migration version: ${version}`)
    versions.add(version)
    return { version, name, fileSha256: createHash("sha256").update(readFileSync(path.join(root, "supabase/migrations", name))).digest("hex") }
  })
}

export function migrationInventorySha256(items) {
  return fingerprint(canonicalJson(items))
}

export function buildMigrationDeployEvidence(input, root = process.cwd()) {
  const migrations = expectedMigrationInventory(root)
  return {
    contractVersion: "fundloop.migration-deploy-evidence/v1",
    candidateGitSha: input.candidateGitSha,
    actionsRunId: String(input.actionsRunId),
    runAttempt: Number(input.runAttempt),
    environment: input.environment,
    projectRef: input.projectRef,
    migrations,
    inventorySha256: migrationInventorySha256(migrations),
  }
}

export function validateMigrationDeployEvidence(expected, observed) {
  return observed.contractVersion === expected.contractVersion
    && observed.candidateGitSha === expected.candidateGitSha
    && observed.actionsRunId === expected.actionsRunId
    && observed.runAttempt === expected.runAttempt
    && observed.environment === expected.environment
    && observed.projectRef === expected.projectRef
    && canonicalJson(observed.migrations) === canonicalJson(expected.migrations)
    && observed.inventorySha256 === migrationInventorySha256(observed.migrations)
    && observed.inventorySha256 === expected.inventorySha256
}

function dumpPublicSchemaFromParityContainer(projectId, dbUrl) {
  return run("docker", ["exec", `supabase_db_${projectId}`, "pg_dump", "--schema-only", "--schema=public", "--no-owner", "--no-privileges", "--no-comments", dbUrl], { encoding: "utf8" })
}

function pgDumpVersionFromParityContainer(projectId) {
  return run("docker", ["exec", `supabase_db_${projectId}`, "pg_dump", "--version"], { encoding: "utf8" }).trim()
}

function psqlFromParityContainer(projectId, dbUrl, sql) {
  return run("docker", ["exec", `supabase_db_${projectId}`, "psql", dbUrl, "-X", "-v", "ON_ERROR_STOP=1", "-Atqc", sql], { encoding: "utf8" }).trim()
}

function observedMigrationEvidence(dbUrl, binding) {
  const sql = `select json_build_object('contractVersion',contract_version,'candidateGitSha',candidate_git_sha,'actionsRunId',actions_run_id::text,'runAttempt',run_attempt,'environment',deployment_environment,'projectRef',project_ref,'migrations',migration_inventory,'inventorySha256',inventory_sha256)::text from public.supabase_deploy_migration_evidence where candidate_git_sha='${binding.candidateGitSha}' and actions_run_id=${Number(binding.actionsRunId)} and run_attempt=${Number(binding.runAttempt)} and deployment_environment='${binding.environment}' and project_ref='${binding.projectRef}' order by recorded_at desc limit 1`
  const output = run("psql", [dbUrl, "-X", "-v", "ON_ERROR_STOP=1", "-Atqc", sql], { encoding: "utf8" }).trim()
  if (!output) throw new Error("unverifiable-migration-source: no candidate-bound remote deploy evidence")
  return JSON.parse(output)
}

function assertValueFlowDisabledWithQuery(query) {
  const tableNames = query("select table_name from information_schema.columns where table_schema='public' and column_name='production_value_flow_enabled' order by table_name")
    .trim()
    .split("\n")
    .filter(Boolean)
  if (tableNames.length === 0) throw new Error("No production value-flow runtime controls were found")
  let enabledCount = 0
  for (const tableName of tableNames) {
    if (!/^[a-z][a-z0-9_]*$/.test(tableName)) throw new Error(`Unsafe runtime-control table name: ${tableName}`)
    enabledCount += Number(query(`select count(*) from public.${tableName} where production_value_flow_enabled`).trim())
  }
  if (enabledCount !== 0) throw new Error(`Delivery verification found ${enabledCount} enabled production value-flow controls`)
  return { enabledCount, tableCount: tableNames.length }
}

function assertValueFlowDisabled(dbUrl) {
  return assertValueFlowDisabledWithQuery((sql) => run("psql", [dbUrl, "-X", "-v", "ON_ERROR_STOP=1", "-Atqc", sql], { encoding: "utf8" }).trim())
}

async function main() {
  if (process.argv[2] === "prepare") {
    const output = process.env.SUPABASE_MIGRATION_EVIDENCE_OUTPUT
    const evidence = buildMigrationDeployEvidence({
      candidateGitSha: process.env.GITHUB_SHA,
      actionsRunId: process.env.GITHUB_RUN_ID,
      runAttempt: process.env.GITHUB_RUN_ATTEMPT,
      environment: process.env.TARGET_ENVIRONMENT,
      projectRef: process.env.SUPABASE_PROJECT_REF,
    })
    if (!output || !/^[0-9a-f]{40}$/.test(evidence.candidateGitSha ?? "") || !/^\d+$/.test(evidence.actionsRunId) || evidence.runAttempt < 1 || !["dev", "main"].includes(evidence.environment) || !/^[a-z0-9]{20,}$/.test(evidence.projectRef ?? "")) throw new Error("Candidate-bound GitHub deployment context and SUPABASE_MIGRATION_EVIDENCE_OUTPUT are required")
    writeFileSync(output, `${JSON.stringify(evidence)}\n`, "utf8")
    console.log(`Prepared ${evidence.migrations.length} reviewed migration digests: ${evidence.inventorySha256}`)
    return
  }
  const remoteDbUrl = process.env.SUPABASE_SCHEMA_DB_URL
  const remoteDumpDbUrl = process.env.SUPABASE_SCHEMA_DUMP_DB_URL ?? remoteDbUrl
  const projectRef = process.env.SUPABASE_PROJECT_REF
  const targetEnvironment = process.env.TARGET_ENVIRONMENT
  const diagnosticMode = process.argv[2] === "diagnose"
  const deploymentBinding = {
    candidateGitSha: process.env.GITHUB_SHA,
    actionsRunId: process.env.GITHUB_RUN_ID,
    runAttempt: process.env.GITHUB_RUN_ATTEMPT,
    environment: targetEnvironment,
    projectRef,
  }
  if (!remoteDbUrl || !projectRef || !["dev", "main"].includes(targetEnvironment) || !/^[0-9a-f]{40}$/.test(deploymentBinding.candidateGitSha ?? "") || (!diagnosticMode && (!/^\d+$/.test(deploymentBinding.actionsRunId ?? "") || !/^\d+$/.test(deploymentBinding.runAttempt ?? "")))) {
    throw new Error("Candidate-bound GitHub deployment context, SUPABASE_SCHEMA_DB_URL, SUPABASE_PROJECT_REF, and TARGET_ENVIRONMENT=dev|main are required")
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

    const expectedMigrations = expectedMigrationInventory()
    const expectedVersions = expectedMigrations.map((entry) => entry.version)
    const observedVersions = psqlFromParityContainer(projectId, remoteDbUrl, "select version from supabase_migrations.schema_migrations order by version").split("\n")
    if (JSON.stringify(expectedVersions) !== JSON.stringify(observedVersions)) {
      throw new Error(`Migration history drift: expected=${expectedVersions.join(",")} observed=${observedVersions.join(",")}`)
    }
    let expectedEvidence
    if (!diagnosticMode) {
      expectedEvidence = buildMigrationDeployEvidence(deploymentBinding)
      const observedEvidence = observedMigrationEvidence(remoteDbUrl, deploymentBinding)
      if (!validateMigrationDeployEvidence(expectedEvidence, observedEvidence)) {
        throw new Error("migration-digest: remote candidate-bound deploy evidence differs from reviewed migration bytes")
      }
    }
    const valueFlowControls = diagnosticMode
      ? assertValueFlowDisabledWithQuery((sql) => psqlFromParityContainer(projectId, remoteDbUrl, sql))
      : assertValueFlowDisabled(remoteDbUrl)

    const containerLocalDbUrl = "postgresql://postgres:postgres@127.0.0.1:5432/postgres"
    const expectedDump = dumpPublicSchemaFromParityContainer(projectId, containerLocalDbUrl)
    const observedDump = dumpPublicSchemaFromParityContainer(projectId, remoteDumpDbUrl)
    const diagnostic = buildSchemaDiagnostic(expectedDump, observedDump, {
      candidateGitSha: process.env.GITHUB_SHA,
      environment: targetEnvironment,
      projectRef,
      observedAt: new Date().toISOString(),
      pgDumpVersion: pgDumpVersionFromParityContainer(projectId),
      migrationCount: observedVersions.length,
      migrationInventorySha256: expectedEvidence?.inventorySha256 ?? migrationInventorySha256(expectedMigrations),
      enabledProductionValueFlowControlCount: valueFlowControls.enabledCount,
    })
    if (process.env.SUPABASE_SCHEMA_DIAGNOSTIC_OUTPUT) writeFileSync(process.env.SUPABASE_SCHEMA_DIAGNOSTIC_OUTPUT, `${JSON.stringify(diagnostic, null, 2)}\n`, "utf8")
    if (diagnostic.status === "drift") throw new Error(`Effective public schema drift: expected=${diagnostic.expectedSha256} observed=${diagnostic.observedSha256}; sanitized diagnostic written`)
    const { expectedSha256, observedSha256 } = diagnostic
    const result = {
      contractVersion: "fundloop.public-schema-parity/v1",
      candidateGitSha: process.env.GITHUB_SHA ?? "local-unbound",
      environment: targetEnvironment,
      projectRef,
      postgresMajor: 17,
      algorithm: "pg17-public-schema-normalized-v1",
      pgDumpVersion: diagnostic.pgDumpVersion,
      expectedSha256,
      observedSha256,
      observedAt: new Date().toISOString(),
      migrationCount: observedVersions.length,
      migrationInventorySha256: diagnostic.migrationInventorySha256,
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
