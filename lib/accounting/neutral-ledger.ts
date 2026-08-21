export const LEDGER_POST_CONTRACT_VERSION = "ledger_post.v1" as const
export const LEDGER_REVERSAL_CONTRACT_VERSION = "ledger_reversal.v1" as const

export type NeutralLedgerSide = "debit" | "credit"
export type NeutralLedgerActorType = "operator" | "service" | "system"

export type NeutralLedgerPostingInput = {
  accountKey: string
  side: NeutralLedgerSide
  functionalUsdAmount: string
  assetKey?: string
  custodyKey?: string
  nativeAtomicAmount?: string
  fxUsdPerUnit?: string
  projectId?: number
  userId?: string
}

const identifierPattern = /^[a-z][a-z0-9:_-]*$/
const atomicAmountPattern = /^[1-9][0-9]{0,77}$/
const decimalAmountPattern = /^(?:0|[1-9][0-9]{0,19})(?:\.[0-9]{1,18})?$/
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function isNeutralLedgerRuntimeEnabled(environment: Record<string, string | undefined>) {
  const deploymentEnvironment = (
    environment.FUNDLOOP_DEPLOYMENT_ENV ??
    environment.NEXT_PUBLIC_FUNDLOOP_DEPLOYMENT_ENV ??
    environment.VERCEL_ENV
  )?.trim().toLowerCase()
  return deploymentEnvironment !== undefined && deploymentEnvironment !== "production" &&
    ["local", "development", "dev", "preview", "test"].includes(deploymentEnvironment)
}

export function validateNeutralLedgerPostings(postings: unknown): postings is NeutralLedgerPostingInput[] {
  if (!Array.isArray(postings) || postings.length < 2 || postings.length > 100) return false
  return postings.every((posting) => {
    if (!posting || typeof posting !== "object" || Array.isArray(posting)) return false
    const value = posting as Record<string, unknown>
    const nativeKeys = ["assetKey", "custodyKey", "nativeAtomicAmount", "fxUsdPerUnit"] as const
    const nativeCount = nativeKeys.filter((key) => value[key] !== undefined).length
    return typeof value.accountKey === "string" && identifierPattern.test(value.accountKey) &&
      (value.side === "debit" || value.side === "credit") &&
      typeof value.functionalUsdAmount === "string" && decimalAmountPattern.test(value.functionalUsdAmount) &&
      Number(value.functionalUsdAmount) > 0 && (nativeCount === 0 || nativeCount === nativeKeys.length) &&
      (nativeCount === 0 || (
        typeof value.assetKey === "string" && identifierPattern.test(value.assetKey) &&
        typeof value.custodyKey === "string" && identifierPattern.test(value.custodyKey) &&
        typeof value.nativeAtomicAmount === "string" && atomicAmountPattern.test(value.nativeAtomicAmount) &&
        typeof value.fxUsdPerUnit === "string" && decimalAmountPattern.test(value.fxUsdPerUnit) && Number(value.fxUsdPerUnit) > 0
      )) &&
      (value.projectId === undefined || (Number.isSafeInteger(value.projectId) && Number(value.projectId) > 0)) &&
      (value.userId === undefined || (typeof value.userId === "string" && uuidPattern.test(value.userId)))
  })
}
