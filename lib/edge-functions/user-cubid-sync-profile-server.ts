import "server-only"

import { invokeServerEdgeCommand } from "./invoke-server"
import { normalizeUserCubidSyncProfileResult } from "./user-cubid-sync-profile"
import {
  USER_CUBID_SYNC_PROFILE_FUNCTION,
  type UserCubidSyncProfileInput,
} from "./user-cubid-sync-profile-contract"

export async function invokeUserCubidSyncProfileServer(input: UserCubidSyncProfileInput = {}) {
  const result = await invokeServerEdgeCommand<UserCubidSyncProfileInput, unknown>(
    USER_CUBID_SYNC_PROFILE_FUNCTION,
    input,
  )

  return normalizeUserCubidSyncProfileResult(result)
}
