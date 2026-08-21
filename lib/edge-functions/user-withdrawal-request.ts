import { invokeBrowserEdgeCommand } from "./invoke"
import {
  normalizeUserWithdrawalRequestResult,
  USER_WITHDRAWAL_REQUEST_CREATE_FUNCTION,
  type UserWithdrawalRequestInput,
} from "./user-withdrawal-request-contract"

export async function invokeUserWithdrawalRequestCreate(input: UserWithdrawalRequestInput) {
  return normalizeUserWithdrawalRequestResult(
    await invokeBrowserEdgeCommand<UserWithdrawalRequestInput, unknown>(USER_WITHDRAWAL_REQUEST_CREATE_FUNCTION, input),
  )
}
