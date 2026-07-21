import { describe, expect, it } from "vitest"
import { buildUserAssetPreferenceReadiness } from "@/lib/workspace/user-asset-preferences"

describe("buildUserAssetPreferenceReadiness", () => {
  it("returns default preference guidance when a user has no custom rows", () => {
    const readiness = buildUserAssetPreferenceReadiness({ userId: "user-1", rows: [] })

    expect(readiness).toMatchObject({
      userId: "user-1",
      hasCustomPreferences: false,
      rejectsAllProjectTokens: false,
      warningCodes: ["using_defaults"],
    })
    expect(readiness.defaultPreferences.map((preference) => preference.assetType)).toEqual(["stablecoin", "fiat", "project_token"])
  })

  it("sorts custom rows and warns when every project token is rejected", () => {
    const readiness = buildUserAssetPreferenceReadiness({
      userId: "user-1",
      rows: [
        { id: 2, rank: 2, asset_type: "project_token", asset_code: "CIVIC", project_id: 7, accepted: false },
        { id: 1, rank: 1, asset_type: "stablecoin", asset_code: "USDC", project_id: null, accepted: true },
      ],
    })

    expect(readiness.hasCustomPreferences).toBe(true)
    expect(readiness.preferences.map((preference) => preference.assetCode)).toEqual(["USDC", "CIVIC"])
    expect(readiness.rejectsAllProjectTokens).toBe(true)
    expect(readiness.warningCodes).toEqual(["rejects_all_project_tokens"])
  })
})
