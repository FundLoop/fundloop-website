import { invokeBrowserEdgeCommand } from "./invoke"
import {
  ADMIN_ONCHAIN_PAYMENT_RECONCILIATION_RUN_FUNCTION,
  ADMIN_PAYMENT_RECEIPT_CONFIRM_FUNCTION,
  normalizeAdminOnchainPaymentReconciliationRunResult,
  normalizeAdminPaymentReceiptConfirmResult,
  type AdminOnchainPaymentReconciliationRunCommandInput,
  type AdminPaymentReceiptConfirmCommandInput,
} from "./admin-payment-operations-contract"

export async function invokeAdminPaymentReceiptConfirmBrowser(input: AdminPaymentReceiptConfirmCommandInput) {
  return normalizeAdminPaymentReceiptConfirmResult(
    await invokeBrowserEdgeCommand<AdminPaymentReceiptConfirmCommandInput, unknown>(
      ADMIN_PAYMENT_RECEIPT_CONFIRM_FUNCTION,
      input,
    ),
  )
}

export async function invokeAdminOnchainPaymentReconciliationRunBrowser(
  input: AdminOnchainPaymentReconciliationRunCommandInput,
) {
  return normalizeAdminOnchainPaymentReconciliationRunResult(
    await invokeBrowserEdgeCommand<AdminOnchainPaymentReconciliationRunCommandInput, unknown>(
      ADMIN_ONCHAIN_PAYMENT_RECONCILIATION_RUN_FUNCTION,
      input,
    ),
  )
}
