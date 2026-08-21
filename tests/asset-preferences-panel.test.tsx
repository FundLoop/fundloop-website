import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { AssetPreferencesPanel } from "@/components/account/asset-preferences-panel"

const { refresh, invokeUserAssetPreferencesUpdateBrowser, toast } = vi.hoisted(() => ({
  refresh: vi.fn(),
  invokeUserAssetPreferencesUpdateBrowser: vi.fn(),
  toast: vi.fn(),
}))

vi.mock("@/i18n/navigation", () => ({
  useRouter: () => ({
    refresh,
  }),
}))

vi.mock("@/lib/edge-functions/user-asset-preferences-update", () => ({
  invokeUserAssetPreferencesUpdateBrowser,
}))

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast }),
}))

const labels = {
  tabTitle: "Asset priorities",
  title: "Future settlement asset priorities",
  description: "Choose the order.",
  defaultsBadge: "Defaults",
  customBadge: "Custom",
  planningNote: "These preferences guide future settlement planning.",
  rejectAllWarningTitle: "You are rejecting all project tokens.",
  rejectAllWarningBody: "That may delay settlement.",
  usingDefaultsTitle: "Using default priorities",
  usingDefaultsBody: "Stablecoin, fiat, then project tokens.",
  rank: "Rank",
  assetType: "Asset type",
  assetCode: "Asset code",
  projectId: "Project ID",
  projectIdPlaceholder: "Required for project tokens",
  accepted: "Accepted",
  acceptedHint: "Uncheck assets you do not want.",
  addStablecoin: "Add stablecoin",
  addFiat: "Add fiat",
  addProjectToken: "Add project token",
  moveUp: "Move up",
  moveDown: "Move down",
  remove: "Remove",
  resetDefaults: "Use defaults",
  save: "Save priorities",
  saving: "Saving...",
  validationTitle: "Check asset priorities",
  validationAssetCode: "Asset code is invalid.",
  validationProjectId: "Project ID is required.",
  successTitle: "Asset priorities saved",
  successDescription: "Future settlement priorities were updated.",
  failureTitle: "Could not save asset priorities",
  typeLabels: {
    stablecoin: "Stablecoin",
    fiat: "Fiat",
    project_token: "Project token",
  },
}

function renderPanel() {
  return render(
    <AssetPreferencesPanel
      preferences={[
        { id: 1, rank: 1, assetType: "stablecoin", assetCode: "USDC", projectId: null, accepted: true },
        { id: 2, rank: 2, assetType: "project_token", assetCode: "CIVIC", projectId: 7, accepted: false },
      ]}
      defaultPreferences={[
        { id: null, rank: 1, assetType: "stablecoin", assetCode: "USDC", projectId: null, accepted: true },
        { id: null, rank: 2, assetType: "fiat", assetCode: "USD", projectId: null, accepted: true },
      ]}
      hasCustomPreferences
      rejectsAllProjectTokens
      labels={labels}
    />,
  )
}

describe("AssetPreferencesPanel", () => {
  beforeEach(() => {
    refresh.mockReset()
    invokeUserAssetPreferencesUpdateBrowser.mockReset()
    toast.mockReset()
  })

  it("shows reject-all project token warning and saves ordered preferences through the browser adapter", async () => {
    invokeUserAssetPreferencesUpdateBrowser.mockResolvedValue({
      ok: true,
      data: {
        userId: "user-1",
        hasCustomPreferences: true,
        preferences: [
          { id: 2, rank: 1, assetType: "project_token", assetCode: "CIVIC", projectId: 7, accepted: false },
          { id: 1, rank: 2, assetType: "stablecoin", assetCode: "USDC", projectId: null, accepted: true },
        ],
        defaultPreferences: [],
        rejectsAllProjectTokens: true,
      },
    })

    renderPanel()
    expect(screen.getByText("You are rejecting all project tokens.")).toBeTruthy()
    fireEvent.click(screen.getAllByRole("button", { name: "Move up" })[1])
    fireEvent.click(screen.getByRole("button", { name: "Save priorities" }))

    await waitFor(() => {
      expect(invokeUserAssetPreferencesUpdateBrowser).toHaveBeenCalledWith({
        preferences: [
          { assetType: "project_token", assetCode: "CIVIC", projectId: 7, accepted: false },
          { assetType: "stablecoin", assetCode: "USDC", projectId: undefined, accepted: true },
        ],
        attemptId: expect.any(String),
      })
    })
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: "Asset priorities saved" }))
    expect(refresh).toHaveBeenCalledTimes(1)
  })

  it("restores default behavior by saving an empty preference list", async () => {
    invokeUserAssetPreferencesUpdateBrowser.mockResolvedValue({
      ok: true,
      data: {
        userId: "user-1",
        hasCustomPreferences: false,
        preferences: [],
        defaultPreferences: [
          { id: null, rank: 1, assetType: "stablecoin", assetCode: "USDC", projectId: null, accepted: true },
        ],
        rejectsAllProjectTokens: false,
      },
    })

    renderPanel()
    fireEvent.click(screen.getByRole("button", { name: "Use defaults" }))
    fireEvent.click(screen.getByRole("button", { name: "Save priorities" }))

    await waitFor(() => {
      expect(invokeUserAssetPreferencesUpdateBrowser).toHaveBeenCalledWith({ preferences: [], attemptId: expect.any(String) })
    })
  })
})
