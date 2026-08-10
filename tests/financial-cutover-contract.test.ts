import { describe, expect, it } from "vitest"
import { isFinancialCutoverEnvironmentEnabled, validateFinancialCutoverInput } from "@/lib/edge-functions/financial-cutover-contract"

describe("financial cutover contract", () => {
  it("accepts exact prepare, activate, rollback, and read commands", () => {
    expect(validateFinancialCutoverInput({ action: "prepare", idempotencyKey: "cutover-fixture-1", evidenceHash: "a".repeat(64),
      approvedOpeningBalances: [{ sourceType: "bookkeeping_credit", sourceId: "42", evidenceHash: "b".repeat(64) }] }).ok).toBe(true)
    expect(validateFinancialCutoverInput({ action: "activate", runId: 7, manifestHash: "c".repeat(64), evidenceHash: "d".repeat(64) }).ok).toBe(true)
    expect(validateFinancialCutoverInput({ action: "rollback", runId: 7, manifestHash: "c".repeat(64), evidenceHash: "e".repeat(64) }).ok).toBe(true)
    expect(validateFinancialCutoverInput({ action: "read", runId: 7 }).ok).toBe(true)
  })

  it("rejects duplicate approvals and caller-owned runtime or actor fields", () => {
    const approval = { sourceType: "bookkeeping_credit", sourceId: "42", evidenceHash: "b".repeat(64) }
    expect(validateFinancialCutoverInput({ action: "prepare", idempotencyKey: "cutover-fixture-1", evidenceHash: "a".repeat(64),
      approvedOpeningBalances: [approval, approval] }).ok).toBe(false)
    expect(validateFinancialCutoverInput({ action: "activate", runId: 7, manifestHash: "c".repeat(64), evidenceHash: "d".repeat(64),
      deploymentEnvironment: "local", actorUserId: "00000000-0000-4000-8000-000000000001" }).ok).toBe(false)
    expect(validateFinancialCutoverInput({ action: "prepare", idempotencyKey: "short", evidenceHash: "a".repeat(64), approvedOpeningBalances: [] }).ok).toBe(false)
  })

  it("uses an exact non-production allowlist", () => {
    expect(isFinancialCutoverEnvironmentEnabled("local")).toBe(true)
    expect(isFinancialCutoverEnvironmentEnabled("dev")).toBe(true)
    expect(isFinancialCutoverEnvironmentEnabled("test")).toBe(true)
    expect(isFinancialCutoverEnvironmentEnabled("production")).toBe(false)
    expect(isFinancialCutoverEnvironmentEnabled("staging")).toBe(false)
    expect(isFinancialCutoverEnvironmentEnabled(undefined)).toBe(false)
  })
})
