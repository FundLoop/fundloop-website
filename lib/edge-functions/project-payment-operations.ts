import { invokeBrowserEdgeCommand } from "./invoke"
import {
  normalizeProjectCryptoRoutesResult,
  normalizeProjectOnchainPaymentSubmissionRecordResult,
  PROJECT_CRYPTO_ROUTE_CREATE_FUNCTION,
  PROJECT_CRYPTO_ROUTE_ENABLED_SET_FUNCTION,
  PROJECT_CRYPTO_ROUTE_MOVE_FUNCTION,
  PROJECT_CRYPTO_ROUTE_UPDATE_FUNCTION,
  PROJECT_ONCHAIN_PAYMENT_SUBMISSION_RECORD_FUNCTION,
  type ProjectCryptoRouteCreateCommandInput,
  type ProjectCryptoRouteEnabledSetCommandInput,
  type ProjectCryptoRouteMoveCommandInput,
  type ProjectCryptoRouteUpdateCommandInput,
  type ProjectOnchainPaymentSubmissionRecordCommandInput,
} from "./project-payment-operations-contract"

export async function invokeProjectCryptoRouteCreateBrowser(input: ProjectCryptoRouteCreateCommandInput) {
  return normalizeProjectCryptoRoutesResult(
    PROJECT_CRYPTO_ROUTE_CREATE_FUNCTION,
    await invokeBrowserEdgeCommand<ProjectCryptoRouteCreateCommandInput, unknown>(PROJECT_CRYPTO_ROUTE_CREATE_FUNCTION, input),
  )
}

export async function invokeProjectCryptoRouteUpdateBrowser(input: ProjectCryptoRouteUpdateCommandInput) {
  return normalizeProjectCryptoRoutesResult(
    PROJECT_CRYPTO_ROUTE_UPDATE_FUNCTION,
    await invokeBrowserEdgeCommand<ProjectCryptoRouteUpdateCommandInput, unknown>(PROJECT_CRYPTO_ROUTE_UPDATE_FUNCTION, input),
  )
}

export async function invokeProjectCryptoRouteMoveBrowser(input: ProjectCryptoRouteMoveCommandInput) {
  return normalizeProjectCryptoRoutesResult(
    PROJECT_CRYPTO_ROUTE_MOVE_FUNCTION,
    await invokeBrowserEdgeCommand<ProjectCryptoRouteMoveCommandInput, unknown>(PROJECT_CRYPTO_ROUTE_MOVE_FUNCTION, input),
  )
}

export async function invokeProjectCryptoRouteEnabledSetBrowser(input: ProjectCryptoRouteEnabledSetCommandInput) {
  return normalizeProjectCryptoRoutesResult(
    PROJECT_CRYPTO_ROUTE_ENABLED_SET_FUNCTION,
    await invokeBrowserEdgeCommand<ProjectCryptoRouteEnabledSetCommandInput, unknown>(
      PROJECT_CRYPTO_ROUTE_ENABLED_SET_FUNCTION,
      input,
    ),
  )
}

export async function invokeProjectOnchainPaymentSubmissionRecordBrowser(
  input: ProjectOnchainPaymentSubmissionRecordCommandInput,
) {
  return normalizeProjectOnchainPaymentSubmissionRecordResult(
    await invokeBrowserEdgeCommand<ProjectOnchainPaymentSubmissionRecordCommandInput, unknown>(
      PROJECT_ONCHAIN_PAYMENT_SUBMISSION_RECORD_FUNCTION,
      input,
    ),
  )
}
