import { edgeCommandFailure, edgeCommandSuccess } from "../edge-functions/result.ts"

const ADDRESS = /^0x[0-9a-f]{40}$/i
const HASH = /^0x[0-9a-f]{64}$/i
const EVIDENCE_HASH = /^[0-9a-f]{64}$/
const UINT = /^\d+$/
const ENVIRONMENTS = new Set(["local", "dev", "test"])
const SYMBOLS = new Set(["USDC", "USDT", "PYUSD"])

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value))
}

function validIso(value: unknown) {
  return typeof value === "string" && !Number.isNaN(Date.parse(value))
}

export function validateBaseIntakeReceiptCommand(value: unknown, environment: string) {
  if (!ENVIRONMENTS.has(environment)) return edgeCommandFailure("production_disabled", "Base intake V2 is unavailable in this environment.")
  if (!isObject(value)) return edgeCommandFailure("invalid_payload", "Expected an object.")
  const v = value
  const gross = typeof v.grossNativeAmount === "string" && UINT.test(v.grossNativeAmount) ? BigInt(v.grossNativeAmount) : BigInt(-1)
  const fee = typeof v.platformFeeNativeAmount === "string" && UINT.test(v.platformFeeNativeAmount) ? BigInt(v.platformFeeNativeAmount) : BigInt(-1)
  const net = typeof v.netEpochNativeAmount === "string" && UINT.test(v.netEpochNativeAmount) ? BigInt(v.netEpochNativeAmount) : BigInt(-1)
  const feeBps = Number(v.projectFeeBps)
  if (
    v.contractVersion !== "fundloop-base-intake-v2" || !Number.isInteger(v.chainId) ||
    !ADDRESS.test(String(v.contractAddress)) || !ADDRESS.test(String(v.platformTreasuryAddress)) ||
    !ADDRESS.test(String(v.epochTreasuryAddress)) || String(v.platformTreasuryAddress).toLowerCase() === String(v.epochTreasuryAddress).toLowerCase() ||
    !Number.isInteger(v.projectId) || Number(v.projectId) <= 0 || !Number.isInteger(v.accountingPeriodId) || Number(v.accountingPeriodId) <= 0 ||
    typeof v.providerEventId !== "string" || v.providerEventId.length === 0 || !HASH.test(String(v.txHash)) ||
    !HASH.test(String(v.receiptReference)) || !Number.isInteger(v.projectFeeVersion) || Number(v.projectFeeVersion) <= 0 ||
    !Number.isInteger(v.logIndex) || Number(v.logIndex) < 0 || !Number.isInteger(v.blockNumber) || Number(v.blockNumber) <= 0 ||
    !HASH.test(String(v.blockHash)) || !ADDRESS.test(String(v.senderAddress)) || !SYMBOLS.has(String(v.tokenSymbol)) ||
    !ADDRESS.test(String(v.tokenAddress)) || !Number.isInteger(feeBps) || feeBps < 0 || feeBps > 1000 ||
    gross <= BigInt(0) || fee < BigInt(0) || net < BigInt(0) || fee !== (gross * BigInt(feeBps)) / BigInt(10_000) || gross !== fee + net ||
    !EVIDENCE_HASH.test(String(v.evidenceHash)) || !validIso(v.observedAt)
  ) return edgeCommandFailure("invalid_payload", "Base intake receipt fields are invalid.")
  return edgeCommandSuccess(v)
}

export function validateBaseIntakeReconciliationCommand(value: unknown, environment: string) {
  if (!ENVIRONMENTS.has(environment)) return edgeCommandFailure("production_disabled", "Base intake V2 reconciliation is unavailable in this environment.")
  if (!isObject(value)) return edgeCommandFailure("invalid_payload", "Expected an object.")
  const v = value
  if (!Number.isInteger(v.receiptId) || Number(v.receiptId) <= 0 || Object.keys(v).some((key) => key !== "receiptId"))
    return edgeCommandFailure("invalid_payload", "Only receiptId may be supplied for trusted Base reconciliation.")
  return edgeCommandSuccess({ receiptId: Number(v.receiptId) })
}
