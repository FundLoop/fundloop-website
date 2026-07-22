import { beforeEach, describe, expect, it, vi } from "vitest"
import { buildDefaultAssetPreferenceSummaries } from "@/lib/edge-functions/user-asset-preferences-update-contract"

const invokeBrowserEdgeCommand = vi.fn()
const invokeServerEdgeCommand = vi.fn()

vi.mock("@/lib/edge-functions/invoke", () => ({
  invokeBrowserEdgeCommand,
}))

vi.mock("@/lib/edge-functions/invoke-server", () => ({
  invokeServerEdgeCommand,
}))

const validInput = {
  preferences: [{ assetType: "stablecoin" as const, assetCode: "USDC", accepted: true }],
}

const validOutput = {
  userId: "user-1",
  hasCustomPreferences: true,
  preferences: [{ id: 1, rank: 1, assetType: "stablecoin", assetCode: "USDC", projectId: null, accepted: true }],
  defaultPreferences: buildDefaultAssetPreferenceSummaries(),
  rejectsAllProjectTokens: false,
}

describe("user asset preference adapters", () => {
  beforeEach(() => {
    invokeBrowserEdgeCommand.mockReset()
    invokeServerEdgeCommand.mockReset()
  })

  it("normalizes browser adapter output", async () => {
    invokeBrowserEdgeCommand.mockResolvedValue({ ok: true, data: validOutput })

    const { invokeUserAssetPreferencesUpdateBrowser } = await import("@/lib/edge-functions/user-asset-preferences-update")

    await expect(invokeUserAssetPreferencesUpdateBrowser(validInput)).resolves.toEqual({ ok: true, data: validOutput })
  })

  it("normalizes invalid server adapter responses", async () => {
    invokeServerEdgeCommand.mockResolvedValue({ ok: true, data: { userId: "user-1" } })

    const { invokeUserAssetPreferencesUpdateServer } = await import("@/lib/edge-functions/user-asset-preferences-update-server")

    const result = await invokeUserAssetPreferencesUpdateServer(validInput)
    expect(result.ok).toBe(false)
    expect(result.ok ? null : result.error.code).toBe("invalid_edge_response")
  })
})
