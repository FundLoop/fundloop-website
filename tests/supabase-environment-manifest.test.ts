import { readFileSync } from "node:fs"
import { createHash } from "node:crypto"
import { describe, expect, it } from "vitest"
import { buildEnvironmentManifest, buildSafeSmokeEvidence, verifyEnvironmentManifest } from "../scripts/verify-supabase-environment-manifest.mjs"
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
const migrationDigest = createHash("sha256").update(stable([migration])).digest("hex")
const schema = {
  environment: "dev", projectRef: "a".repeat(20), algorithm: "pg17-public-schema-normalized-v2", postgresMajor: 17,
  expectedSha256: "d".repeat(64), observedSha256: "d".repeat(64), migrationInventorySha256: migrationDigest,
  migrationInventory: [migration], migrationHistory: [migration.version], enabledProductionValueFlowControlCount: 0,
  productionValueFlowControlTableCount: 4,
  certifiedDeployment: { gitSha: "1".repeat(40), githubRunId: "100", githubRunAttempt: 2, recordedAt: "2026-08-12T19:00:00Z", environment: "dev", projectRef: "a".repeat(20) },
}
const functions = { candidateGitSha: "2".repeat(40), environment: "dev", projectRef: "a".repeat(20), functions: Array.from({ length: 62 }, (_, index) => functionEntry(index)) }
const context = { gitSha: "2".repeat(40), githubRunId: "200", githubRunAttempt: 3, observedAt: "2026-08-12T20:00:00Z", trigger: "push", mode: "drift" }
const smoke = buildSafeSmokeEvidence({ environment: "dev", projectRef: "a".repeat(20), observationGitSha: context.gitSha, statusCode: 401, observedAt: "2026-08-12T19:59:00Z" })

describe("immutable Supabase environment manifests", () => {
  it("preserves distinct certified deployment and observation provenance", () => {
    const manifest = buildEnvironmentManifest({ schema, functions, smoke, context })
    expect(manifest.certifiedDeployment.gitSha).toBe("1".repeat(40))
    expect(manifest.observation.gitSha).toBe("2".repeat(40))
    expect(verifyEnvironmentManifest(manifest)).toEqual({ ok: true, blockers: [] })
  })

  it("accepts deploy provenance only when deployment and observation are identical", () => {
    const deployContext = { ...context, gitSha: schema.certifiedDeployment.gitSha, githubRunId: schema.certifiedDeployment.githubRunId, githubRunAttempt: schema.certifiedDeployment.githubRunAttempt, mode: "deploy" }
    const deployFunctions = { ...functions, candidateGitSha: deployContext.gitSha }
    const deploySmoke = buildSafeSmokeEvidence({ environment: "dev", projectRef: schema.projectRef, observationGitSha: deployContext.gitSha, statusCode: 401, observedAt: "2026-08-12T19:59:00Z" })
    expect(verifyEnvironmentManifest(buildEnvironmentManifest({ schema, functions: deployFunctions, smoke: deploySmoke, context: deployContext }))).toEqual({ ok: true, blockers: [] })
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
