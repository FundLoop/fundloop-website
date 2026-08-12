import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import os from "node:os"
import path from "node:path"
import { describe, expect, it } from "vitest"
import { classifyFunctionInventory, compareClosurePaths, expectedFunctionNames, expectedSourceClosure } from "../scripts/verify-supabase-function-parity.mjs"
import { buildMigrationDeployEvidence, expectedMigrationInventory, migrationInventorySha256, normalizePublicSchema, validateMigrationDeployEvidence } from "../scripts/verify-supabase-schema-parity.mjs"

const workflow = readFileSync(".github/workflows/supabase-deploy.yml", "utf8")
const schemaVerifier = readFileSync("scripts/verify-supabase-schema-parity.mjs", "utf8")
const retired = JSON.parse(readFileSync("supabase/retired-functions.json", "utf8"))

describe("Supabase delivery parity", () => {
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

  it("implements the exact pg17-public-schema-normalized-v1 bytes", () => {
    expect(normalizePublicSchema("-- header\r\n\\restrict token\r\n\r\nSET statement_timeout = 0;   \r\nCREATE TABLE public.example (); \r\n\\unrestrict token\r\n"))
      .toBe("SET statement_timeout = 0;\nCREATE TABLE public.example ();\n")
    expect(normalizePublicSchema("CREATE TABLE public.example ();\n\n\n")).toBe("CREATE TABLE public.example ();\n")
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
    expect(workflow).toContain("verify-supabase-schema-parity.mjs")
    expect(workflow).toContain("deno cache --no-check --frozen --config supabase/functions/deno.json")
    expect(workflow).toContain("verify-supabase-function-parity.mjs predeploy")
    expect(workflow).toContain("supabase functions deploy --project-ref \"$SUPABASE_PROJECT_REF\" --prune --jobs 1")
    expect(workflow).toContain("verify-supabase-function-parity.mjs postdeploy")
    expect(workflow).toContain("epoch-allocation-close")
    expect(workflow).toContain('status_code}" != "401"')
    expect(workflow).toContain("actions/upload-artifact@v4")
    expect(workflow).toContain("if: ${{ always() && steps.target.outputs.mode == 'deploy' }}")
    expect(workflow).toContain("if-no-files-found: warn")
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
