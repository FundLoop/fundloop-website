import { createHash } from "node:crypto"
import { appendFileSync, readFileSync, writeFileSync } from "node:fs"
import { pathToFileURL } from "node:url"
import { compareExplicitRfc3339Timestamps, isExplicitRfc3339Timestamp, recordDeployCompletion, validateDeployCompletionEvidence } from "./verify-supabase-schema-parity.mjs"

const canonical = (value) => {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`
  if (value && typeof value === "object") return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}`
  return JSON.stringify(value)
}
const sha256 = (value) => createHash("sha256").update(value).digest("hex")

export function buildSafeSmokeEvidence(input) {
  const payload = {
    contractVersion: "fundloop.safe-runtime-smoke/v1",
    environment: input.environment,
    projectRef: input.projectRef,
    observationGitSha: input.observationGitSha,
    functionName: "epoch-allocation-close",
    unauthenticatedStatusCode: Number(input.statusCode),
    observedAt: input.observedAt,
  }
  return { ...payload, evidenceSha256: sha256(canonical(payload)) }
}

export function verifySafeSmokeEvidence(smoke, binding) {
  const { evidenceSha256, ...payload } = smoke ?? {}
  return payload.contractVersion === "fundloop.safe-runtime-smoke/v1"
    && payload.environment === binding.environment
    && payload.projectRef === binding.projectRef
    && payload.observationGitSha === binding.gitSha
    && payload.functionName === "epoch-allocation-close"
    && payload.unauthenticatedStatusCode === 401
    && isExplicitRfc3339Timestamp(payload.observedAt)
    && evidenceSha256 === sha256(canonical(payload))
}

