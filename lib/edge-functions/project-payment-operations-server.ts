import "server-only"

import { invokeServerEdgeCommand } from "./invoke-server"
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

export async function invokeProjectCryptoRouteCreateServer(input: ProjectCryptoRouteCreateCommandInput) {
  return normalizeProjectCryptoRoutesResult(
    PROJECT_CRYPTO_ROUTE_CREATE_FUNCTION,
    await invokeServerEdgeCommand<ProjectCryptoRouteCreateCommandInput, unknown>(PROJECT_CRYPTO_ROUTE_CREATE_FUNCTION, input),
  )
}

export async function invokeProjectCryptoRouteUpdateServer(input: ProjectCryptoRouteUpdateCommandInput) {
  return normalizeProjectCryptoRoutesResult(
    PROJECT_CRYPTO_ROUTE_UPDATE_FUNCTION,
    await invokeServerEdgeCommand<ProjectCryptoRouteUpdateCommandInput, unknown>(PROJECT_CRYPTO_ROUTE_UPDATE_FUNCTION, input),
  )
}

export async function invokeProjectCryptoRouteMoveServer(input: ProjectCryptoRouteMoveCommandInput) {
  return normalizeProjectCryptoRoutesResult(
    PROJECT_CRYPTO_ROUTE_MOVE_FUNCTION,
    await invokeServerEdgeCommand<ProjectCryptoRouteMoveCommandInput, unknown>(PROJECT_CRYPTO_ROUTE_MOVE_FUNCTION, input),
  )
}

export async function invokeProjectCryptoRouteEnabledSetServer(input: ProjectCryptoRouteEnabledSetCommandInput) {
  return normalizeProjectCryptoRoutesResult(
    PROJECT_CRYPTO_ROUTE_ENABLED_SET_FUNCTION,
    await invokeServerEdgeCommand<ProjectCryptoRouteEnabledSetCommandInput, unknown>(
      PROJECT_CRYPTO_ROUTE_ENABLED_SET_FUNCTION,
      input,
    ),
  )
}

export async function invokeProjectOnchainPaymentSubmissionRecordServer(
  input: ProjectOnchainPaymentSubmissionRecordCommandInput,
) {
  return normalizeProjectOnchainPaymentSubmissionRecordResult(
    await invokeServerEdgeCommand<ProjectOnchainPaymentSubmissionRecordCommandInput, unknown>(
      PROJECT_ONCHAIN_PAYMENT_SUBMISSION_RECORD_FUNCTION,
      input,
    ),
  )
}
