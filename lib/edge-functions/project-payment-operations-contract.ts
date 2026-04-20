import type { Json } from "../../types/supabase"
import {
  type ManagedCryptoPaymentMethodSummary,
  type ProjectCryptoRouteCreateInput,
  type ProjectCryptoRouteEnabledSetInput,
  type ProjectCryptoRouteMoveInput,
  type ProjectCryptoRouteUpdateInput,
  type ProjectOnchainPaymentSubmissionRecordInput,
} from "../payments/project-payment-operations-command"
import { edgeCommandFailure, edgeCommandSuccess, type EdgeCommandResult } from "./result"

export const PROJECT_CRYPTO_ROUTE_CREATE_FUNCTION = "project-crypto-route-create"
export const PROJECT_CRYPTO_ROUTE_UPDATE_FUNCTION = "project-crypto-route-update"
export const PROJECT_CRYPTO_ROUTE_MOVE_FUNCTION = "project-crypto-route-move"
export const PROJECT_CRYPTO_ROUTE_ENABLED_SET_FUNCTION = "project-crypto-route-enabled-set"
export const PROJECT_ONCHAIN_PAYMENT_SUBMISSION_RECORD_FUNCTION = "project-onchain-payment-submission-record"

export type ProjectCryptoRouteCreateCommandInput = Omit<ProjectCryptoRouteCreateInput, "actorUserId">
export type ProjectCryptoRouteUpdateCommandInput = Omit<ProjectCryptoRouteUpdateInput, "actorUserId">
export type ProjectCryptoRouteMoveCommandInput = Omit<ProjectCryptoRouteMoveInput, "actorUserId">
export type ProjectCryptoRouteEnabledSetCommandInput = Omit<ProjectCryptoRouteEnabledSetInput, "actorUserId">
export type ProjectOnchainPaymentSubmissionRecordCommandInput = Omit<
  ProjectOnchainPaymentSubmissionRecordInput,
  "actorUserId" | "attemptId"
> & {
  attemptId?: string
}

export type ProjectCryptoRoutesCommandOutput = ManagedCryptoPaymentMethodSummary[]
export type ProjectOnchainPaymentSubmissionRecordOutput = { submissionId: number }

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value))
}

function readRequiredProjectSlug(input: Record<string, unknown>) {
  const projectSlug = typeof input.projectSlug === "string" ? input.projectSlug.trim() : ""
  if (!projectSlug) {
    return edgeCommandFailure("invalid_payload", "projectSlug is required.")
  }

  return edgeCommandSuccess(projectSlug)
}

function readPositiveInteger(input: Record<string, unknown>, key: string) {
  const value = input[key]
  if (!Number.isInteger(value) || (value as number) <= 0) {
    return edgeCommandFailure("invalid_payload", `${key} must be a positive integer.`)
  }

  return edgeCommandSuccess(value as number)
}

function readString(input: Record<string, unknown>, key: string) {
  const value = input[key]
  if (typeof value !== "string" || !value.trim()) {
    return edgeCommandFailure("invalid_payload", `${key} must be a non-empty string.`)
  }

  return edgeCommandSuccess(value.trim())
}

function readOptionalAttemptId(input: Record<string, unknown>) {
  if (input.attemptId !== undefined && typeof input.attemptId !== "string") {
    return edgeCommandFailure("invalid_payload", "attemptId must be a string when provided.")
  }

  return edgeCommandSuccess(typeof input.attemptId === "string" && input.attemptId.trim() ? input.attemptId.trim() : undefined)
}

function readOptionalBlockNumber(input: Record<string, unknown>) {
  if (input.blockNumber === undefined || input.blockNumber === null) {
    return edgeCommandSuccess(null)
  }

  if (!Number.isInteger(input.blockNumber) || (input.blockNumber as number) < 0) {
    return edgeCommandFailure("invalid_payload", "blockNumber must be a non-negative integer when provided.")
  }

  return edgeCommandSuccess(input.blockNumber as number)
}

function readRouteReferences(input: Record<string, unknown>) {
  const chainId = readPositiveInteger(input, "chainId")
  if (!chainId.ok) return chainId
  const chainAssetId = readPositiveInteger(input, "chainAssetId")
  if (!chainAssetId.ok) return chainAssetId
  const intakeContractId = readPositiveInteger(input, "intakeContractId")
  if (!intakeContractId.ok) return intakeContractId

  return edgeCommandSuccess({
    chainId: chainId.data,
    chainAssetId: chainAssetId.data,
    intakeContractId: intakeContractId.data,
  })
}

