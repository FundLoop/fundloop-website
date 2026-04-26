import "server-only"

import { invokeServerEdgeCommand } from "./invoke-server"
import {
  ADMIN_ONCHAIN_PAYMENT_RECONCILIATION_RUN_FUNCTION,
  ADMIN_PAYMENT_RECEIPT_CONFIRM_FUNCTION,
  normalizeAdminOnchainPaymentReconciliationRunResult,
  normalizeAdminPaymentReceiptConfirmResult,
  type AdminOnchainPaymentReconciliationRunCommandInput,
  type AdminPaymentReceiptConfirmCommandInput,
} from "./admin-payment-operations-contract"

export async function invokeAdminPaymentReceiptConfirmServer(input: AdminPaymentReceiptConfirmCommandInput) {
  return normalizeAdminPaymentReceiptConfirmResult(
    await invokeServerEdgeCommand<AdminPaymentReceiptConfirmCommandInput, unknown>(ADMIN_PAYMENT_RECEIPT_CONFIRM_FUNCTION, input),
  )
}

export async function invokeAdminOnchainPaymentReconciliationRunServer(
  input: AdminOnchainPaymentReconciliationRunCommandInput,
) {
  return normalizeAdminOnchainPaymentReconciliationRunResult(
    await invokeServerEdgeCommand<AdminOnchainPaymentReconciliationRunCommandInput, unknown>(
      ADMIN_ONCHAIN_PAYMENT_RECONCILIATION_RUN_FUNCTION,
      input,
    ),
  )
}
