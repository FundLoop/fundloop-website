import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import os from "node:os"
import path from "node:path"
import { describe, expect, it } from "vitest"
import { classifyFunctionInventory, compareClosurePaths, expectedFunctionNames, expectedSourceClosure } from "../scripts/verify-supabase-function-parity.mjs"
import { bindObservedMigrationDeployEvidence, buildMigrationDeployEvidence, buildSchemaDiagnostic, expectedMigrationInventory, isExplicitRfc3339Timestamp, libpqConnectionEnvironment, migrationInventorySha256, normalizePublicSchema, validateMatchingMigrationEvidence, validateMigrationDeployEvidence, validatePendingSchemaRepair } from "../scripts/verify-supabase-schema-parity.mjs"

const workflow = readFileSync(".github/workflows/supabase-deploy.yml", "utf8")
const schemaVerifier = readFileSync("scripts/verify-supabase-schema-parity.mjs", "utf8")
const retired = JSON.parse(readFileSync("supabase/retired-functions.json", "utf8"))
const repairManifest = JSON.parse(readFileSync("supabase/schema-repair-manifests/20260812_dev_public_schema_drift.json", "utf8"))

describe("Supabase delivery parity", () => {
  it("passes containerized libpq credentials as fields instead of an ambiguous URI", () => {
    expect(libpqConnectionEnvironment("postgresql://postgres.aaaaaaaaaaaaaaaaaaaa:p%40ss%3A%2F%24@aws-0-ca-central-1.pooler.supabase.com:5432/postgres")).toEqual({
      PGHOST: "aws-0-ca-central-1.pooler.supabase.com",
      PGPORT: "5432",
      PGUSER: "postgres.aaaaaaaaaaaaaaaaaaaa",
      PGPASSWORD: "p@ss:/$",
      PGDATABASE: "postgres",
      PGSSLMODE: "require",
    })
    expect(libpqConnectionEnvironment("postgresql://postgres:postgres@127.0.0.1:5432/postgres").PGSSLMODE).toBe("disable")
    expect(schemaVerifier).not.toContain('"psql", dbUrl')
    expect(schemaVerifier).not.toMatch(/run\("psql", \[(?:dbUrl|remoteDbUrl)/)
    expect(schemaVerifier).not.toContain('"--no-comments", dbUrl')
    expect(schemaVerifier).not.toContain('`PGPASSWORD=${')
  })
  it("derives the expected function inventory and records the one reviewed retirement", () => {
    const expected = expectedFunctionNames()
    expect(expected).toHaveLength(62)
    expect(expected).toContain("epoch-funded-allocation")
    expect(expected).toContain("epoch-allocation-close")
    expect(expected).not.toContain("monthly-cycle-payout-intents-create")
    expect(retired.functions).toEqual([
      expect.objectContaining({
        name: "monthly-cycle-payout-intents-create",
        environments: ["dev"],
        owner: expect.any(String),
        deleteAfter: expect.any(String),
        deletionCondition: expect.any(String),
      }),
    ])
  })

  it("permits only reviewed, due Dev retirements and rejects unexplained extras", () => {
    const expected = ["current"]
    expect(classifyFunctionInventory(expected, [{ name: "current" }, { name: "monthly-cycle-payout-intents-create" }], retired, "dev", Date.parse("2026-08-12T01:00:00Z"))).toEqual({
      missing: [],
      extras: ["monthly-cycle-payout-intents-create"],
      permittedRetirements: ["monthly-cycle-payout-intents-create"],
      unexplainedExtras: [],
    })
    expect(classifyFunctionInventory(expected, [{ name: "current" }, { name: "unknown" }], retired, "dev").unexplainedExtras).toEqual(["unknown"])
    expect(classifyFunctionInventory(expected, [{ name: "current" }, { name: "monthly-cycle-payout-intents-create" }], retired, "main").unexplainedExtras).toEqual(["monthly-cycle-payout-intents-create"])
  })

  it("implements the exact pg17-public-schema-normalized-v2 bytes", () => {
    expect(normalizePublicSchema("-- header\r\n\\restrict token\r\n\r\nSET statement_timeout = 0;   \r\nCREATE TABLE public.example (); \r\n\\unrestrict token\r\n"))
      .toBe("SET statement_timeout = 0;\nCREATE TABLE public.example ();\n")
    expect(normalizePublicSchema("CREATE TABLE public.example ();\n\n\n")).toBe("CREATE TABLE public.example ();\n")
    expect(normalizePublicSchema("CREATE POLICY example ON public.example FOR SELECT TO authenticated, anon USING (true);\n"))
      .toBe("CREATE POLICY example ON public.example FOR SELECT TO anon, authenticated USING (true);\n")
  })

  it("emits bounded, structural schema drift without remote DDL or unknown identifiers", () => {
    const expected = "-- Name: projects; Type: TABLE; Schema: public; Owner: -\nCREATE TABLE public.projects (id bigint);\n"
    const observed = `${expected.replace("id bigint", "id integer")}-- Name: projects person@example.com; Type: POLICY; Schema: public; Owner: -\nCREATE POLICY \"person@example.com\" ON public.projects USING (secret_check());\n`
    const diagnostic = buildSchemaDiagnostic(expected, observed, { candidateGitSha: "a".repeat(40) }, 1)
    expect(diagnostic.status).toBe("drift")
    expect(diagnostic.expectedObjectCount).toBe(1)
    expect(diagnostic.observedObjectCount).toBe(2)
    expect(diagnostic.objectDifferenceCount).toBe(2)
    expect(diagnostic.objectDifferences).toContainEqual(expect.objectContaining({
      status: "unexpected",
      objectType: "POLICY",
      reviewedParentObjectKey: "public.projects [TABLE]#1",
    }))
    expect(diagnostic.lineDifferences).toHaveLength(1)
    expect(diagnostic.lineDifferencesTruncated).toBe(true)
    const serialized = JSON.stringify(diagnostic)
    expect(serialized).toContain("public.projects [TABLE]#1")
    expect(serialized).not.toContain("person@example.com")
    expect(serialized).not.toContain("secret text")
    expect(serialized).not.toContain("CREATE TABLE")
  })

  it("accepts only the exact versioned Dev drift while its repair is the sole pending migration", () => {
    const baselineMigrations = expectedMigrationInventory().slice(0, -1)
    expect(migrationInventorySha256(baselineMigrations)).toBe(repairManifest.baselineMigrationInventorySha256)
    const diagnostic = {
      environment: repairManifest.environment,
      projectRef: repairManifest.projectRef,
      enabledProductionValueFlowControlCount: 0,
      baselineMigrationInventorySha256: repairManifest.baselineMigrationInventorySha256,
      legacyRepairSignature: {
        expectedSha256: repairManifest.expectedSha256,
        observedSha256: repairManifest.observedSha256,
        expectedNormalizedLineCount: repairManifest.expectedNormalizedLineCount,
        observedNormalizedLineCount: repairManifest.observedNormalizedLineCount,
        expectedObjectCount: repairManifest.expectedObjectCount,
        observedObjectCount: repairManifest.observedObjectCount,
        objectDifferences: structuredClone(repairManifest.objectDifferences),
      },
    }
    const observedVersions = Array.from({ length: repairManifest.baselineMigrationCount }, (_, index) => String(index).padStart(14, "0"))
    const expectedVersions = [...observedVersions, repairManifest.repairMigrationVersion]
    expect(validatePendingSchemaRepair(repairManifest, diagnostic, observedVersions, expectedVersions)).toBe(true)
    expect(validatePendingSchemaRepair(repairManifest, { ...diagnostic, legacyRepairSignature: { ...diagnostic.legacyRepairSignature, observedSha256: "0".repeat(64) } }, observedVersions, expectedVersions)).toBe(false)
    const changedBaseline = structuredClone(baselineMigrations)
    changedBaseline[0].fileSha256 = "0".repeat(64)
    expect(validatePendingSchemaRepair(repairManifest, { ...diagnostic, baselineMigrationInventorySha256: migrationInventorySha256(changedBaseline) }, observedVersions, expectedVersions)).toBe(false)
    expect(validatePendingSchemaRepair(repairManifest, { ...diagnostic, legacyRepairSignature: { ...diagnostic.legacyRepairSignature, objectDifferences: diagnostic.legacyRepairSignature.objectDifferences.slice(1) } }, observedVersions, expectedVersions)).toBe(false)
    expect(validatePendingSchemaRepair(repairManifest, diagnostic, observedVersions, [...expectedVersions, "20260812140000"])).toBe(false)
  })

  it("repairs only the exact catalog-bound Dev drift and keeps the unknown policy name opaque", () => {
    const migration = readFileSync("supabase/migrations/20260812130000_repair_dev_public_schema_drift.sql", "utf8")
    expect(migration).toContain("dev_public_schema_drift_precondition_failed")
    expect(migration).toContain("8355071b6c97ae9ab87905ec5fa9b19380272cb553a01609cd7ca9e18be26946")
    expect(migration).toContain("policy.roles = ARRAY['anon']::name[]")
    expect(migration).toContain("v_payment_roles = ARRAY['authenticated', 'anon']::name[]")
    expect(migration).toContain("IF v_exact_dev_drift IS NOT TRUE THEN")
    expect(migration).not.toContain("IF NOT v_exact_dev_drift THEN")
    expect(migration).toContain("month BETWEEN 1 AND 12")
    expect(migration).toContain("FROM pg_catalog.pg_policy policy")
    expect(migration).toContain("DROP POLICY %I ON public.cron_logs")
    expect(migration).not.toContain("Enable insert")
    expect(migration).not.toContain("Allow insert")
  })

  it("binds sorted reviewed migration bytes to candidate deployment evidence", () => {
    const root = mkdtempSync(path.join(os.tmpdir(), "fundloop-migrations-test-"))
    try {
      mkdirSync(path.join(root, "supabase/migrations"), { recursive: true })
      writeFileSync(path.join(root, "supabase/migrations/20260101000000_first.sql"), "select 1;\n")
      writeFileSync(path.join(root, "supabase/migrations/20260102000000_second.sql"), "select 2;\n")
      const input = { candidateGitSha: "a".repeat(40), actionsRunId: "42", runAttempt: "2", environment: "dev", projectRef: "a".repeat(20) }
      const evidence = buildMigrationDeployEvidence(input, root)
      expect(evidence.migrations.map(({ name }) => name)).toEqual(["20260101000000_first.sql", "20260102000000_second.sql"])
      expect(evidence.inventorySha256).toBe(migrationInventorySha256(evidence.migrations))
      expect(validateMigrationDeployEvidence(evidence, structuredClone(evidence))).toBe(true)
      expect(validateMigrationDeployEvidence(evidence, { ...structuredClone(evidence), candidateGitSha: "b".repeat(40) })).toBe(false)
      expect(validateMigrationDeployEvidence(evidence, { ...structuredClone(evidence), inventorySha256: "0".repeat(64) })).toBe(false)
      writeFileSync(path.join(root, "supabase/migrations/20260102000000_second.sql"), "select 3;\n")
      expect(buildMigrationDeployEvidence(input, root).inventorySha256).not.toBe(evidence.inventorySha256)
      writeFileSync(path.join(root, "supabase/migrations/20260101000000_duplicate.sql"), "select 4;\n")
      expect(() => expectedMigrationInventory(root)).toThrow("Duplicate migration version")
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it("independently rejects a forged latest deployment-evidence index", () => {
    const migrations = [{ version: "20260101000000", name: "20260101000000_first.sql", fileSha256: "a".repeat(64) }]
    const inventorySha256 = migrationInventorySha256(migrations)
    const binding = { environment: "dev", projectRef: "a".repeat(20) }
    const evidence = {
      contractVersion: "fundloop.migration-deploy-evidence/v1",
      candidateGitSha: "b".repeat(40),
      actionsRunId: "42",
      runAttempt: 1,
      ...binding,
      migrations,
      inventorySha256,
      recordedAt: "2026-08-12T19:00:00Z",
    }
    expect(validateMatchingMigrationEvidence(evidence, binding, inventorySha256)).toBe(true)
    const changed = structuredClone(evidence)
    changed.migrations[0].fileSha256 = "0".repeat(64)
    expect(validateMatchingMigrationEvidence(changed, binding, inventorySha256)).toBe(false)
    expect(validateMatchingMigrationEvidence({ ...evidence, environment: "main" }, binding, inventorySha256)).toBe(false)
  })

  it("preserves one validated immutable timestamp for deploy and drift provenance", () => {
    const expected = {
      contractVersion: "fundloop.migration-deploy-evidence/v1",
      candidateGitSha: "b".repeat(40), actionsRunId: "42", runAttempt: 1,
      environment: "dev", projectRef: "a".repeat(20),
      migrations: [{ version: "20260101000000", name: "20260101000000_first.sql", fileSha256: "a".repeat(64) }],
      inventorySha256: "",
    }
    expected.inventorySha256 = migrationInventorySha256(expected.migrations)
    const observed = { ...structuredClone(expected), recordedAt: "2026-08-12T23:28:57.708226+00:00" }
    const deployEvidence = bindObservedMigrationDeployEvidence(expected, observed)
    expect(deployEvidence.recordedAt).toBe(observed.recordedAt)
    expect(validateMatchingMigrationEvidence(observed, expected, expected.inventorySha256)).toBe(true)
    for (const recordedAt of ["0", "12", "2026-08-12", "2026-08-12 23:28:57+00:00", "2026-08-12T23:28:57", "2026-08-12T23:28:57+24:00", "2026-02-29T00:00:00Z", "2026-04-31T23:59:59Z", "2026-12-31T24:00:00Z"]) {
      expect(() => bindObservedMigrationDeployEvidence(expected, { ...observed, recordedAt }), recordedAt).toThrow("remote immutable row")
      expect(validateMatchingMigrationEvidence({ ...observed, recordedAt }, expected, expected.inventorySha256), recordedAt).toBe(false)
    }
    for (const recordedAt of ["2024-02-29T00:00:00Z", "2026-01-01T00:00:00Z", "2026-12-31T23:59:59.999999-23:59"]) {
      expect(bindObservedMigrationDeployEvidence(expected, { ...observed, recordedAt }).recordedAt, recordedAt).toBe(recordedAt)
      expect(validateMatchingMigrationEvidence({ ...observed, recordedAt }, expected, expected.inventorySha256), recordedAt).toBe(true)
    }
    expect(() => bindObservedMigrationDeployEvidence(expected, { ...observed, inventorySha256: "0".repeat(64) })).toThrow("remote immutable row")
  })

  it("requires explicit RFC3339 seconds and timezone for immutable timestamps", () => {
    for (const timestamp of [
      "2026-08-12T23:28:57.708226+00:00",
      "2026-08-12T23:28:57Z",
      "2026-08-12T19:28:57.1-04:00",
      "2024-02-29T00:00:00Z",
      "2026-12-31T23:59:59+23:59",
    ]) expect(isExplicitRfc3339Timestamp(timestamp), timestamp).toBe(true)

    for (const timestamp of [
      "0",
      "12",
      "2026-08-12",
      "2026-08-12 23:28:57+00:00",
      "2026-08-12T23:28:57",
      "2026-08-12T23:28Z",
      "2026-08-12T23:28:57+0000",
      "2026-08-12T23:28:57+24:00",
      "2026-08-12T23:28:57+00:60",
      "2026-02-29T00:00:00Z",
      "2026-04-31T23:59:59Z",
      "2026-12-31T24:00:00Z",
      "2026-12-31T23:60:00Z",
      "2026-12-31T23:59:60Z",
    ]) expect(isExplicitRfc3339Timestamp(timestamp), timestamp).toBe(false)
  })

  it("keeps candidate-bound migration evidence append-only and non-browser-readable", () => {
    const sql = readFileSync("supabase/migrations/20260812120000_supabase_deploy_migration_evidence.sql", "utf8")
    expect(sql).toContain("BEFORE UPDATE OR DELETE")
    expect(sql).toContain("supabase_deploy_migration_evidence_is_append_only")
    expect(sql).toContain("REVOKE ALL ON TABLE public.supabase_deploy_migration_evidence FROM anon, authenticated")
  })

  it("derives reviewed function closures independently and blocks missing or extra remote paths", () => {
    const closure = expectedSourceClosure("base-intake-v2-reconcile")
    expect(closure).toEqual([
      "lib/edge-functions/result.ts",
      "lib/onchain/base-intake-v2-contract.ts",
      "lib/onchain/base-intake-v2-observer.mjs",
      "supabase/functions/_shared/command-runtime.ts",
      "supabase/functions/base-intake-v2-reconcile/index.ts",
    ])
    expect(compareClosurePaths(closure, closure)).toEqual({ missingPaths: [], extraPaths: [] })
    expect(compareClosurePaths(closure, closure.slice(1)).missingPaths).toEqual(["lib/edge-functions/result.ts"])
    expect(compareClosurePaths(closure, [...closure, "unexpected.ts"]).extraPaths).toEqual(["unexpected.ts"])
  })

  it("deploys atomically with prune, verifies exact sources/schema, smokes Dev, and uploads evidence", () => {
    const predeployGuard = "node scripts/verify-supabase-function-parity.mjs predeploy"
    const confirmedPrune = "supabase functions deploy --project-ref \"$SUPABASE_PROJECT_REF\" --prune --jobs 1 --yes"
    const postdeployReadback = "node scripts/verify-supabase-function-parity.mjs postdeploy"

    expect(workflow).toContain("verify-supabase-schema-parity.mjs")
    expect(workflow).toContain("deno cache --no-check --frozen --config supabase/functions/deno.json")
    expect(workflow).toContain(predeployGuard)
    expect(workflow).toContain(confirmedPrune)
    expect(workflow).not.toContain("supabase functions deploy --project-ref \"$SUPABASE_PROJECT_REF\" --prune --jobs 1\n")
    expect(workflow).toContain(postdeployReadback)
    expect(workflow).toContain("SUPABASE_ACCESS_TOKEN: ${{ secrets.SUPABASE_ACCESS_TOKEN }}")
    expect(schemaVerifier).not.toContain("functions download")
    expect(workflow.indexOf(predeployGuard)).toBeLessThan(workflow.indexOf(confirmedPrune))
    expect(workflow.indexOf(confirmedPrune)).toBeLessThan(workflow.indexOf(postdeployReadback))
    expect(workflow).toContain("epoch-allocation-close")
    expect(workflow).toContain('status_code}" != "401"')
    expect(workflow).toContain("Record safe hosted runtime denial")
    expect(workflow.indexOf("Record safe hosted runtime denial")).toBeLessThan(workflow.indexOf("Publish immutable environment manifest"))
    expect(workflow).toContain("actions/upload-artifact@v4")
    expect(workflow).toContain("if: ${{ always() && steps.target.outputs.mode == 'deploy' }}")
    expect(workflow).toContain("if-no-files-found: warn")
    expect(workflow).toContain("verify-supabase-schema-parity.mjs diagnose")
    expect(workflow).toContain("supabase-schema-diagnostic-dev-${{ github.sha }}")
    expect(workflow).toContain("steps.target.outputs.mode == 'dry-run' && steps.target.outputs.target_environment == 'dev'")
    expect(workflow.indexOf("supabase db push --yes --include-all --db-url \"$supabase_db_url\" --dry-run")).toBeLessThan(workflow.indexOf("verify-supabase-schema-parity.mjs diagnose"))
    expect(workflow).toContain("supabase_deploy_migration_evidence")
    expect(workflow).toContain("verify-supabase-schema-parity.mjs prepare")
    expect(workflow.indexOf("Verify Edge Function module graph")).toBeLessThan(workflow.indexOf("Dry-run database migrations"))
    expect(workflow.indexOf("Verify Edge Function module graph")).toBeLessThan(workflow.indexOf("Deploy database migrations"))
    expect(schemaVerifier).toContain('"--no-comments"')
  })

  it("keeps the Edge reconciliation observer inside the application source boundary", () => {
    const edgeObserver = readFileSync("lib/onchain/base-intake-v2-observer.mjs", "utf8")
    const contractObserver = readFileSync("contracts/lib/base-intake-v2-observer.js", "utf8")
    expect(edgeObserver).toContain("export async function observeBaseIntakeV2Receipt")
    expect(edgeObserver).not.toContain("contracts/lib")
    expect(contractObserver).toContain('../../lib/onchain/base-intake-v2-observer.mjs')
  })
})