export function buildEnvironmentManifest({ schema, functions, smoke, context }) {
  if (schema.environment !== functions.environment || schema.projectRef !== functions.projectRef) throw new Error("environment-binding: parity records disagree")
  if (schema.enabledProductionValueFlowControlCount !== 0) throw new Error("value-flow-enabled: immutable manifest publication refused")
  if (!isExplicitRfc3339Timestamp(schema.certifiedDeployment?.recordedAt)) throw new Error("deployment-time: immutable manifest publication refused")
  if (!isExplicitRfc3339Timestamp(schema.observedAt)) throw new Error("schema-observation-time: immutable manifest publication refused")
  if (!isExplicitRfc3339Timestamp(functions.observedAt)) throw new Error("function-observation-time: immutable manifest publication refused")
  if (!isExplicitRfc3339Timestamp(context.observedAt)) throw new Error("observation-time: immutable manifest publication refused")
  if (schema.candidateGitSha !== context.gitSha) throw new Error("schema-observation-sha: immutable manifest publication refused")
  if (functions.candidateGitSha !== context.gitSha) throw new Error("function-observation-sha: immutable manifest publication refused")
  if (smoke.observationGitSha !== context.gitSha) throw new Error("hosted-smoke-observation-sha: immutable manifest publication refused")
  if (!verifySafeSmokeEvidence(smoke, { environment: schema.environment, projectRef: schema.projectRef, gitSha: context.gitSha })) throw new Error("runtime-smoke: evidence invalid")
  if (compareExplicitRfc3339Timestamps(schema.certifiedDeployment.recordedAt, context.observedAt) > 0) throw new Error("deployment-after-observation: immutable manifest publication refused")
  const deploymentEvidence = {
    candidateGitSha: schema.certifiedDeployment.gitSha,
    actionsRunId: schema.certifiedDeployment.githubRunId,
    runAttempt: schema.certifiedDeployment.githubRunAttempt,
    environment: schema.certifiedDeployment.environment,
    projectRef: schema.certifiedDeployment.projectRef,
    inventorySha256: schema.migrationInventorySha256,
    recordedAt: schema.certifiedDeployment.recordedAt,
  }
  if (context.mode === "drift") {
    const certifiedManifest = schema.certifiedDeployment.certifiedManifest
    if (!validateDeployCompletionEvidence(schema.certifiedDeployment.completion, deploymentEvidence, certifiedManifest)) throw new Error("deployment-completion: immutable manifest publication refused")
    if (certifiedManifest.prerequisites.hostedUnauthenticatedDenial.evidence.evidenceSha256 === smoke.evidenceSha256) throw new Error("observation-smoke-not-fresh: immutable manifest publication refused")
  }
  for (const [name, observedAt] of [["schema", schema.observedAt], ["function", functions.observedAt], ["hosted-smoke", smoke.observedAt]]) {
    if (compareExplicitRfc3339Timestamps(observedAt, schema.certifiedDeployment.recordedAt) < 0) throw new Error(`${name}-before-deployment: immutable manifest publication refused`)
    if (context.mode === "drift" && compareExplicitRfc3339Timestamps(observedAt, schema.certifiedDeployment.completion.completedAt) < 0) throw new Error(`${name}-before-completion: immutable manifest publication refused`)
    if (compareExplicitRfc3339Timestamps(observedAt, context.observedAt) > 0) throw new Error(`${name}-after-observation: immutable manifest publication refused`)
  }
  const functionItems = functions.functions.map((entry) => ({
    name: entry.name,
    expectedSourceSha256: entry.expectedSourceSha256,
    observedSourceSha256: entry.observedSourceSha256,
    deployedBundleSha256: entry.deployedBundleSha256,
    remoteVersion: entry.remoteVersion,
    remoteStatus: entry.remoteStatus,
  }))
  const functionInventorySha256 = sha256(canonical(functionItems))
  const payload = {
    contractVersion: "fundloop.environment-delivery-manifest/v1",
    environment: schema.environment,
    projectRef: schema.projectRef,
    observation: {
      gitSha: context.gitSha,
      githubRunId: String(context.githubRunId),
      githubRunAttempt: Number(context.githubRunAttempt),
      observedAt: context.observedAt,
      trigger: context.trigger,
      mode: context.mode,
      functionCandidateGitSha: functions.candidateGitSha,
    },
    certifiedDeployment: schema.certifiedDeployment,
    migrations: {
      algorithm: "sha256-raw-bytes-sorted-filename-v1",
      inventorySha256: schema.migrationInventorySha256,
      orderedInventory: schema.migrationInventory,
      observedHistory: schema.migrationHistory,
    },
    schema: {
      candidateGitSha: schema.candidateGitSha,
      observedAt: schema.observedAt,
      algorithm: schema.algorithm,
      expectedSha256: schema.expectedSha256,
      observedSha256: schema.observedSha256,
      postgresMajor: schema.postgresMajor,
    },
    functions: {
      candidateGitSha: functions.candidateGitSha,
      observedAt: functions.observedAt,
      algorithm: "sha256-function-runtime-closure-sorted-path-v1",
      count: functionItems.length,
      inventorySha256: functionInventorySha256,
      items: functionItems,
    },
    runtimeControls: { productionValueFlowEnabledCount: schema.enabledProductionValueFlowControlCount },
    prerequisites: {
      migrationDeployment: { status: "passed" },
      schemaParity: { status: "passed" },
      functionParity: { status: "passed" },
      valueFlowReadback: { status: "passed", tableCount: schema.productionValueFlowControlTableCount, enabledCount: schema.enabledProductionValueFlowControlCount },
      hostedUnauthenticatedDenial: { status: "passed", evidence: smoke },
    },
  }
  payload.evidence = [
    { evidenceId: "migration-deployment", sha256: sha256(canonical(payload.certifiedDeployment)) },
    { evidenceId: "schema-parity", sha256: sha256(canonical({ migrations: payload.migrations, schema: payload.schema, runtimeControls: payload.runtimeControls, certifiedDeployment: payload.certifiedDeployment })) },
    { evidenceId: "function-parity", sha256: sha256(canonical(payload.functions)) },
    { evidenceId: "runtime-prerequisites", sha256: sha256(canonical(payload.prerequisites)) },
  ]
  return { ...payload, manifestSha256: sha256(canonical(payload)) }
}

