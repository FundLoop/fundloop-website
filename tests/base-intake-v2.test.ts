import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { validateBaseIntakeReceiptCommand, validateBaseIntakeReconciliationCommand } from "@/lib/onchain/base-intake-v2-contract"
import { auditBaseIntakeV2Deployment, evaluateBaseIntakeV2Receipt } from "@/lib/onchain/base-intake-v2-runtime"

const receipt = {
  contractVersion: "fundloop-base-intake-v2", chainId: 31337,
  contractAddress: "0x0000000000000000000000000000000000000132",
  platformTreasuryAddress: "0x0000000000000000000000000000000000000201",
  epochTreasuryAddress: "0x0000000000000000000000000000000000000202",
  projectId: 101, accountingPeriodId: 1, providerEventId: "base:local:1",
  txHash: `0x${"a".repeat(64)}`, logIndex: 0, receiptReference: `0x${"d".repeat(64)}`,
  blockNumber: 100, blockHash: `0x${"b".repeat(64)}`,
  senderAddress: "0x0000000000000000000000000000000000000401", tokenSymbol: "USDC",
  tokenAddress: "0x0000000000000000000000000000000000000301", grossNativeAmount: "10000000",
  projectFeeBps: 250, projectFeeVersion: 1, platformFeeNativeAmount: "250000", netEpochNativeAmount: "9750000",
  evidenceHash: "c".repeat(64), observedAt: "2026-08-09T12:00:00Z",
}

describe("Base intake V2 command and reconciliation", () => {
  it.each(["local", "dev", "test"])("accepts exact conserved receipt in %s", (environment) => {
    expect(validateBaseIntakeReceiptCommand(receipt, environment)).toMatchObject({ ok: true })
  })
  it.each(["production", "preview", "staging", ""])("fails closed in %s", (environment) => {
    expect(validateBaseIntakeReceiptCommand(receipt, environment)).toMatchObject({ ok: false, error: { code: "production_disabled" } })
  })
  it("rejects arbitrary tokens, wrong fees, treasury aliasing, and malformed evidence", () => {
    for (const invalid of [
      { ...receipt, tokenSymbol: "DAI" }, { ...receipt, platformFeeNativeAmount: "249999" },
      { ...receipt, epochTreasuryAddress: receipt.platformTreasuryAddress }, { ...receipt, evidenceHash: "bad" },
      { ...receipt, receiptReference: "bad" }, { ...receipt, projectFeeVersion: 0 },
    ]) expect(validateBaseIntakeReceiptCommand(invalid, "local")).toMatchObject({ ok: false, error: { code: "invalid_payload" } })
  })
  it("accepts mixed-case EVM hex and rejects treasury aliases that differ only by case", () => {
    const mixedCase = { ...receipt,
      contractAddress: receipt.contractAddress.replace("132", "A32"),
      txHash: `0x${"aA".repeat(32)}`,
      blockHash: `0x${"bB".repeat(32)}`,
      senderAddress: "0x0000000000000000000000000000000000000Aa1" }
    expect(validateBaseIntakeReceiptCommand(mixedCase, "local")).toMatchObject({ ok: true })
    expect(validateBaseIntakeReceiptCommand({ ...receipt,
      platformTreasuryAddress: "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd",
      epochTreasuryAddress: "0xABCDEFABCDEFABCDEFABCDEFABCDEFABCDEFABCD" }, "local"))
      .toMatchObject({ ok: false, error: { code: "invalid_payload" } })
  })
  it("derives confirming, exact, mismatch, reorg and replacement without trusting a caller status", () => {
    const base = {
      receiptBlockNumber: BigInt(100), currentBlockNumber: BigInt(100), minimumConfirmationDepth: 2,
      receiptBlockHash: `0x${"b".repeat(64)}`, observedBlockHash: `0x${"b".repeat(64)}`,
      receiptTxHash: `0x${"a".repeat(64)}`, observedTxHash: `0x${"a".repeat(64)}`,
      expectedPlatformAmount: BigInt(250), expectedEpochAmount: BigInt(9750), observedPlatformAmount: BigInt(250), observedEpochAmount: BigInt(9750),
    }
    expect(evaluateBaseIntakeV2Receipt(base).status).toBe("confirming")
    expect(evaluateBaseIntakeV2Receipt({ ...base, currentBlockNumber: BigInt(101) }).status).toBe("exact")
    expect(evaluateBaseIntakeV2Receipt({ ...base, currentBlockNumber: BigInt(101), observedEpochAmount: BigInt(9749) }).status).toBe("mismatch")
    expect(evaluateBaseIntakeV2Receipt({ ...base, observedBlockHash: `0x${"d".repeat(64)}` }).status).toBe("reorged")
    expect(evaluateBaseIntakeV2Receipt({ ...base, replacementTxHash: `0x${"e".repeat(64)}` }).status).toBe("replaced")
    expect(evaluateBaseIntakeV2Receipt({ ...base, observedReceiptBlockNumber: BigInt(101), currentBlockNumber: BigInt(101) }).status).toBe("mismatch")
  })
  it("keeps the tracked deployment fail closed", () => {
    const deployment = {
      environment: "local", chainId: 31337, version: "fundloop-base-intake-v2", enabled: true, paused: false,
      providerEvidence: "local_fixture_only",
      contractAddress: receipt.contractAddress, platformTreasuryAddress: receipt.platformTreasuryAddress,
      epochTreasuryAddress: receipt.epochTreasuryAddress,
      tokens: { USDC: { address: receipt.tokenAddress, enabled: true }, USDT: { address: "0x0000000000000000000000000000000000000302", enabled: true }, PYUSD: { address: "0x0000000000000000000000000000000000000303", enabled: true } },
    }
    expect(auditBaseIntakeV2Deployment(deployment)).toMatchObject({ available: false, status: "disabled" })
    expect(auditBaseIntakeV2Deployment({ ...deployment, enabled: false })).toMatchObject({ available: false, status: "disabled" })
    expect(auditBaseIntakeV2Deployment({ ...deployment, paused: true })).toMatchObject({ available: false, status: "disabled" })
  })
  it("validates reconciliation evidence shape", () => {
    expect(validateBaseIntakeReconciliationCommand({ receiptId: 1 }, "local")).toEqual({ ok: true, data: { receiptId: 1 } })
    expect(validateBaseIntakeReconciliationCommand({ receiptId: 1, platformObservedNativeAmount: "250000" }, "local"))
      .toMatchObject({ ok: false, error: { code: "invalid_payload" } })
  })
  it("keeps both Edge commands behind an internal secret and typed RPC", () => {
    for (const path of ["supabase/functions/base-intake-v2-receipt-record/index.ts", "supabase/functions/base-intake-v2-reconcile/index.ts"]) {
      const source = readFileSync(path, "utf8")
      expect(source).toContain("authenticateRequestOrInternalSecret")
      expect(source).toContain("FUNDLOOP_BASE_INTAKE_SECRET")
      expect(source).toContain('auth.mode !== "internal_secret"')
      expect(source).not.toContain("console.log")
    }
    expect(readFileSync("supabase/functions/base-intake-v2-reconcile/index.ts", "utf8"))
      .toContain("Provisional receipt identity evidence is incomplete.")
  })
})
