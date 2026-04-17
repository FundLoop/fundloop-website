import { invokeBrowserEdgeCommand } from "./invoke"
import {
  isUserCubidSyncProfileOutput,
  USER_CUBID_SYNC_PROFILE_FUNCTION,
  type UserCubidSyncProfileInput,
  type UserCubidSyncProfileOutput,
} from "./user-cubid-sync-profile-contract"
import { edgeCommandFailure, edgeCommandSuccess, type EdgeCommandResult } from "./result"

export function normalizeUserCubidSyncProfileResult(
  result: EdgeCommandResult<unknown>,
): EdgeCommandResult<UserCubidSyncProfileOutput> {
  if (!result.ok) {
    return result
  }

  if (!isUserCubidSyncProfileOutput(result.data)) {
    return edgeCommandFailure(
      "invalid_edge_response",
      `Edge Function ${USER_CUBID_SYNC_PROFILE_FUNCTION} returned an invalid response payload.`,
    )
  }

  return edgeCommandSuccess(result.data)
}

export async function invokeUserCubidSyncProfileBrowser(input: UserCubidSyncProfileInput = {}) {
  const result = await invokeBrowserEdgeCommand<UserCubidSyncProfileInput, unknown>(USER_CUBID_SYNC_PROFILE_FUNCTION, input)
  return normalizeUserCubidSyncProfileResult(result)
}
