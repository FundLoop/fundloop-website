import { invokeBrowserEdgeCommand } from "./invoke"
import {
  CUBID_IDENTITY_DISCONNECT_FUNCTION,
  normalizeCubidIdentityDisconnectResult,
  type CubidIdentityDisconnectInput,
} from "./cubid-identity-contract"

export async function invokeCubidIdentityDisconnectBrowser() {
  return normalizeCubidIdentityDisconnectResult(
    await invokeBrowserEdgeCommand<CubidIdentityDisconnectInput, unknown>(CUBID_IDENTITY_DISCONNECT_FUNCTION, {}),
  )
}
