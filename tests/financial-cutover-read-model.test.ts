import { readFileSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"
import { resolveFinancialCutoverReadMode } from "@/lib/financial-cutover/read-model"

const earningsWorkspaceSource = readFileSync(
  path.join(process.cwd(), "lib/workspace/user-earnings-workspace.ts"),
  "utf8",
)
const payoutOverviewSource = readFileSync(
  path.join(process.cwd(), "lib/monthly-cycles/monthly-cycle-payouts.ts"),
  "utf8",
)

describe("financial cutover read model", () => {
  it("selects canonical reads only for a fully active cutover", () => {
    expect(resolveFinancialCutoverReadMode({
      data: { active_run_id: 42, canonical_reads_enabled: true, legacy_writes_enabled: false },
      error: null,
    })).toBe("canonical")
    expect(resolveFinancialCutoverReadMode({
      data: { active_run_id: null, canonical_reads_enabled: false, legacy_writes_enabled: true },
      error: null,
    })).toBe("legacy")
  })

  it("fails closed when the singleton state cannot be verified", () => {
    expect(resolveFinancialCutoverReadMode({ data: null, error: null })).toBe("unavailable")
    expect(resolveFinancialCutoverReadMode({ data: null, error: { message: "offline" } })).toBe("unavailable")
    expect(resolveFinancialCutoverReadMode({
      data: { active_run_id: 42, canonical_reads_enabled: false, legacy_writes_enabled: false },
      error: null,
    })).toBe("unavailable")
    expect(resolveFinancialCutoverReadMode({
      data: { active_run_id: null, canonical_reads_enabled: true, legacy_writes_enabled: true },
      error: null,
    })).toBe("unavailable")
  })

  it("routes both reviewed server surfaces through the canonical compatibility view", () => {
    for (const source of [earningsWorkspaceSource, payoutOverviewSource]) {
      expect(source).toContain("readFinancialCutoverMode")
      expect(source).toContain("financial_cutover_canonical_credit_reads")
      expect(source).toContain('cutoverReadMode === "canonical"')
      expect(source).toContain('cutoverReadMode === "legacy"')
    }
    expect(earningsWorkspaceSource).toContain('.eq("user_id", user.id)')
    expect(earningsWorkspaceSource).toContain("Promise.resolve({ data: [] as CreditRow[], error: null })")
    expect(payoutOverviewSource).toContain("Promise.resolve({ data: [], error: null })")
  })
})
