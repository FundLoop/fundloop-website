import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { classifyFunctionInventory, expectedFunctionNames } from "../scripts/verify-supabase-function-parity.mjs"
import { normalizePublicSchema } from "../scripts/verify-supabase-schema-parity.mjs"

const workflow = readFileSync(".github/workflows/supabase-deploy.yml", "utf8")
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

  it("normalizes only pg_dump session noise while retaining schema statements", () => {
    expect(normalizePublicSchema("-- header\n\\restrict token\nSET statement_timeout = 0;\nCREATE TABLE public.example ();\n\\unrestrict token\n")).toBe("CREATE TABLE public.example ();")
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
  })

  it("keeps the Edge reconciliation observer inside the application source boundary", () => {
    const edgeObserver = readFileSync("lib/onchain/base-intake-v2-observer.mjs", "utf8")
    const contractObserver = readFileSync("contracts/lib/base-intake-v2-observer.js", "utf8")
    expect(edgeObserver).toContain("export async function observeBaseIntakeV2Receipt")
    expect(edgeObserver).not.toContain("contracts/lib")
    expect(contractObserver).toContain('../../lib/onchain/base-intake-v2-observer.mjs')
  })
})