export function verifyEnvironmentManifest(manifest) {
  const { manifestSha256, ...payload } = manifest
  const blockers = []
  if (manifest.contractVersion !== "fundloop.environment-delivery-manifest/v1") blockers.push("contract-version")
  if (!['dev', 'main'].includes(manifest.environment) || !/^[a-z0-9]{20,}$/.test(manifest.projectRef ?? "")) blockers.push("environment-binding")
  if (!/^[0-9a-f]{40}$/.test(manifest.observation?.gitSha ?? "")) blockers.push("observation-sha")
  if (!/^[0-9a-f]{40}$/.test(manifest.certifiedDeployment?.gitSha ?? "")) blockers.push("deployment-sha")
  if (manifest.certifiedDeployment?.environment !== manifest.environment || manifest.certifiedDeployment?.projectRef !== manifest.projectRef) blockers.push("deployment-binding")
  const deploymentTimeValid = isExplicitRfc3339Timestamp(manifest.certifiedDeployment?.recordedAt)
  if (!deploymentTimeValid) blockers.push("deployment-time")
  if (!/^\d+$/.test(manifest.certifiedDeployment?.githubRunId ?? "") || !Number.isInteger(manifest.certifiedDeployment?.githubRunAttempt) || manifest.certifiedDeployment.githubRunAttempt < 1) blockers.push("deployment-run")
  const observationTimeValid = isExplicitRfc3339Timestamp(manifest.observation?.observedAt)
  if (!observationTimeValid) blockers.push("observation-time")
  if (!/^\d+$/.test(manifest.observation?.githubRunId ?? "") || !Number.isInteger(manifest.observation?.githubRunAttempt) || manifest.observation.githubRunAttempt < 1) blockers.push("observation-run")
  if (deploymentTimeValid && observationTimeValid && compareExplicitRfc3339Timestamps(manifest.certifiedDeployment.recordedAt, manifest.observation.observedAt) > 0) blockers.push("deployment-after-observation")
  if (!/^[0-9a-f]{40}$/.test(manifest.schema?.candidateGitSha ?? "") || manifest.schema.candidateGitSha !== manifest.observation?.gitSha) blockers.push("schema-observation-sha")
  if (!/^[0-9a-f]{40}$/.test(manifest.functions?.candidateGitSha ?? "") || manifest.functions.candidateGitSha !== manifest.observation?.gitSha || manifest.observation?.functionCandidateGitSha !== manifest.functions?.candidateGitSha) blockers.push("function-observation-sha")
  if (!['deploy', 'drift'].includes(manifest.observation?.mode)) blockers.push("observation-mode")
  if (!['push', 'workflow_run', 'schedule', 'workflow_dispatch'].includes(manifest.observation?.trigger)) blockers.push("observation-trigger")
  if (manifest.observation?.mode === "deploy" && (manifest.certifiedDeployment?.gitSha !== manifest.observation.gitSha || manifest.certifiedDeployment?.githubRunId !== manifest.observation.githubRunId || manifest.certifiedDeployment?.githubRunAttempt !== manifest.observation.githubRunAttempt)) blockers.push("deploy-observation-binding")
  const completionEvidence = {
    candidateGitSha: manifest.certifiedDeployment?.gitSha,
    actionsRunId: manifest.certifiedDeployment?.githubRunId,
    runAttempt: manifest.certifiedDeployment?.githubRunAttempt,
    environment: manifest.certifiedDeployment?.environment,
    projectRef: manifest.certifiedDeployment?.projectRef,
    inventorySha256: manifest.migrations?.inventorySha256,
    recordedAt: manifest.certifiedDeployment?.recordedAt,
  }
  if (manifest.observation?.mode === "drift" && deploymentTimeValid) {
    const certifiedManifest = manifest.certifiedDeployment?.certifiedManifest
    if (!validateDeployCompletionEvidence(manifest.certifiedDeployment?.completion, completionEvidence, certifiedManifest)) blockers.push("deployment-completion")
    if (certifiedManifest?.prerequisites?.hostedUnauthenticatedDenial?.evidence?.evidenceSha256 === manifest.prerequisites?.hostedUnauthenticatedDenial?.evidence?.evidenceSha256) blockers.push("observation-smoke-not-fresh")
  }
  if (!Array.isArray(manifest.migrations?.orderedInventory) || manifest.migrations.orderedInventory.length !== manifest.migrations.observedHistory?.length) blockers.push("migration-history")
  if (manifest.migrations?.algorithm !== "sha256-raw-bytes-sorted-filename-v1" || !/^[0-9a-f]{64}$/.test(manifest.migrations?.inventorySha256 ?? "")) blockers.push("migration-contract")
  const migrationVersions = manifest.migrations?.orderedInventory?.map((item) => item.version) ?? []
  const migrationNames = manifest.migrations?.orderedInventory?.map((item) => item.name) ?? []
  if (new Set(migrationVersions).size !== migrationVersions.length) blockers.push("migration-duplicate")
  if (new Set(migrationNames).size !== migrationNames.length) blockers.push("migration-duplicate")
  if (JSON.stringify(migrationVersions) !== JSON.stringify([...migrationVersions].sort())) blockers.push("migration-order")
  if (JSON.stringify(migrationNames) !== JSON.stringify([...migrationNames].sort())) blockers.push("migration-order")
  if (manifest.migrations?.orderedInventory?.some((item) => !/^\d{14}$/.test(item.version) || !item.name.startsWith(`${item.version}_`) || !/^[0-9a-f]{64}$/.test(item.fileSha256))) blockers.push("migration-item")
  if (manifest.migrations?.inventorySha256 !== sha256(canonical(manifest.migrations?.orderedInventory ?? []))) blockers.push("migration-digest")
  if (manifest.migrations?.orderedInventory?.some((item, index) => item.version !== manifest.migrations.observedHistory[index])) blockers.push("migration-order")
  if (manifest.schema?.algorithm !== "pg17-public-schema-normalized-v2" || manifest.schema?.postgresMajor !== 17
    || !/^[0-9a-f]{64}$/.test(manifest.schema?.expectedSha256 ?? "") || !/^[0-9a-f]{64}$/.test(manifest.schema?.observedSha256 ?? "")) blockers.push("schema-contract")
  if (manifest.schema?.expectedSha256 !== manifest.schema?.observedSha256) blockers.push("schema-digest")
  if (manifest.functions?.count !== manifest.functions?.items?.length || manifest.functions.count < 1) blockers.push("function-count")
  if (manifest.functions?.algorithm !== "sha256-function-runtime-closure-sorted-path-v1" || !/^[0-9a-f]{64}$/.test(manifest.functions?.inventorySha256 ?? "")) blockers.push("function-contract")
  const functionNames = manifest.functions?.items?.map((item) => item.name) ?? []
  if (new Set(functionNames).size !== functionNames.length) blockers.push("function-duplicate")
  if (JSON.stringify(functionNames) !== JSON.stringify([...functionNames].sort())) blockers.push("function-order")
  if (manifest.functions?.inventorySha256 !== sha256(canonical(manifest.functions?.items ?? []))) blockers.push("function-digest")
  for (const item of manifest.functions?.items ?? []) {
    if (!/^[a-z0-9][a-z0-9-]*$/.test(item.name) || !/^[0-9a-f]{64}$/.test(item.expectedSourceSha256) || !/^[0-9a-f]{64}$/.test(item.observedSourceSha256) || !/^[0-9a-f]{64}$/.test(item.deployedBundleSha256)) blockers.push(`function-item:${item.name}`)
    if (item.expectedSourceSha256 !== item.observedSourceSha256) blockers.push(`function-source:${item.name}`)
    if (item.remoteStatus !== "ACTIVE" || !Number.isInteger(item.remoteVersion) || item.remoteVersion < 1) blockers.push(`function-status:${item.name}`)
  }
  if (manifest.runtimeControls?.productionValueFlowEnabledCount !== 0) blockers.push("value-flow-enabled")
  const smoke = manifest.prerequisites?.hostedUnauthenticatedDenial?.evidence
  if (!/^[0-9a-f]{40}$/.test(smoke?.observationGitSha ?? "") || smoke.observationGitSha !== manifest.observation?.gitSha) blockers.push("hosted-smoke-observation-sha")
  const smokeValid = verifySafeSmokeEvidence(smoke, { environment: manifest.environment, projectRef: manifest.projectRef, gitSha: manifest.observation?.gitSha })
  if (manifest.prerequisites?.migrationDeployment?.status !== "passed"
    || manifest.prerequisites?.schemaParity?.status !== "passed"
    || manifest.prerequisites?.functionParity?.status !== "passed") blockers.push("prerequisite-status")
  if (manifest.prerequisites?.valueFlowReadback?.status !== "passed"
    || !Number.isInteger(manifest.prerequisites?.valueFlowReadback?.tableCount)
    || manifest.prerequisites.valueFlowReadback.tableCount < 1
    || manifest.prerequisites.valueFlowReadback.enabledCount !== 0) blockers.push("value-flow-readback")
  if (manifest.prerequisites?.hostedUnauthenticatedDenial?.status !== "passed"
    || !smokeValid) blockers.push("runtime-smoke")
  const componentObservations = [
    ["schema", manifest.schema?.observedAt],
    ["function", manifest.functions?.observedAt],
    ["hosted-smoke", smoke?.observedAt],
  ]
  for (const [name, observedAt] of componentObservations) {
    const componentTimeValid = isExplicitRfc3339Timestamp(observedAt)
    if (!componentTimeValid) blockers.push(`${name}-observation-time`)
    if (componentTimeValid && deploymentTimeValid && compareExplicitRfc3339Timestamps(observedAt, manifest.certifiedDeployment.recordedAt) < 0) blockers.push(`${name}-before-deployment`)
    if (componentTimeValid && manifest.observation?.mode === "drift" && isExplicitRfc3339Timestamp(manifest.certifiedDeployment?.completion?.completedAt) && compareExplicitRfc3339Timestamps(observedAt, manifest.certifiedDeployment.completion.completedAt) < 0) blockers.push(`${name}-before-completion`)
    if (componentTimeValid && observationTimeValid && compareExplicitRfc3339Timestamps(observedAt, manifest.observation.observedAt) > 0) blockers.push(`${name}-after-observation`)
  }
  const expectedEvidence = [
    { evidenceId: "migration-deployment", sha256: sha256(canonical(manifest.certifiedDeployment)) },
    { evidenceId: "schema-parity", sha256: sha256(canonical({ migrations: manifest.migrations, schema: manifest.schema, runtimeControls: manifest.runtimeControls, certifiedDeployment: manifest.certifiedDeployment })) },
    { evidenceId: "function-parity", sha256: sha256(canonical(manifest.functions)) },
    { evidenceId: "runtime-prerequisites", sha256: sha256(canonical(manifest.prerequisites)) },
  ]
  if (canonical(manifest.evidence) !== canonical(expectedEvidence)) blockers.push("evidence")
  if (manifestSha256 !== sha256(canonical(payload))) blockers.push("manifest-digest")
  return { ok: blockers.length === 0, blockers }
}

