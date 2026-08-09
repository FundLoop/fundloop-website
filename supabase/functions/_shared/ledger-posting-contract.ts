import {
  isNeutralLedgerRuntimeEnabled,
  LEDGER_POST_CONTRACT_VERSION,
  LEDGER_REVERSAL_CONTRACT_VERSION,
  type NeutralLedgerActorType,
  type NeutralLedgerPostingInput,
  validateNeutralLedgerPostings,
} from "../../../lib/accounting/neutral-ledger.ts"

type ContractFailure = { ok: false; error: { code: string; message: string } }
type ContractSuccess<T> = { ok: true; data: T }
type ContractResult<T> = ContractFailure | ContractSuccess<T>

type LedgerPostRequest = {
  contractVersion: typeof LEDGER_POST_CONTRACT_VERSION
  idempotencyKey: string
  transactionType: string
  periodKey: string
  effectiveAt: string
  evidenceHash: string
  financialReferenceKey?: string
  postings: NeutralLedgerPostingInput[]
}

type LedgerReversalRequest = {
  contractVersion: typeof LEDGER_REVERSAL_CONTRACT_VERSION
  idempotencyKey: string
  originalTransactionId: number
  periodKey: string
  effectiveAt: string
  evidenceHash: string
}

export type TrustedNeutralLedgerActor = { actorType: NeutralLedgerActorType; actorUserId?: string }
type TrustedCommand<T> = T & TrustedNeutralLedgerActor & { deploymentEnvironment: string }
const identifierPattern = /^[a-z][a-z0-9:_-]*$/
const idempotencyPattern = /^[a-zA-Z0-9:_-]{8,160}$/
const hashPattern = /^[0-9a-f]{64}$/

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null
}

function runtimeEnvironment(environment: Record<string, string | undefined>) {
  return (environment.FUNDLOOP_DEPLOYMENT_ENV ?? environment.NEXT_PUBLIC_FUNDLOOP_DEPLOYMENT_ENV ?? environment.VERCEL_ENV)?.trim().toLowerCase()
}

function commonValid(value: Record<string, unknown>) {
  return typeof value.idempotencyKey === "string" && idempotencyPattern.test(value.idempotencyKey) &&
    typeof value.periodKey === "string" && identifierPattern.test(value.periodKey) &&
    typeof value.effectiveAt === "string" && Number.isFinite(Date.parse(value.effectiveAt)) &&
    typeof value.evidenceHash === "string" && hashPattern.test(value.evidenceHash)
}

function disabled(): ContractFailure {
  return { ok: false, error: { code: "neutral_ledger_runtime_disabled", message: "Neutral ledger review posting is unavailable in this environment." } }
}

export function validateLedgerPostRequest(
  input: unknown,
  environment: Record<string, string | undefined>,
  trustedActor: TrustedNeutralLedgerActor,
): ContractResult<TrustedCommand<LedgerPostRequest>> {
  if (!isNeutralLedgerRuntimeEnabled(environment)) return disabled()
  const value = record(input)
  const deploymentEnvironment = runtimeEnvironment(environment)
  if (!value || !deploymentEnvironment || value.contractVersion !== LEDGER_POST_CONTRACT_VERSION || !commonValid(value) ||
    typeof value.transactionType !== "string" || !identifierPattern.test(value.transactionType) ||
    (value.financialReferenceKey !== undefined && (typeof value.financialReferenceKey !== "string" || !identifierPattern.test(value.financialReferenceKey))) ||
    !validateNeutralLedgerPostings(value.postings)) {
    return { ok: false, error: { code: "invalid_ledger_post_contract", message: "The neutral ledger posting request is invalid." } }
  }
  return { ok: true, data: {
    contractVersion: LEDGER_POST_CONTRACT_VERSION,
    idempotencyKey: value.idempotencyKey as string,
    transactionType: value.transactionType,
    periodKey: value.periodKey as string,
    effectiveAt: value.effectiveAt as string,
    evidenceHash: value.evidenceHash as string,
    actorType: trustedActor.actorType,
    ...(typeof value.financialReferenceKey === "string" ? { financialReferenceKey: value.financialReferenceKey } : {}),
    postings: value.postings,
    ...(trustedActor.actorUserId ? { actorUserId: trustedActor.actorUserId } : {}),
    deploymentEnvironment,
  } }
}

export function validateLedgerReversalRequest(
  input: unknown,
  environment: Record<string, string | undefined>,
  trustedActor: TrustedNeutralLedgerActor,
): ContractResult<TrustedCommand<LedgerReversalRequest>> {
  if (!isNeutralLedgerRuntimeEnabled(environment)) return disabled()
  const value = record(input)
  const deploymentEnvironment = runtimeEnvironment(environment)
  if (!value || !deploymentEnvironment || value.contractVersion !== LEDGER_REVERSAL_CONTRACT_VERSION || !commonValid(value) ||
    !Number.isSafeInteger(value.originalTransactionId) || Number(value.originalTransactionId) <= 0) {
    return { ok: false, error: { code: "invalid_ledger_reversal_contract", message: "The neutral ledger reversal request is invalid." } }
  }
  return { ok: true, data: {
    contractVersion: LEDGER_REVERSAL_CONTRACT_VERSION,
    idempotencyKey: value.idempotencyKey as string,
    originalTransactionId: Number(value.originalTransactionId),
    periodKey: value.periodKey as string,
    effectiveAt: value.effectiveAt as string,
    evidenceHash: value.evidenceHash as string,
    actorType: trustedActor.actorType,
    ...(trustedActor.actorUserId ? { actorUserId: trustedActor.actorUserId } : {}),
    deploymentEnvironment,
  } }
}
