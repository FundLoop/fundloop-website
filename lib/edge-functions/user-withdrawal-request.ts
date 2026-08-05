import { invokeBrowserEdgeCommand } from "./invoke"
import {
  normalizeUserWithdrawalRequestCreateResult,
  USER_WITHDRAWAL_REQUEST_CREATE_FUNCTION,
  type UserWithdrawalRequestCreateInput,
} from "./user-withdrawal-request-contract"

export async function invokeUserWithdrawalRequestCreate(input: UserWithdrawalRequestCreateInput) {
  return normalizeUserWithdrawalRequestCreateResult(
    await invokeBrowserEdgeCommand<UserWithdrawalRequestCreateInput, unknown>(USER_WITHDRAWAL_REQUEST_CREATE_FUNCTION, input),
  )
}
