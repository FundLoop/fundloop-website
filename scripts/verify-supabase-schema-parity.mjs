import { createHash, randomBytes } from "node:crypto"
import { execFileSync } from "node:child_process"
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs"
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

function normalizePublicSchemaV1(dump) {
  const lines = dump
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.replace(/ +$/g, ""))
    .filter((line) => line.length > 0 && !line.startsWith("--") && !line.startsWith("\\restrict") && !line.startsWith("\\unrestrict"))
  return `${lines.join("\n")}\n`
}

function normalizePolicyRoleOrder(line) {
  const match = line.match(/^(CREATE POLICY .+ ON .+ TO )([^;]+?)( (?:USING|WITH CHECK) .+;|;)$/)
  if (!match) return line
  const roles = match[2].split(",").map((role) => role.trim()).sort()
  return `${match[1]}${roles.join(", ")}${match[3]}`
}

export function normalizePublicSchema(dump) {
  return normalizePublicSchemaV1(dump)
    .split("\n")
    .map(normalizePolicyRoleOrder)
    .join("\n")
}

function fingerprint(schema) {
  return createHash("sha256").update(schema).digest("hex")
}

function safeObjectIdentity(value) {
  return value.replace(/[^A-Za-z0-9_.:#\- ()\[\]]/g, "?").slice(0, 240)
}

export function schemaObjectManifest(dump, normalize = normalizePublicSchema) {
  const sections = []
  let identity = "preamble"
  let lines = []
  const occurrences = new Map()
  const flush = () => {
    const normalized = normalize(lines.join("\n"))
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

function buildSchemaDiagnosticWithNormalizer(expectedDump, observedDump, metadata, maxLineDifferences, normalize) {
  const expectedSchema = normalize(expectedDump)
  const observedSchema = normalize(observedDump)
  const expectedObjects = schemaObjectManifest(expectedDump, normalize)
  const observedObjects = schemaObjectManifest(observedDump, normalize)
  const expectedByKey = new Map(expectedObjects.map((entry) => [entry.objectKey, entry]))
  const observedByKey = new Map(observedObjects.map((entry) => [entry.objectKey, entry]))
  const allKeys = [...new Set([...expectedByKey.keys(), ...observedByKey.keys()])].sort()
  const objectDifferences = allKeys.flatMap((objectKey) => {
    const expected = expectedByKey.get(objectKey)
    const observed = observedByKey.get(objectKey)
    const objectKeySha256 = fingerprint(objectKey)
    if (!expected) {
      const objectType = objectKey.match(/ \[([^\]]+)\]#\d+$/)?.[1] ?? "UNKNOWN"
      const policyParent = objectKey.match(/^([^ ]+) .+ \[POLICY\]#\d+$/)?.[1]
      const reviewedParentObjectKey = policyParent && expectedByKey.has(`${policyParent} [TABLE]#1`)
        ? safeObjectIdentity(`${policyParent} [TABLE]#1`)
        : null
      return [{ objectKeySha256, status: "unexpected", objectType, reviewedParentObjectKey, observedSha256: observed.sha256 }]
    }
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
    contractVersion: "fundloop.public-schema-diagnostic/v2",
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

export function buildSchemaDiagnostic(expectedDump, observedDump, metadata = {}, maxLineDifferences = 200) {
  const diagnostic = buildSchemaDiagnosticWithNormalizer(expectedDump, observedDump, metadata, maxLineDifferences, normalizePublicSchema)
  const legacy = buildSchemaDiagnosticWithNormalizer(expectedDump, observedDump, {}, 0, normalizePublicSchemaV1)
  diagnostic.legacyRepairSignature = {
    expectedSha256: legacy.expectedSha256,
    observedSha256: legacy.observedSha256,
    expectedNormalizedLineCount: legacy.expectedNormalizedLineCount,
    observedNormalizedLineCount: legacy.observedNormalizedLineCount,
    expectedObjectCount: legacy.expectedObjectCount,
    observedObjectCount: legacy.observedObjectCount,
    objectDifferences: legacy.objectDifferences,
  }
  return diagnostic
}

function canonicalObjectDifferences(value) {
  return canonicalJson(value.map((entry) => Object.fromEntries(Object.entries(entry).filter(([, field]) => field !== null))))
}

export function validatePendingSchemaRepair(manifest, diagnostic, observedVersions, expectedVersions) {
  if (!manifest || manifest.contractVersion !== "fundloop.public-schema-repair/v1") return false
  const repairIsOnlyPendingMigration = expectedVersions.length === observedVersions.length + 1
    && expectedVersions.at(-1) === manifest.repairMigrationVersion
    && canonicalJson(expectedVersions.slice(0, -1)) === canonicalJson(observedVersions)
  return repairIsOnlyPendingMigration
    && manifest.environment === diagnostic.environment
    && manifest.projectRef === diagnostic.projectRef
    && manifest.baselineMigrationCount === observedVersions.length
    && manifest.baselineMigrationInventorySha256 === diagnostic.baselineMigrationInventorySha256
    && manifest.expectedSha256 === diagnostic.legacyRepairSignature?.expectedSha256
    && manifest.observedSha256 === diagnostic.legacyRepairSignature?.observedSha256
    && manifest.expectedNormalizedLineCount === diagnostic.legacyRepairSignature?.expectedNormalizedLineCount
    && manifest.observedNormalizedLineCount === diagnostic.legacyRepairSignature?.observedNormalizedLineCount
    && manifest.expectedObjectCount === diagnostic.legacyRepairSignature?.expectedObjectCount
    && manifest.observedObjectCount === diagnostic.legacyRepairSignature?.observedObjectCount
    && manifest.enabledProductionValueFlowControlCount === diagnostic.enabledProductionValueFlowControlCount
    && canonicalObjectDifferences(manifest.objectDifferences) === canonicalObjectDifferences(diagnostic.legacyRepairSignature?.objectDifferences ?? [])
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

function parseExplicitRfc3339Timestamp(value) {
  if (typeof value !== "string") return false
  const match = /^(\d{4})-(0[1-9]|1[0-2])-(\d{2})T([01]\d|2[0-3]):([0-5]\d):([0-5]\d)(?:\.(\d+))?(Z|([+-])([01]\d|2[0-3]):([0-5]\d))$/.exec(value)
  if (!match) return false
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)
  const daysInMonth = [31, leapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1]
  if (day < 1 || day > daysInMonth) return false
  const utc = new Date(0)
  utc.setUTCFullYear(year, month - 1, day)
  utc.setUTCHours(Number(match[4]), Number(match[5]), Number(match[6]), 0)
  const offsetSeconds = match[9]
    ? (match[9] === "+" ? 1 : -1) * (Number(match[10]) * 60 + Number(match[11])) * 60
    : 0
  return {
    epochSecond: BigInt(utc.getTime() / 1000 - offsetSeconds),
    fractionalSecond: match[7] ?? "",
  }
}

export function isExplicitRfc3339Timestamp(value) {
  return parseExplicitRfc3339Timestamp(value) !== false
}

export function compareExplicitRfc3339Timestamps(left, right) {
  const parsedLeft = parseExplicitRfc3339Timestamp(left)
  const parsedRight = parseExplicitRfc3339Timestamp(right)
  if (!parsedLeft || !parsedRight) throw new Error("invalid-explicit-rfc3339-timestamp")
  if (parsedLeft.epochSecond !== parsedRight.epochSecond) return parsedLeft.epochSecond < parsedRight.epochSecond ? -1 : 1
  const precision = Math.max(parsedLeft.fractionalSecond.length, parsedRight.fractionalSecond.length)
  const leftFraction = parsedLeft.fractionalSecond.padEnd(precision, "0")
  const rightFraction = parsedRight.fractionalSecond.padEnd(precision, "0")
  return leftFraction === rightFraction ? 0 : leftFraction < rightFraction ? -1 : 1
}

export function bindObservedMigrationDeployEvidence(expected, observed) {
  if (!validateMigrationDeployEvidence(expected, observed)
    || !isExplicitRfc3339Timestamp(observed.recordedAt)) {
    throw new Error("migration-deployment-evidence-invalid: remote immutable row failed candidate or timestamp validation")
  }
  return { ...expected, recordedAt: observed.recordedAt }
}

export function libpqConnectionEnvironment(dbUrl) {
  const parsed = new URL(dbUrl)
  if (!["postgres:", "postgresql:"].includes(parsed.protocol) || !parsed.hostname || !parsed.username || !parsed.pathname.startsWith("/")) throw new Error("invalid-libpq-connection-url")
  return {
    PGHOST: parsed.hostname,
    PGPORT: parsed.port || "5432",
    PGUSER: decodeURIComponent(parsed.username),
    PGPASSWORD: decodeURIComponent(parsed.password),
    PGDATABASE: decodeURIComponent(parsed.pathname.slice(1)),
    PGSSLMODE: parsed.hostname === "127.0.0.1" || parsed.hostname === "localhost" ? "disable" : "require",
  }
}

function containerLibpqConnection(projectId, dbUrl) {
  const env = libpqConnectionEnvironment(dbUrl)
  return {
    args: ["exec", ...Object.keys(env).flatMap((name) => ["--env", name]), `supabase_db_${projectId}`],
    env: { ...process.env, ...env },
  }
}

function dumpPublicSchemaFromParityContainer(projectId, dbUrl) {
  const connection = containerLibpqConnection(projectId, dbUrl)
  return run("docker", [...connection.args, "pg_dump", "--schema-only", "--schema=public", "--no-owner", "--no-privileges", "--no-comments"], { encoding: "utf8", env: connection.env })
}

function pgDumpVersionFromParityContainer(projectId) {
  return run("docker", ["exec", `supabase_db_${projectId}`, "pg_dump", "--version"], { encoding: "utf8" }).trim()
}

function psqlFromParityContainer(projectId, dbUrl, sql) {
  const connection = containerLibpqConnection(projectId, dbUrl)
  return run("docker", [...connection.args, "psql", "-X", "-v", "ON_ERROR_STOP=1", "-Atqc", sql], { encoding: "utf8", env: connection.env }).trim()
}

function psqlFromHost(dbUrl, sql) {
  const connection = libpqConnectionEnvironment(dbUrl)
  return run("psql", ["-X", "-v", "ON_ERROR_STOP=1", "-Atqc", sql], { encoding: "utf8", env: { ...process.env, ...connection } }).trim()
}

function observedMigrationEvidence(dbUrl, binding) {
  const sql = `select json_build_object('contractVersion',contract_version,'candidateGitSha',candidate_git_sha,'actionsRunId',actions_run_id::text,'runAttempt',run_attempt,'environment',deployment_environment,'projectRef',project_ref,'migrations',migration_inventory,'inventorySha256',inventory_sha256,'recordedAt',recorded_at)::text from public.supabase_deploy_migration_evidence where candidate_git_sha='${binding.candidateGitSha}' and actions_run_id=${Number(binding.actionsRunId)} and run_attempt=${Number(binding.runAttempt)} and deployment_environment='${binding.environment}' and project_ref='${binding.projectRef}' order by recorded_at desc limit 1`
  const output = psqlFromHost(dbUrl, sql)
  if (!output) throw new Error("unverifiable-migration-source: no candidate-bound remote deploy evidence")
  return JSON.parse(output)
}

export function validateMatchingMigrationEvidence(evidence, binding, expectedInventorySha256) {
  return evidence.contractVersion === "fundloop.migration-deploy-evidence/v1"
    && evidence.environment === binding.environment
    && evidence.projectRef === binding.projectRef
    && /^[0-9a-f]{40}$/.test(evidence.candidateGitSha ?? "")
    && /^\d+$/.test(evidence.actionsRunId ?? "")
    && Number.isInteger(evidence.runAttempt) && evidence.runAttempt >= 1
    && isExplicitRfc3339Timestamp(evidence.recordedAt)
    && evidence.inventorySha256 === migrationInventorySha256(evidence.migrations ?? [])
    && evidence.inventorySha256 === expectedInventorySha256
}

function latestMatchingMigrationEvidence(dbUrl, binding, expectedInventorySha256) {
  const sql = `select json_build_object('contractVersion',contract_version,'candidateGitSha',candidate_git_sha,'actionsRunId',actions_run_id::text,'runAttempt',run_attempt,'environment',deployment_environment,'projectRef',project_ref,'migrations',migration_inventory,'inventorySha256',inventory_sha256,'recordedAt',recorded_at)::text from public.supabase_deploy_migration_evidence where deployment_environment='${binding.environment}' and project_ref='${binding.projectRef}' and inventory_sha256='${expectedInventorySha256}' order by recorded_at desc limit 1`
  const output = psqlFromHost(dbUrl, sql)
  if (!output) throw new Error("deployment-evidence-missing: no immutable deployment record matches reviewed migration bytes")
  const evidence = JSON.parse(output)
  if (!validateMatchingMigrationEvidence(evidence, binding, expectedInventorySha256)) {
    throw new Error("deployment-evidence-invalid: immutable deployment record failed independent validation")
  }
  return evidence
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
  return assertValueFlowDisabledWithQuery((sql) => psqlFromHost(dbUrl, sql))
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
  const driftMode = process.argv[2] === "drift"
  const repairManifestPath = path.join(process.cwd(), "supabase/schema-repair-manifests/20260812_dev_public_schema_drift.json")
  const repairManifest = diagnosticMode && existsSync(repairManifestPath)
    ? JSON.parse(readFileSync(repairManifestPath, "utf8"))
    : null
  const deploymentBinding = {
    candidateGitSha: process.env.OBSERVATION_GIT_SHA ?? process.env.GITHUB_SHA,
    actionsRunId: process.env.GITHUB_RUN_ID,
    runAttempt: process.env.GITHUB_RUN_ATTEMPT,
    environment: targetEnvironment,
    projectRef,
  }
  if (!remoteDbUrl || !projectRef || !["dev", "main"].includes(targetEnvironment) || !/^[0-9a-f]{40}$/.test(deploymentBinding.candidateGitSha ?? "") || (!diagnosticMode && !driftMode && (!/^\d+$/.test(deploymentBinding.actionsRunId ?? "") || !/^\d+$/.test(deploymentBinding.runAttempt ?? "")))) {
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
    const repairIsOnlyPendingMigration = diagnosticMode && repairManifest
      && expectedVersions.length === observedVersions.length + 1
      && expectedVersions.at(-1) === repairManifest.repairMigrationVersion
      && canonicalJson(expectedVersions.slice(0, -1)) === canonicalJson(observedVersions)
    if (JSON.stringify(expectedVersions) !== JSON.stringify(observedVersions) && !repairIsOnlyPendingMigration) {
      throw new Error(`Migration history drift: expected=${expectedVersions.join(",")} observed=${observedVersions.join(",")}`)
    }
    let expectedEvidence
    if (!diagnosticMode && !driftMode) {
      expectedEvidence = buildMigrationDeployEvidence(deploymentBinding)
      const observedEvidence = observedMigrationEvidence(remoteDbUrl, deploymentBinding)
      try { expectedEvidence = bindObservedMigrationDeployEvidence(expectedEvidence, observedEvidence) }
      catch { throw new Error("migration-digest: remote candidate-bound deploy evidence differs from reviewed migration bytes or has no immutable timestamp") }
    } else if (driftMode) {
      const expectedInventory = buildMigrationDeployEvidence({
        ...deploymentBinding,
        actionsRunId: process.env.GITHUB_RUN_ID ?? "1",
        runAttempt: process.env.GITHUB_RUN_ATTEMPT ?? "1",
      })
      expectedEvidence = latestMatchingMigrationEvidence(remoteDbUrl, deploymentBinding, expectedInventory.inventorySha256)
      if (canonicalJson(expectedEvidence.migrations) !== canonicalJson(expectedInventory.migrations)) throw new Error("migration-digest: matching digest record has different ordered inventory")
    }
    const valueFlowControls = diagnosticMode
      ? assertValueFlowDisabledWithQuery((sql) => psqlFromParityContainer(projectId, remoteDbUrl, sql))
      : assertValueFlowDisabled(remoteDbUrl)

    const containerLocalDbUrl = "postgresql://postgres:postgres@127.0.0.1:5432/postgres"
    const expectedDump = dumpPublicSchemaFromParityContainer(projectId, containerLocalDbUrl)
    const observedDump = dumpPublicSchemaFromParityContainer(projectId, remoteDumpDbUrl)
    const diagnostic = buildSchemaDiagnostic(expectedDump, observedDump, {
      candidateGitSha: process.env.OBSERVATION_GIT_SHA ?? process.env.GITHUB_SHA,
      environment: targetEnvironment,
      projectRef,
      observedAt: new Date().toISOString(),
      pgDumpVersion: pgDumpVersionFromParityContainer(projectId),
      migrationCount: observedVersions.length,
      migrationInventorySha256: expectedEvidence?.inventorySha256 ?? migrationInventorySha256(expectedMigrations),
      baselineMigrationInventorySha256: repairIsOnlyPendingMigration
        ? migrationInventorySha256(expectedMigrations.slice(0, -1))
        : null,
      enabledProductionValueFlowControlCount: valueFlowControls.enabledCount,
    })
    const pendingRepairValidated = diagnostic.status === "drift"
      && validatePendingSchemaRepair(repairManifest, diagnostic, observedVersions, expectedVersions)
    if (pendingRepairValidated) diagnostic.repairValidation = {
      status: "pending-exact-match",
      repairMigrationVersion: repairManifest.repairMigrationVersion,
      baselineMigrationInventorySha256: repairManifest.baselineMigrationInventorySha256,
    }
    if (!repairIsOnlyPendingMigration) delete diagnostic.legacyRepairSignature
    if (process.env.SUPABASE_SCHEMA_DIAGNOSTIC_OUTPUT) writeFileSync(process.env.SUPABASE_SCHEMA_DIAGNOSTIC_OUTPUT, `${JSON.stringify(diagnostic, null, 2)}\n`, "utf8")
    if (diagnostic.status === "drift" && !pendingRepairValidated) throw new Error(`Effective public schema drift: expected=${diagnostic.expectedSha256} observed=${diagnostic.observedSha256}; sanitized diagnostic written`)
    if (pendingRepairValidated) {
      console.log(`Validated exact pending Dev schema repair ${repairManifest.repairMigrationVersion} for observed drift ${diagnostic.observedSha256}`)
      return
    }
    const { expectedSha256, observedSha256 } = diagnostic
    const result = {
      contractVersion: "fundloop.public-schema-parity/v1",
      candidateGitSha: process.env.OBSERVATION_GIT_SHA ?? process.env.GITHUB_SHA ?? "local-unbound",
      environment: targetEnvironment,
      projectRef,
      postgresMajor: 17,
      algorithm: "pg17-public-schema-normalized-v2",
      pgDumpVersion: diagnostic.pgDumpVersion,
      expectedSha256,
      observedSha256,
      observedAt: new Date().toISOString(),
      migrationCount: observedVersions.length,
      migrationHistory: observedVersions,
      migrationInventory: expectedMigrations,
      migrationInventorySha256: diagnostic.migrationInventorySha256,
      certifiedDeployment: {
        gitSha: expectedEvidence?.candidateGitSha ?? process.env.GITHUB_SHA,
        githubRunId: String(expectedEvidence?.actionsRunId ?? process.env.GITHUB_RUN_ID),
        githubRunAttempt: Number(expectedEvidence?.runAttempt ?? process.env.GITHUB_RUN_ATTEMPT),
        recordedAt: expectedEvidence?.recordedAt ?? new Date().toISOString(),
        environment: targetEnvironment,
        projectRef,
      },
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
