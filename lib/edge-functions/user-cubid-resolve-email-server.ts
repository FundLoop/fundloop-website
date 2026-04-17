import "server-only"

import { invokeServerEdgeCommand } from "./invoke-server"
import {
  USER_CUBID_RESOLVE_EMAIL_FUNCTION,
  type UserCubidResolveEmailInput,
} from "./user-cubid-resolve-email-contract"
import { normalizeUserCubidResolveEmailResult } from "./user-cubid-resolve-email"

export async function invokeUserCubidResolveEmailServer(input: UserCubidResolveEmailInput = {}) {
  const result = await invokeServerEdgeCommand<UserCubidResolveEmailInput, unknown>(
    USER_CUBID_RESOLVE_EMAIL_FUNCTION,
    input,
  )

  return normalizeUserCubidResolveEmailResult(result)
}