function readRouteLabel(input: Record<string, unknown>) {
  if (input.label !== undefined && typeof input.label !== "string") {
    return edgeCommandFailure("invalid_payload", "label must be a string when provided.")
  }

  return edgeCommandSuccess(typeof input.label === "string" ? input.label : "")
}

export function validateProjectCryptoRouteCreateInput(
  input: unknown,
): EdgeCommandResult<ProjectCryptoRouteCreateCommandInput> {
  if (!isPlainObject(input)) {
    return edgeCommandFailure("invalid_payload", "Request body must be a JSON object.")
  }

  const projectSlug = readRequiredProjectSlug(input)
  if (!projectSlug.ok) return projectSlug
  const references = readRouteReferences(input)
  if (!references.ok) return references
  const label = readRouteLabel(input)
  if (!label.ok) return label

  if (input.isDefault !== undefined && typeof input.isDefault !== "boolean") {
    return edgeCommandFailure("invalid_payload", "isDefault must be a boolean when provided.")
  }

  return edgeCommandSuccess({
    projectSlug: projectSlug.data,
    ...references.data,
    label: label.data,
    isDefault: input.isDefault as boolean | undefined,
  })
}

export function validateProjectCryptoRouteUpdateInput(
  input: unknown,
): EdgeCommandResult<ProjectCryptoRouteUpdateCommandInput> {
  if (!isPlainObject(input)) {
    return edgeCommandFailure("invalid_payload", "Request body must be a JSON object.")
  }

  const projectSlug = readRequiredProjectSlug(input)
  if (!projectSlug.ok) return projectSlug
  const paymentMethodId = readPositiveInteger(input, "paymentMethodId")
  if (!paymentMethodId.ok) return paymentMethodId
  const references = readRouteReferences(input)
  if (!references.ok) return references
  const label = readRouteLabel(input)
  if (!label.ok) return label

  if (typeof input.isDefault !== "boolean") {
    return edgeCommandFailure("invalid_payload", "isDefault must be a boolean.")
  }

  return edgeCommandSuccess({
    projectSlug: projectSlug.data,
    paymentMethodId: paymentMethodId.data,
    ...references.data,
    label: label.data,
    isDefault: input.isDefault,
  })
}

export function validateProjectCryptoRouteMoveInput(input: unknown): EdgeCommandResult<ProjectCryptoRouteMoveCommandInput> {
  if (!isPlainObject(input)) {
    return edgeCommandFailure("invalid_payload", "Request body must be a JSON object.")
  }

  const projectSlug = readRequiredProjectSlug(input)
  if (!projectSlug.ok) return projectSlug
  const paymentMethodId = readPositiveInteger(input, "paymentMethodId")
  if (!paymentMethodId.ok) return paymentMethodId

  if (input.direction !== "up" && input.direction !== "down") {
    return edgeCommandFailure("invalid_payload", "direction must be up or down.")
  }

  return edgeCommandSuccess({
    projectSlug: projectSlug.data,
    paymentMethodId: paymentMethodId.data,
    direction: input.direction,
  })
}

export function validateProjectCryptoRouteEnabledSetInput(
  input: unknown,
): EdgeCommandResult<ProjectCryptoRouteEnabledSetCommandInput> {
  if (!isPlainObject(input)) {
    return edgeCommandFailure("invalid_payload", "Request body must be a JSON object.")
  }

  const projectSlug = readRequiredProjectSlug(input)
  if (!projectSlug.ok) return projectSlug
  const paymentMethodId = readPositiveInteger(input, "paymentMethodId")
  if (!paymentMethodId.ok) return paymentMethodId

  if (typeof input.enabled !== "boolean") {
    return edgeCommandFailure("invalid_payload", "enabled must be a boolean.")
  }

  return edgeCommandSuccess({
    projectSlug: projectSlug.data,
    paymentMethodId: paymentMethodId.data,
    enabled: input.enabled,
  })
}

