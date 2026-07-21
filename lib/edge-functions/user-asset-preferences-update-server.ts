import { invokeServerEdgeCommand } from "./invoke-server"
import {
  normalizeUserAssetPreferencesUpdateResult,
  USER_ASSET_PREFERENCES_UPDATE_FUNCTION,
  type UserAssetPreferencesUpdateCommandInput,
} from "./user-asset-preferences-update-contract"

export async function invokeUserAssetPreferencesUpdateServer(input: UserAssetPreferencesUpdateCommandInput) {
  return normalizeUserAssetPreferencesUpdateResult(
    await invokeServerEdgeCommand<UserAssetPreferencesUpdateCommandInput, unknown>(USER_ASSET_PREFERENCES_UPDATE_FUNCTION, input),
  )
}
