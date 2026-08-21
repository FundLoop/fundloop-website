import { describe, expect, it } from "vitest"
import { edgeCommandSuccess } from "@/lib/edge-functions/result"
import {
  buildDefaultAssetPreferenceSummaries,
  normalizeUserAssetPreferencesUpdateResult,
  validateUserAssetPreferencesUpdateInput,
} from "@/lib/edge-functions/user-asset-preferences-update-contract"

const validOutput = {
  userId: "user-1",
  hasCustomPreferences: true,
  preferences: [
    { id: 1, rank: 1, assetType: "stablecoin", assetCode: "USDC", projectId: null, accepted: true },
    { id: 2, rank: 2, assetType: "fiat", assetCode: "USD", projectId: null, accepted: true },
  ],
  defaultPreferences: buildDefaultAssetPreferenceSummaries(),
  rejectsAllProjectTokens: false,
}

describe("user asset preferences update contract", () => {
  it("normalizes ordered preferences for supported asset types", () => {
    expect(
      validateUserAssetPreferencesUpdateInput({
        preferences: [
          { assetType: "stablecoin", assetCode: "usdc", accepted: true },
          { assetType: "fiat", assetCode: "usd", accepted: true },
          { assetType: "project_token", assetCode: "civic", projectId: 7, accepted: false },
        ],
        attemptId: "attempt-1",
      }),
    ).toEqual({
      ok: true,
      data: {
        preferences: [
          { assetType: "stablecoin", assetCode: "USDC", accepted: true, projectId: undefined },
          { assetType: "fiat", assetCode: "USD", accepted: true, projectId: undefined },
          { assetType: "project_token", assetCode: "CIVIC", projectId: 7, accepted: false },
        ],
        attemptId: "attempt-1",
      },
    })
  })

  it("accepts an empty preference list to restore default behavior", () => {
    expect(validateUserAssetPreferencesUpdateInput({ preferences: [] })).toEqual({
      ok: true,
      data: { preferences: [], attemptId: undefined },
    })
    expect(buildDefaultAssetPreferenceSummaries().map((preference) => preference.assetType)).toEqual([
      "stablecoin",
      "fiat",
      "project_token",
    ])
  })

  it("rejects invalid project token and duplicate payloads", () => {
    expect(
      validateUserAssetPreferencesUpdateInput({ preferences: [{ assetType: "project_token", assetCode: "CIVIC", accepted: true }] })
        .ok,
    ).toBe(false)
    expect(
      validateUserAssetPreferencesUpdateInput({
        preferences: [
          { assetType: "stablecoin", assetCode: "USDC", accepted: true },
          { assetType: "stablecoin", assetCode: "USDC", accepted: false },
        ],
      }).ok,
    ).toBe(false)
  })

  it("normalizes invalid Edge responses", () => {
    expect(normalizeUserAssetPreferencesUpdateResult(edgeCommandSuccess(validOutput))).toEqual({ ok: true, data: validOutput })
    expect(normalizeUserAssetPreferencesUpdateResult(edgeCommandSuccess({ userId: "user-1" }))).toEqual({
      ok: false,
      error: {
        code: "invalid_edge_response",
        message: "user-asset-preferences-update returned an invalid response envelope.",
      },
    })
  })
})
