import { invokeBrowserEdgeCommand } from "./invoke"
import {
  MONTHLY_CYCLE_APPROVAL_FUNCTION,
  normalizeMonthlyCycleApprovalResult,
  type MonthlyCycleApprovalCommandInput,
} from "./monthly-cycle-approval-contract"

export async function invokeMonthlyCycleApprovalBrowser(input: MonthlyCycleApprovalCommandInput) {
  return normalizeMonthlyCycleApprovalResult(
    await invokeBrowserEdgeCommand<MonthlyCycleApprovalCommandInput, unknown>(MONTHLY_CYCLE_APPROVAL_FUNCTION, input),
  )
}
