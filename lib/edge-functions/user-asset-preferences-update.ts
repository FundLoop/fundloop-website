import { invokeBrowserEdgeCommand } from "./invoke"
import {
  normalizeUserAssetPreferencesUpdateResult,
  USER_ASSET_PREFERENCES_UPDATE_FUNCTION,
  type UserAssetPreferencesUpdateCommandInput,
} from "./user-asset-preferences-update-contract"

export async function invokeUserAssetPreferencesUpdateBrowser(input: UserAssetPreferencesUpdateCommandInput) {
  return normalizeUserAssetPreferencesUpdateResult(
    await invokeBrowserEdgeCommand<UserAssetPreferencesUpdateCommandInput, unknown>(USER_ASSET_PREFERENCES_UPDATE_FUNCTION, input),
  )
}