export function validateProjectOnchainPaymentSubmissionRecordInput(
  input: unknown,
): EdgeCommandResult<ProjectOnchainPaymentSubmissionRecordCommandInput> {
  if (!isPlainObject(input)) {
    return edgeCommandFailure("invalid_payload", "Request body must be a JSON object.")
  }

  const projectSlug = readRequiredProjectSlug(input)
  if (!projectSlug.ok) return projectSlug
  const attemptId = readOptionalAttemptId(input)
  if (!attemptId.ok) return attemptId
  const paymentId = readPositiveInteger(input, "paymentId")
  if (!paymentId.ok) return paymentId
  const paymentMethodId = readPositiveInteger(input, "paymentMethodId")
  if (!paymentMethodId.ok) return paymentMethodId
  const references = readRouteReferences(input)
  if (!references.ok) return references
  const txHash = readString(input, "txHash")
  if (!txHash.ok) return txHash
  const walletAddress = readString(input, "walletAddress")
  if (!walletAddress.ok) return walletAddress
  const amountRaw = readString(input, "amountRaw")
  if (!amountRaw.ok) return amountRaw
  const amountDecimal = readString(input, "amountDecimal")
  if (!amountDecimal.ok) return amountDecimal
  const blockNumber = readOptionalBlockNumber(input)
  if (!blockNumber.ok) return blockNumber

  if (!Number.isInteger(input.periodId) || (input.periodId as number) < 0 || (input.periodId as number) > 12) {
    return edgeCommandFailure("invalid_payload", "periodId must be an integer from 0 through 12.")
  }

  if (input.receipt === undefined) {
    return edgeCommandFailure("invalid_payload", "receipt is required.")
  }

  return edgeCommandSuccess({
    projectSlug: projectSlug.data,
    attemptId: attemptId.data,
    paymentId: paymentId.data,
    paymentMethodId: paymentMethodId.data,
    txHash: txHash.data,
    walletAddress: walletAddress.data,
    amountRaw: amountRaw.data,
    amountDecimal: amountDecimal.data,
    periodId: input.periodId as number,
    ...references.data,
    blockNumber: blockNumber.data,
    receipt: input.receipt as Json,
  })
}

function isNullableString(value: unknown) {
  return value === null || typeof value === "string"
}

function isRouteOutput(value: unknown): value is ProjectCryptoRoutesCommandOutput {
  return (
    Array.isArray(value) &&
    value.every((route) => {
      if (!isPlainObject(route) || !isPlainObject(route.chain) || !isPlainObject(route.asset) || !isPlainObject(route.intakeContract)) {
        return false
      }

      return (
        typeof route.id === "number" &&
        isNullableString(route.label) &&
        typeof route.is_default === "boolean" &&
        typeof route.is_enabled === "boolean" &&
        typeof route.sort_order === "number" &&
        typeof route.is_runtime_available === "boolean" &&
        isNullableString(route.runtime_availability_issue) &&
        typeof route.chain.id === "number" &&
        typeof route.chain.display_name === "string" &&
        typeof route.chain.network_key === "string" &&
        typeof route.chain.evm_chain_id === "number" &&
        typeof route.chain.native_asset_symbol === "string" &&
        typeof route.chain.is_active === "boolean" &&
        typeof route.asset.id === "number" &&
        typeof route.asset.symbol === "string" &&
        typeof route.asset.name === "string" &&
        isNullableString(route.asset.token_address) &&
        typeof route.asset.decimals === "number" &&
        typeof route.asset.is_native === "boolean" &&
        typeof route.asset.is_stablecoin === "boolean" &&
        typeof route.asset.is_active === "boolean" &&
        typeof route.intakeContract.id === "number" &&
        typeof route.intakeContract.contract_address === "string" &&
        typeof route.intakeContract.treasury_address === "string" &&
        typeof route.intakeContract.abi_version === "string" &&
        typeof route.intakeContract.is_active === "boolean"
      )
    })
  )
}

function isReceiptRecordOutput(value: unknown): value is ProjectOnchainPaymentSubmissionRecordOutput {
  return isPlainObject(value) && typeof value.submissionId === "number"
}

export function normalizeProjectCryptoRoutesResult(
  functionName: string,
  result: EdgeCommandResult<unknown>,
): EdgeCommandResult<ProjectCryptoRoutesCommandOutput> {
  if (!result.ok) {
    return result
  }

  if (!isRouteOutput(result.data)) {
    return edgeCommandFailure("invalid_edge_response", `Edge Function ${functionName} returned an invalid route payload.`)
  }

  return edgeCommandSuccess(result.data)
}

export function normalizeProjectOnchainPaymentSubmissionRecordResult(
  result: EdgeCommandResult<unknown>,
): EdgeCommandResult<ProjectOnchainPaymentSubmissionRecordOutput> {
  if (!result.ok) {
    return result
  }

  if (!isReceiptRecordOutput(result.data)) {
    return edgeCommandFailure(
      "invalid_edge_response",
      `Edge Function ${PROJECT_ONCHAIN_PAYMENT_SUBMISSION_RECORD_FUNCTION} returned an invalid receipt payload.`,
    )
  }

  return edgeCommandSuccess(result.data)
}
