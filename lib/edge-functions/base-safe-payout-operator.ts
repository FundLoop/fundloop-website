import { invokeBrowserEdgeCommand } from "./invoke"
import { BASE_SAFE_PAYOUT_OPERATOR_FUNCTION,type BaseSafePayoutOperatorInput } from "./base-safe-payout-contract"

export async function invokeBaseSafePayoutOperator(input:BaseSafePayoutOperatorInput){
  return invokeBrowserEdgeCommand<BaseSafePayoutOperatorInput,Record<string,unknown>>(BASE_SAFE_PAYOUT_OPERATOR_FUNCTION,input)
}