function main() {
  const command = process.argv[2]
  const output = process.env.SUPABASE_ENVIRONMENT_MANIFEST_OUTPUT
  if (command === "complete") {
    const dbUrl = process.env.SUPABASE_SCHEMA_DB_URL
    if (!output || !dbUrl) throw new Error("SUPABASE_ENVIRONMENT_MANIFEST_OUTPUT and SUPABASE_SCHEMA_DB_URL are required")
    const manifest = JSON.parse(readFileSync(output, "utf8"))
    const result = verifyEnvironmentManifest(manifest)
    if (!result.ok || manifest.observation?.mode !== "deploy") throw new Error(`deployment-completion-invalid: ${result.blockers.join(",") || "not-a-deploy-manifest"}`)
    const binding = {
      candidateGitSha: process.env.GITHUB_SHA,
      actionsRunId: process.env.GITHUB_RUN_ID,
      runAttempt: Number(process.env.GITHUB_RUN_ATTEMPT),
      environment: process.env.TARGET_ENVIRONMENT,
      projectRef: process.env.SUPABASE_PROJECT_REF,
    }
    recordDeployCompletion(dbUrl, manifest, binding)
    console.log(`Certified completed ${binding.environment} Supabase deployment ${binding.candidateGitSha}`)
    return
  }
  if (command === "record-smoke") {
    const smokeOutput = process.env.SUPABASE_SAFE_SMOKE_OUTPUT
    if (!smokeOutput) throw new Error("SUPABASE_SAFE_SMOKE_OUTPUT is required")
    const smoke = buildSafeSmokeEvidence({
      environment: process.env.TARGET_ENVIRONMENT,
      projectRef: process.env.SUPABASE_PROJECT_REF,
      observationGitSha: process.env.OBSERVATION_GIT_SHA ?? process.env.GITHUB_SHA,
      statusCode: process.env.SUPABASE_SAFE_SMOKE_STATUS_CODE,
      observedAt: new Date().toISOString(),
    })
    if (!verifySafeSmokeEvidence(smoke, { environment: smoke.environment, projectRef: smoke.projectRef, gitSha: smoke.observationGitSha })) throw new Error(`runtime-smoke: expected unauthenticated HTTP 401, observed ${Number.isFinite(smoke.unauthenticatedStatusCode) ? smoke.unauthenticatedStatusCode : "invalid"}`)
    writeFileSync(smokeOutput, `${JSON.stringify(smoke, null, 2)}\n`)
    return
  }
  if (command === "compose") {
    const schema = JSON.parse(readFileSync(process.env.SUPABASE_SCHEMA_PARITY_OUTPUT, "utf8"))
    const functions = JSON.parse(readFileSync(process.env.SUPABASE_FUNCTION_PARITY_OUTPUT, "utf8"))
    const smoke = JSON.parse(readFileSync(process.env.SUPABASE_SAFE_SMOKE_OUTPUT, "utf8"))
    const manifest = buildEnvironmentManifest({ schema, functions, smoke, context: {
      gitSha: process.env.OBSERVATION_GIT_SHA ?? process.env.GITHUB_SHA,
      githubRunId: process.env.GITHUB_RUN_ID,
      githubRunAttempt: process.env.GITHUB_RUN_ATTEMPT,
      observedAt: new Date().toISOString(),
      trigger: process.env.GITHUB_EVENT_NAME,
      mode: process.env.SUPABASE_MANIFEST_MODE ?? "deploy",
    } })
    const result = verifyEnvironmentManifest(manifest)
    if (!result.ok) throw new Error(`environment-manifest-invalid: ${result.blockers.join(",")}`)
    if (!output) throw new Error("SUPABASE_ENVIRONMENT_MANIFEST_OUTPUT is required")
    writeFileSync(output, `${JSON.stringify(manifest, null, 2)}\n`)
    if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, [
      `deployment_sha=${manifest.certifiedDeployment.gitSha}`,
      `deployment_run_id=${manifest.certifiedDeployment.githubRunId}`,
      `deployment_run_attempt=${manifest.certifiedDeployment.githubRunAttempt}`,
      `observation_sha=${manifest.observation.gitSha}`,
      `observation_run_id=${manifest.observation.githubRunId}`,
      `observation_run_attempt=${manifest.observation.githubRunAttempt}`,
    ].join("\n") + "\n")
    console.log(`Verified immutable ${manifest.environment} manifest ${manifest.manifestSha256}`)
    return
  }
  const manifest = JSON.parse(readFileSync(process.env.SUPABASE_ENVIRONMENT_MANIFEST_INPUT, "utf8"))
  const result = verifyEnvironmentManifest(manifest)
  if (!result.ok) throw new Error(`environment-manifest-invalid: ${result.blockers.join(",")}`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main()
