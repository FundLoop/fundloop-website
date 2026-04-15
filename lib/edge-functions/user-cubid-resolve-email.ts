import { invokeBrowserEdgeCommand } from "./invoke"
import {
  isUserCubidResolveEmailOutput,
  USER_CUBID_RESOLVE_EMAIL_FUNCTION,
  type UserCubidResolveEmailInput,
  type UserCubidResolveEmailOutput,
} from "./user-cubid-resolve-email-contract"
import { edgeCommandFailure, edgeCommandSuccess, type EdgeCommandResult } from "./result"

export function normalizeUserCubidResolveEmailResult(
  result: EdgeCommandResult<unknown>,
): EdgeCommandResult<UserCubidResolveEmailOutput> {
  if (!result.ok) {
    return result
  }

  if (!isUserCubidResolveEmailOutput(result.data)) {
    return edgeCommandFailure(
      "invalid_edge_response",
      `Edge Function ${USER_CUBID_RESOLVE_EMAIL_FUNCTION} returned an invalid response payload.`,
    )
  }

  return edgeCommandSuccess(result.data)
}

export async function invokeUserCubidResolveEmailBrowser(input: UserCubidResolveEmailInput = {}) {
  const result = await invokeBrowserEdgeCommand<UserCubidResolveEmailInput, unknown>(
    USER_CUBID_RESOLVE_EMAIL_FUNCTION,
    input,
  )

  return normalizeUserCubidResolveEmailResult(result)
}
