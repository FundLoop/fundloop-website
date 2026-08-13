import { readFileSync } from "node:fs"
import { createHash } from "node:crypto"
import { describe, expect, it } from "vitest"
import { buildEnvironmentManifest, buildSafeSmokeEvidence, verifyCertifiedDeploymentManifest, verifyEnvironmentManifest } from "../scripts/verify-supabase-environment-manifest.mjs"
import { shouldObservePush, SUPABASE_DEPLOY_PATH_GLOBS } from "../scripts/classify-supabase-drift-push.mjs"
import { expectedFunctionNames, expectedSourceClosure } from "../scripts/verify-supabase-function-parity.mjs"
import { resolveSupabasePoolerTarget } from "../scripts/resolve-supabase-pooler-target.mjs"

const migration = { version: "20260812130000", name: "20260812130000_repair.sql", fileSha256: "a".repeat(64) }
const functionEntry = (index: number) => ({
  name: `function-${String(index).padStart(2, "0")}`,
  expectedSourceSha256: "b".repeat(64),
  observedSourceSha256: "b".repeat(64),
  deployedBundleSha256: "c".repeat(64),
  remoteVersion: 1,
  remoteStatus: "ACTIVE",
})
const stable = (value: any): string => Array.isArray(value) ? `[${value.map(stable).join(",")}]` : value && typeof value === "object" ? `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stable(value[key])}`).join(",")}}` : JSON.stringify(value)
const digest = (value: any) => createHash("sha256").update(stable(value)).digest("hex")
const migrationDigest = createHash("sha256").update(stable([migration])).digest("hex")
const schema: any = {
  environment: "dev", projectRef: "a".repeat(20), algorithm: "pg17-public-schema-normalized-v2", postgresMajor: 17,
  expectedSha256: "d".repeat(64), observedSha256: "d".repeat(64), migrationInventorySha256: migrationDigest,
  migrationInventory: [migration], migrationHistory: [migration.version], enabledProductionValueFlowControlCount: 0,
  productionValueFlowControlTableCount: 4,
  candidateGitSha: "2".repeat(40), observedAt: "2026-08-12T19:56:00Z",
  certifiedDeployment: { gitSha: "1".repeat(40), githubRunId: "100", githubRunAttempt: 2, recordedAt: "2026-08-12T19:00:00Z", environment: "dev", projectRef: "a".repeat(20) },
}
const functions = { candidateGitSha: "2".repeat(40), observedAt: "2026-08-12T19:57:00Z", environment: "dev", projectRef: "a".repeat(20), functions: Array.from({ length: 62 }, (_, index) => functionEntry(index)) }
const deployContext = { gitSha: "1".repeat(40), githubRunId: "100", githubRunAttempt: 2, observedAt: "2026-08-12T19:50:00Z", trigger: "push", mode: "deploy" }
const deploySchema = { ...schema, candidateGitSha: deployContext.gitSha, observedAt: "2026-08-12T19:30:00Z", certifiedDeployment: { ...schema.certifiedDeployment } }
const deployFunctions = { ...functions, candidateGitSha: deployContext.gitSha, observedAt: "2026-08-12T19:45:00Z" }
const deploySmoke = buildSafeSmokeEvidence({ environment: "dev", projectRef: "a".repeat(20), observationGitSha: deployContext.gitSha, statusCode: 401, observedAt: "2026-08-12T19:49:00Z" })
const certifiedManifest = buildEnvironmentManifest({ schema: deploySchema, functions: deployFunctions, smoke: deploySmoke, context: deployContext })
schema.certifiedDeployment = { ...schema.certifiedDeployment, certifiedManifest, completion: {
  contractVersion: "fundloop.deploy-completion-evidence/v1", candidateGitSha: "1".repeat(40), actionsRunId: "100", runAttempt: 2,
  environment: "dev", projectRef: "a".repeat(20), inventorySha256: migrationDigest,
  schemaExpectedSha256: certifiedManifest.schema.expectedSha256, schemaObservedSha256: certifiedManifest.schema.observedSha256,
  functionInventorySha256: certifiedManifest.functions.inventorySha256,
  hostedSmokeEvidenceSha256: deploySmoke.evidenceSha256, deploymentManifestSha256: certifiedManifest.manifestSha256,
  completedAt: "2026-08-12T19:55:00Z",
} }
const context = { gitSha: "2".repeat(40), githubRunId: "200", githubRunAttempt: 3, observedAt: "2026-08-12T20:00:00Z", trigger: "push", mode: "drift" }
const smoke = buildSafeSmokeEvidence({ environment: "dev", projectRef: "a".repeat(20), observationGitSha: context.gitSha, statusCode: 401, observedAt: "2026-08-12T19:59:00Z" })

const restoreManifestIntegrity = (manifest: any) => {
  manifest.evidence = [
    { evidenceId: "migration-deployment", sha256: digest(manifest.certifiedDeployment) },
    { evidenceId: "schema-parity", sha256: digest({ migrations: manifest.migrations, schema: manifest.schema, runtimeControls: manifest.runtimeControls, certifiedDeployment: manifest.certifiedDeployment }) },
    { evidenceId: "function-parity", sha256: digest(manifest.functions) },
    { evidenceId: "runtime-prerequisites", sha256: digest(manifest.prerequisites) },
  ]
  const { manifestSha256: _ignored, ...payload } = manifest
  manifest.manifestSha256 = digest(payload)
  return manifest
}

const withCertifiedChronology = (input: any, recordedAt: string, completedAt: string) => {
  const next = structuredClone(input)
  const certified = structuredClone(next.certifiedDeployment.certifiedManifest)
  certified.certifiedDeployment.recordedAt = recordedAt
  restoreManifestIntegrity(certified)
  next.certifiedDeployment.recordedAt = recordedAt
  next.certifiedDeployment.certifiedManifest = certified
  next.certifiedDeployment.completion = {
    ...next.certifiedDeployment.completion,
    deploymentManifestSha256: certified.manifestSha256,
    completedAt,
  }
  return next
}

describe("immutable Supabase environment manifests", () => {
  it("preserves distinct certified deployment and observation provenance", () => {
    const manifest = buildEnvironmentManifest({ schema, functions, smoke, context })
    expect(manifest.certifiedDeployment.gitSha).toBe("1".repeat(40))
    expect(manifest.observation.gitSha).toBe("2".repeat(40))
    expect(manifest.certifiedDeployment.certifiedManifest.prerequisites.hostedUnauthenticatedDenial.evidence.evidenceSha256).not.toBe(manifest.prerequisites.hostedUnauthenticatedDenial.evidence.evidenceSha256)
    expect(verifyEnvironmentManifest(manifest)).toEqual({ ok: true, blockers: [] })
  })

  it("binds completion to the full retained certified deploy manifest and a later fresh smoke", () => {
    const valid = buildEnvironmentManifest({ schema, functions, smoke, context })
    expect(verifyCertifiedDeploymentManifest(valid.certifiedDeployment.certifiedManifest)).toEqual({ ok: true, blockers: [] })
    const completionCases: Array<[string, (changed: any) => void]> = [
      ["schema", (changed) => { changed.certifiedDeployment.completion.schemaExpectedSha256 = "9".repeat(64); changed.certifiedDeployment.completion.schemaObservedSha256 = "9".repeat(64) }],
      ["function", (changed) => { changed.certifiedDeployment.completion.functionInventorySha256 = "9".repeat(64) }],
      ["deploy smoke", (changed) => { changed.certifiedDeployment.completion.hostedSmokeEvidenceSha256 = "9".repeat(64) }],
      ["manifest", (changed) => { changed.certifiedDeployment.completion.deploymentManifestSha256 = "9".repeat(64) }],
      ["reversed completion", (changed) => { changed.certifiedDeployment.completion.completedAt = "2026-08-12T19:49:59Z" }],
    ]
    for (const [name, mutate] of completionCases) {
      const changedSchema = structuredClone(schema)
      mutate(changedSchema)
      expect(() => buildEnvironmentManifest({ schema: changedSchema, functions, smoke, context }), name).toThrow("deployment-completion")
    }

    const tamperedSelf = structuredClone(valid)
    tamperedSelf.certifiedDeployment.certifiedManifest.manifestSha256 = "9".repeat(64)
    restoreManifestIntegrity(tamperedSelf)
    expect(verifyEnvironmentManifest(tamperedSelf).blockers).toContain("deployment-completion")

    const skeletal = structuredClone(valid)
    skeletal.certifiedDeployment.certifiedManifest = {
      contractVersion: "fundloop.environment-delivery-manifest/v1",
      environment: "dev", projectRef: schema.projectRef, observation: { mode: "deploy" },
      manifestSha256: schema.certifiedDeployment.completion.deploymentManifestSha256,
    }
    restoreManifestIntegrity(skeletal)
    expect(verifyEnvironmentManifest(skeletal).blockers).toContain("deployment-completion")

    const retainedManifestCases: Array<[string, (forged: any) => void]> = [
      ["wrong schema digest", (forged) => { forged.certifiedDeployment.certifiedManifest.schema.observedSha256 = "8".repeat(64) }],
      ["schema observation after completion", (forged) => { forged.certifiedDeployment.certifiedManifest.schema.observedAt = "2026-08-12T19:56:00Z"; forged.certifiedDeployment.certifiedManifest.observation.observedAt = "2026-08-12T19:56:00Z" }],
      ["inactive function", (forged) => { const certified = forged.certifiedDeployment.certifiedManifest; certified.functions.items[0].remoteStatus = "INACTIVE"; certified.functions.inventorySha256 = digest(certified.functions.items); forged.certifiedDeployment.completion.functionInventorySha256 = certified.functions.inventorySha256 }],
      ["mismatched migration history", (forged) => { forged.certifiedDeployment.certifiedManifest.migrations.observedHistory = ["20990101000000"] }],
      ["smoke checkout differs from deployment", (forged) => { const certified = forged.certifiedDeployment.certifiedManifest; certified.prerequisites.hostedUnauthenticatedDenial.evidence = buildSafeSmokeEvidence({ environment: "dev", projectRef: schema.projectRef, observationGitSha: "9".repeat(40), statusCode: 401, observedAt: deploySmoke.observedAt }); forged.certifiedDeployment.completion.hostedSmokeEvidenceSha256 = certified.prerequisites.hostedUnauthenticatedDenial.evidence.evidenceSha256 }],
    ]
    for (const [name, mutate] of retainedManifestCases) {
      const forged = structuredClone(valid)
      mutate(forged)
      restoreManifestIntegrity(forged.certifiedDeployment.certifiedManifest)
      forged.certifiedDeployment.completion.deploymentManifestSha256 = forged.certifiedDeployment.certifiedManifest.manifestSha256
      restoreManifestIntegrity(forged)
      expect(verifyEnvironmentManifest(forged).blockers, name).toContain("deployment-completion")
    }

    const sameShaSchema = { ...schema, candidateGitSha: deployContext.gitSha }
    const sameShaFunctions = { ...functions, candidateGitSha: deployContext.gitSha }
    const sameShaContext = { ...context, gitSha: deployContext.gitSha }
    expect(() => buildEnvironmentManifest({ schema: sameShaSchema, functions: sameShaFunctions, smoke: deploySmoke, context: sameShaContext })).toThrow("observation-smoke-not-fresh")
  })

  it("accepts deploy provenance only when deployment and observation are identical", () => {
    const localDeployContext = { ...context, gitSha: schema.certifiedDeployment.gitSha, githubRunId: schema.certifiedDeployment.githubRunId, githubRunAttempt: schema.certifiedDeployment.githubRunAttempt, mode: "deploy" }
    const { completion: _completion, ...deployCertifiedDeployment } = schema.certifiedDeployment
    delete deployCertifiedDeployment.certifiedManifest
    const localDeploySchema = { ...schema, candidateGitSha: localDeployContext.gitSha, certifiedDeployment: deployCertifiedDeployment }
    const localDeployFunctions = { ...functions, candidateGitSha: localDeployContext.gitSha }
    const localDeploySmoke = buildSafeSmokeEvidence({ environment: "dev", projectRef: schema.projectRef, observationGitSha: localDeployContext.gitSha, statusCode: 401, observedAt: "2026-08-12T19:59:00Z" })
    expect(verifyEnvironmentManifest(buildEnvironmentManifest({ schema: localDeploySchema, functions: localDeployFunctions, smoke: localDeploySmoke, context: localDeployContext }))).toEqual({ ok: true, blockers: [] })
  })

  it("requires semantic RFC3339 timestamps when building and independently verifying manifests", () => {
    for (const recordedAt of ["2026-08-12T18:28:57.708226+00:00", "2026-08-12T18:28:57Z"]) {
      const positiveSchema = { ...schema, observedAt: "2026-08-12T23:40:00Z", certifiedDeployment: withCertifiedChronology(schema, recordedAt, "2026-08-12T23:35:00Z").certifiedDeployment }
      const positiveFunctions = { ...functions, observedAt: "2026-08-12T23:45:00Z" }
      const positiveSmoke = buildSafeSmokeEvidence({ environment: "dev", projectRef: schema.projectRef, observationGitSha: context.gitSha, statusCode: 401, observedAt: "2026-08-12T23:50:00Z" })
      const manifest = buildEnvironmentManifest({ schema: positiveSchema, functions: positiveFunctions, smoke: positiveSmoke, context: { ...context, observedAt: "2026-08-13T00:00:00Z" } })
      expect(verifyEnvironmentManifest(manifest), recordedAt).toEqual({ ok: true, blockers: [] })
    }

    for (const recordedAt of ["0", "2026-04-31T23:59:59Z", "2026-08-12T23:28:57", "2026-12-31T24:00:00Z"]) {
      const invalidSchema = { ...schema, certifiedDeployment: { ...schema.certifiedDeployment, recordedAt } }
      expect(() => buildEnvironmentManifest({ schema: invalidSchema, functions, smoke, context }), recordedAt).toThrow("deployment-time")

      const selfConsistent = restoreManifestIntegrity(structuredClone(buildEnvironmentManifest({ schema, functions, smoke, context })))
      selfConsistent.certifiedDeployment.recordedAt = recordedAt
      restoreManifestIntegrity(selfConsistent)
      expect(verifyEnvironmentManifest(selfConsistent), recordedAt).toEqual({ ok: false, blockers: ["deployment-time"] })
    }
  })

  it("applies the same timestamp contract to observation and hosted-smoke evidence", () => {
    expect(() => buildEnvironmentManifest({ schema, functions, smoke, context: { ...context, observedAt: "2026-08-12T20:00:00" } })).toThrow("observation-time")
    const timezoneLessSmoke = buildSafeSmokeEvidence({ environment: "dev", projectRef: schema.projectRef, observationGitSha: context.gitSha, statusCode: 401, observedAt: "2026-08-12T19:59:00" })
    expect(() => buildEnvironmentManifest({ schema, functions, smoke: timezoneLessSmoke, context })).toThrow("runtime-smoke")
    expect(() => buildEnvironmentManifest({ schema: { ...schema, certifiedDeployment: { ...schema.certifiedDeployment, recordedAt: "2026-08-12T19:00:00-00:00" } }, functions, smoke, context })).toThrow("deployment-time")
  })

  it("binds every component to one checkout and exact deployment-to-observation chronology", () => {
    const valid = buildEnvironmentManifest({ schema, functions, smoke, context })
    expect(valid.schema).toMatchObject({ candidateGitSha: context.gitSha, observedAt: schema.observedAt })
    expect(valid.functions).toMatchObject({ candidateGitSha: context.gitSha, observedAt: functions.observedAt })

    expect(() => buildEnvironmentManifest({ schema: { ...schema, candidateGitSha: "9".repeat(40) }, functions, smoke, context })).toThrow("schema-observation-sha")
    expect(() => buildEnvironmentManifest({ schema, functions: { ...functions, candidateGitSha: "9".repeat(40) }, smoke, context })).toThrow("function-observation-sha")
    expect(() => buildEnvironmentManifest({ schema, functions, smoke: { ...smoke, observationGitSha: "9".repeat(40) }, context })).toThrow("hosted-smoke-observation-sha")
    expect(() => buildEnvironmentManifest({ schema: { ...schema, observedAt: "2026-08-12T18:00:00Z" }, functions, smoke, context })).toThrow("schema-before-deployment")
    expect(() => buildEnvironmentManifest({ schema, functions: { ...functions, observedAt: "2026-08-12T20:01:00Z" }, smoke, context })).toThrow("function-after-observation")
    const staleSmoke = buildSafeSmokeEvidence({ environment: "dev", projectRef: schema.projectRef, observationGitSha: context.gitSha, statusCode: 401, observedAt: "2026-08-12T18:00:00Z" })
    expect(() => buildEnvironmentManifest({ schema, functions, smoke: staleSmoke, context })).toThrow("hosted-smoke-before-deployment")
  })

  it("orders accepted fractional timestamps without millisecond truncation", () => {
    const preciseContext = { ...context, observedAt: "2026-08-12T20:00:00.000001Z" }
    const preciseSchema = { ...schema, observedAt: "2026-08-12T20:00:00.000001Z", certifiedDeployment: { ...schema.certifiedDeployment, recordedAt: "2026-08-12T20:00:00.000999Z" } }
    const preciseFunctions = { ...functions, observedAt: "2026-08-12T20:00:00.000001Z" }
    const preciseSmoke = buildSafeSmokeEvidence({ environment: "dev", projectRef: schema.projectRef, observationGitSha: context.gitSha, statusCode: 401, observedAt: "2026-08-12T20:00:00.000001Z" })
    expect(() => buildEnvironmentManifest({ schema: preciseSchema, functions: preciseFunctions, smoke: preciseSmoke, context: preciseContext })).toThrow("deployment-after-observation")

    const equalSchema = { ...schema, observedAt: preciseContext.observedAt, certifiedDeployment: { ...schema.certifiedDeployment, completion: { ...schema.certifiedDeployment.completion, completedAt: preciseContext.observedAt } } }
    expect(verifyEnvironmentManifest(buildEnvironmentManifest({ schema: equalSchema, functions: preciseFunctions, smoke: preciseSmoke, context: preciseContext }))).toEqual({ ok: true, blockers: [] })
  })

  it("independently rejects digest-consistent component provenance forgeries", () => {
    const base = buildEnvironmentManifest({ schema, functions, smoke, context })
    const cases: Array<[string, (manifest: any) => void, string]> = [
      ["schema checkout", (manifest) => { manifest.schema.candidateGitSha = "9".repeat(40) }, "schema-observation-sha"],
      ["function checkout", (manifest) => { manifest.functions.candidateGitSha = "9".repeat(40); manifest.observation.functionCandidateGitSha = "9".repeat(40) }, "function-observation-sha"],
      ["hosted-smoke checkout", (manifest) => { manifest.prerequisites.hostedUnauthenticatedDenial.evidence = buildSafeSmokeEvidence({ environment: "dev", projectRef: schema.projectRef, observationGitSha: "9".repeat(40), statusCode: 401, observedAt: smoke.observedAt }) }, "hosted-smoke-observation-sha"],
      ["schema predates deployment", (manifest) => { manifest.schema.observedAt = "2026-08-12T18:00:00Z" }, "schema-before-deployment"],
      ["function follows observation", (manifest) => { manifest.functions.observedAt = "2026-08-12T20:00:00.000001Z" }, "function-after-observation"],
      ["smoke predates deployment", (manifest) => { manifest.prerequisites.hostedUnauthenticatedDenial.evidence = buildSafeSmokeEvidence({ environment: "dev", projectRef: schema.projectRef, observationGitSha: context.gitSha, statusCode: 401, observedAt: "2026-08-12T18:00:00Z" }) }, "hosted-smoke-before-deployment"],
      ["microsecond reversal", (manifest) => { manifest.certifiedDeployment.recordedAt = "2026-08-12T20:00:00.000999Z"; manifest.schema.observedAt = "2026-08-12T20:00:00.000001Z"; manifest.functions.observedAt = "2026-08-12T20:00:00.000001Z"; manifest.prerequisites.hostedUnauthenticatedDenial.evidence = buildSafeSmokeEvidence({ environment: "dev", projectRef: schema.projectRef, observationGitSha: context.gitSha, statusCode: 401, observedAt: "2026-08-12T20:00:00.000001Z" }); manifest.observation.observedAt = "2026-08-12T20:00:00.000001Z" }, "deployment-after-observation"],
      ["unknown deployment offset", (manifest) => { manifest.certifiedDeployment.recordedAt = "2026-08-12T19:00:00-00:00" }, "deployment-time"],
    ]
    for (const [name, mutate, blocker] of cases) {
      const forged = structuredClone(base)
      mutate(forged)
      restoreManifestIntegrity(forged)
      expect(verifyEnvironmentManifest(forged).blockers, name).toContain(blocker)
    }
  })

  it("fails precisely for changed, reordered, missing, stale, and enabled assets", () => {
    const manifest = buildEnvironmentManifest({ schema, functions, smoke, context })
    const cases: Array<[string, (changed: any) => void, string]> = [
      ["schema", (changed) => { changed.schema.observedSha256 = "0".repeat(64) }, "schema-digest"],
      ["migration order", (changed) => { changed.migrations.observedHistory = ["wrong"] }, "migration-order"],
      ["function source", (changed) => { changed.functions.items[0].observedSourceSha256 = "0".repeat(64) }, "function-source:function-00"],
      ["function missing", (changed) => { changed.functions.items.pop() }, "function-count"],
      ["inactive", (changed) => { changed.functions.items[0].remoteStatus = "INACTIVE" }, "function-status:function-00"],
      ["value flow", (changed) => { changed.runtimeControls.productionValueFlowEnabledCount = 1 }, "value-flow-enabled"],
      ["runtime smoke", (changed) => { changed.prerequisites.hostedUnauthenticatedDenial.evidence.unauthenticatedStatusCode = 200 }, "runtime-smoke"],
      ["migration digest", (changed) => { changed.migrations.inventorySha256 = "0".repeat(64) }, "migration-digest"],
      ["migration duplicate", (changed) => { changed.migrations.orderedInventory.push(structuredClone(changed.migrations.orderedInventory[0])); changed.migrations.observedHistory.push(migration.version) }, "migration-duplicate"],
      ["migration bytes", (changed) => { changed.migrations.orderedInventory[0].fileSha256 = "0".repeat(64) }, "migration-digest"],
      ["schema format", (changed) => { changed.schema.expectedSha256 = "invalid"; changed.schema.observedSha256 = "invalid" }, "schema-contract"],
      ["environment", (changed) => { changed.certifiedDeployment.environment = "main" }, "deployment-binding"],
      ["project", (changed) => { changed.certifiedDeployment.projectRef = "b".repeat(20) }, "deployment-binding"],
      ["deployment time", (changed) => { changed.certifiedDeployment.recordedAt = "2026-08-12T21:00:00Z" }, "deployment-after-observation"],
      ["deployment run", (changed) => { changed.certifiedDeployment.githubRunAttempt = 0 }, "deployment-run"],
      ["observation sha", (changed) => { changed.observation.functionCandidateGitSha = "3".repeat(40) }, "function-observation-sha"],
      ["trigger", (changed) => { changed.observation.trigger = "unknown" }, "observation-trigger"],
      ["function duplicate", (changed) => { changed.functions.items[1].name = changed.functions.items[0].name }, "function-duplicate"],
      ["function order", (changed) => { changed.functions.items.reverse() }, "function-order"],
      ["function digest", (changed) => { changed.functions.inventorySha256 = "0".repeat(64) }, "function-digest"],
      ["function version", (changed) => { changed.functions.items[0].remoteVersion = 0 }, "function-status:function-00"],
      ["prerequisite", (changed) => { changed.prerequisites.schemaParity.status = "failed" }, "prerequisite-status"],
      ["evidence", (changed) => { changed.evidence = [] }, "evidence"],
    ]
    for (const [, mutate, blocker] of cases) {
      const changed = structuredClone(manifest)
      mutate(changed)
      expect(verifyEnvironmentManifest(changed).blockers).toContain(blocker)
    }
  })

  it("runs after every push without path filters and never deploys or repairs", () => {
    const workflow = readFileSync(".github/workflows/supabase-drift.yml", "utf8")
    const deploy = readFileSync(".github/workflows/supabase-deploy.yml", "utf8")
    expect(workflow).toContain("schedule:")
    expect(workflow).toContain("workflow_dispatch:")
    expect(workflow).toContain("workflow_run:")
    expect(workflow).toContain("head_sha")
    expect(workflow).not.toContain("paths-ignore:")
    const pathBlocks = [...deploy.matchAll(/    paths:\n((?:      - \"[^\"]+\"\n)+)/g)]
    expect(pathBlocks).toHaveLength(2)
    for (const [, block] of pathBlocks) {
      const paths = [...block.matchAll(/      - \"([^\"]+)\"/g)].map((match) => match[1])
      expect(paths).toEqual(SUPABASE_DEPLOY_PATH_GLOBS)
    }
    expect(workflow).toContain("repository.full_name == github.repository")
    expect(workflow).toContain("github.event.workflow_run.event == 'push'")
    expect(workflow).toContain("group: supabase-${{ matrix.target }}")
    expect(workflow).not.toContain("group: supabase-drift-")
    expect(workflow).toContain("github.event_name == 'schedule' && 'dev'")
    expect(workflow).toContain("verify-supabase-schema-parity.mjs drift")
    expect(workflow).toContain("verify-supabase-function-parity.mjs postdeploy")
    expect(workflow).not.toContain("supabase db push")
    expect(workflow).not.toContain("supabase functions deploy")
    expect(workflow).toContain("SUPABASE_SCHEMA_DIAGNOSTIC_OUTPUT: ${{ runner.temp }}/supabase-schema-diagnostic.json")
    expect(workflow).toContain("project_ref=\"$(node scripts/resolve-supabase-pooler-target.mjs)\"")
    expect(workflow).toContain("main) db_url=\"${MAIN_SUPABASE_SESSION_POOLER_URL}\"")
    expect(workflow).toContain("SUPABASE_SCHEMA_DB_URL=\"${db_url}\" node scripts/verify-supabase-schema-parity.mjs drift")
    expect(workflow).not.toContain("TARGET_SUPABASE_SESSION_POOLER_URL")
    expect(workflow).not.toContain("echo \"db_url=${db_url}\" >> \"$GITHUB_OUTPUT\"")
    expect(workflow).not.toContain("steps.target.outputs.db_url")
    expect(workflow).not.toContain("::add-mask::")
    expect(workflow).toContain("if: ${{ always() }}")
    expect(workflow).toContain("${{ runner.temp }}/supabase-schema-diagnostic.json")
  })

  it("observes push deploys by branch but never infers a manual cross-target deploy", () => {
    const workflow = readFileSync(".github/workflows/supabase-drift.yml", "utf8")
    expect(workflow).toContain("github.event.workflow_run.head_branch || github.ref_name")
    expect(workflow).toContain("github.event.workflow_run.event == 'push'")
    expect(workflow).not.toContain("github.event.workflow_run.event == 'workflow_dispatch'")
    expect(workflow).toContain("inputs.target_environment")
    expect(workflow).toContain("options: [dev, main]")
  })

  it("selects exact pooler credentials and rejects hostile connection targets", () => {
    const ref = "a".repeat(20)
    const dev = `postgresql://postgres.${ref}:p%40ss%3Aword@aws-0-ca-central-1.pooler.supabase.com:5432/postgres`
    const main = `postgres://postgres.${"b".repeat(20)}:main-secret@aws-0-ca-central-1.pooler.supabase.com:5432/postgres`
    expect(resolveSupabasePoolerTarget("dev", { dev, main })).toEqual({ projectRef: ref, url: dev })
    expect(resolveSupabasePoolerTarget("main", { dev, main }).projectRef).toBe("b".repeat(20))
    expect(() => resolveSupabasePoolerTarget("main", { dev, main: "" })).toThrow("missing-main-pooler-credential")
    for (const hostile of [
      `https://postgres.${ref}:secret@aws-0-ca-central-1.pooler.supabase.com:5432/postgres`,
      `postgresql://postgres.${ref}:secret@evil.example:5432/postgres`,
      `postgresql://postgres.${ref}:secret@pooler.supabase.com.evil.example:5432/postgres`,
      `postgresql://postgres.${ref}:secret@aws-0-ca-central-1.pooler.supabase.com:6543/postgres`,
      `postgresql://postgres.${ref}:secret@aws-0-ca-central-1.pooler.supabase.com:5432/other`,
      `postgresql://postgres.${ref}@aws-0-ca-central-1.pooler.supabase.com:5432/postgres`,
    ]) expect(() => resolveSupabasePoolerTarget("dev", { dev: hostile, main })).toThrow()
  })

  it("assigns every reviewed Edge Function closure member to the deploy lane", () => {
    const closureFiles = new Set(expectedFunctionNames().flatMap((name) => expectedSourceClosure(name)))
    expect(closureFiles.size).toBeGreaterThan(62)
    for (const file of closureFiles) expect(shouldObservePush([file]), file).toBe(false)
    for (const installInput of ["package.json", "pnpm-lock.yaml", "pnpm-workspace.yaml", "supabase/functions/deno.json", "supabase/config.toml"]) {
      expect(shouldObservePush([installInput]), installInput).toBe(false)
    }
  })

  it("assigns UI-only pushes directly and backend or mixed pushes to post-deploy observation", () => {
    expect(shouldObservePush(["app/en/page.tsx", "components/ui/button.tsx"])).toBe(true)
    expect(shouldObservePush(["supabase/functions/example/index.ts"])).toBe(false)
    expect(shouldObservePush(["app/en/page.tsx", "lib/edge-functions/result.ts"])).toBe(false)
    expect(shouldObservePush([".github/workflows/supabase-drift.yml"])).toBe(false)
    expect(shouldObservePush(["scripts/classify-supabase-drift-push.mjs"])).toBe(false)
  })
})
