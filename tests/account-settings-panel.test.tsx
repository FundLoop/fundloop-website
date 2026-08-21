import React from "react"
import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { AccountSettingsPanel } from "@/components/account/account-settings-panel"

const translations: Record<string, string> = {
  identity: "CUBID Identity",
  profile: "Profile & Visibility",
  emails: "Email Addresses",
  wallets: "Wallet Addresses",
  assetPreferences: "Asset priorities",
  "panels.identity.title": "CUBID is now the identity authority for FundLoop",
  "panels.identity.manage": "Manage on CUBID Passport",
  "panels.identity.labels.unlinked": "Not linked yet",
  "panels.identity.labels.linked": "Linked",
  "panels.identity.labels.verified": "Verified",
  "panels.identity.refresh": "Refresh CUBID data",
  "panels.identity.completion": "Profile completion",
  "panels.profile.title": "FundLoop-managed profile",
  "panels.profile.description": "Profile description",
  "panels.profile.ownershipNote": "Ownership note",
  "panels.assetPreferences.title": "Future settlement asset priorities",
  "panels.assetPreferences.description": "Choose the asset order FundLoop should consider later.",
  "panels.assetPreferences.defaultsBadge": "Defaults",
  "panels.assetPreferences.customBadge": "Custom",
  "panels.assetPreferences.planningNote": "These preferences guide future settlement planning.",
  "panels.assetPreferences.rejectAllWarningTitle": "Project tokens rejected",
  "panels.assetPreferences.rejectAllWarningBody": "Rejecting project tokens may delay settlement.",
  "panels.assetPreferences.usingDefaultsTitle": "Using default priorities",
  "panels.assetPreferences.usingDefaultsBody": "Stablecoin, fiat, then project tokens.",
  "panels.assetPreferences.rank": "Rank",
  "panels.assetPreferences.assetType": "Asset type",
  "panels.assetPreferences.assetCode": "Asset code",
  "panels.assetPreferences.projectId": "Project ID",
  "panels.assetPreferences.projectIdPlaceholder": "Project ID",
  "panels.assetPreferences.accepted": "Accepted",
  "panels.assetPreferences.acceptedHint": "Uncheck assets you do not want.",
  "panels.assetPreferences.addStablecoin": "Add stablecoin",
  "panels.assetPreferences.addFiat": "Add fiat",
  "panels.assetPreferences.addProjectToken": "Add project token",
  "panels.assetPreferences.moveUp": "Move up",
  "panels.assetPreferences.moveDown": "Move down",
  "panels.assetPreferences.remove": "Remove",
  "panels.assetPreferences.resetDefaults": "Use defaults",
  "panels.assetPreferences.save": "Save priorities",
  "panels.assetPreferences.saving": "Saving...",
  "panels.assetPreferences.validationTitle": "Check priorities",
  "panels.assetPreferences.validationAssetCode": "Asset code is invalid.",
  "panels.assetPreferences.validationProjectId": "Project ID is required.",
  "panels.assetPreferences.successTitle": "Priorities saved",
  "panels.assetPreferences.successDescription": "Future settlement priorities were updated.",
  "panels.assetPreferences.failureTitle": "Could not save priorities",
  "panels.assetPreferences.typeLabels.stablecoin": "Stablecoin",
  "panels.assetPreferences.typeLabels.fiat": "Fiat",
  "panels.assetPreferences.typeLabels.project_token": "Project token",
  "panels.identity.status.unlinked":
    "This account is still missing its CUBID link. FundLoop can keep local settings here, but publish and payout-touching flows now expect a linked identity first.",
  "panels.identity.status.linked":
    "This account is linked to CUBID through the signed-in email. Full verification can continue on CUBID.me, but FundLoop can already treat the identity bridge as established.",
  "panels.identity.status.verified":
    "This account is linked to CUBID and the latest response indicates the email identity is verified. That is the strongest state currently surfaced inside FundLoop.",
}

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh: vi.fn(),
  }),
}))

vi.mock("@/i18n/navigation", () => ({
  useRouter: () => ({
    refresh: vi.fn(),
  }),
}))

vi.mock("@/lib/edge-functions/user-asset-preferences-update", () => ({
  invokeUserAssetPreferencesUpdateBrowser: vi.fn(),
}))

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => translations[key] ?? key,
}))

vi.mock("@/components/account/email-management", () => ({
  EmailManagement: () => <div>Email management</div>,
}))

vi.mock("@/components/account/wallet-management", () => ({
  WalletManagement: () => <div>Wallet management</div>,
}))

describe("AccountSettingsPanel", () => {
  it("shows the CUBID identity tab and renders the linked state details", async () => {
    render(
      <AccountSettingsPanel
        heading="Account"
        description="Description"
        cubid={{
          status: "linked",
          signedInEmail: "maya@example.com",
          cubidId: "cubid-user-1",
          cubidScore: 75,
          snapshot: null,
          managedIdentity: {
            fullName: { value: "Maya Torres", state: "synced" },
            primaryEmail: { value: "maya@example.com", state: "synced" },
            primaryPhone: { value: null, state: "pending" },
          },
          identityOwnership: {
            cubidManaged: ["full_name", "email"],
            fundloopManaged: ["display_name", "bio"],
          },
          profileCompletionPercent: 70,
          profileCompletionMissingItems: ["cubid_phone"],
          cubidPassportOrigin: "https://passport.cubid.me",
          cubidStampPageId: "123",
        }}
        localProfile={{
          displayName: "Maya",
          profileHeadline: "Builder",
          bio: "Bio",
          occupationName: "Designer",
          locationName: "Toronto",
          interestCount: 2,
          interestNames: ["Climate", "Open source"],
          visibility: {
            isPublic: true,
            isNamePublic: true,
            isPfpPublic: true,
            isGenderPublic: false,
            isOccupationPublic: true,
            isLocationPublic: true,
          },
        }}
        assetPreferences={{
          preferences: [],
          defaultPreferences: [
            { id: null, rank: 1, assetType: "stablecoin", assetCode: "USDC", projectId: null, accepted: true },
            { id: null, rank: 2, assetType: "fiat", assetCode: "USD", projectId: null, accepted: true },
          ],
          hasCustomPreferences: false,
          rejectsAllProjectTokens: false,
        }}
      />,
    )

    expect(screen.getByRole("tab", { name: /cubid identity/i })).toBeTruthy()
    expect(screen.getByRole("tab", { name: /asset priorities/i })).toBeTruthy()
    fireEvent.click(screen.getByRole("tab", { name: /cubid identity/i }))

    expect(screen.getAllByText(/linked/i).length).toBeGreaterThan(0)
    expect(screen.getByText(/cubid-user-1/i)).toBeTruthy()
    expect(screen.getByRole("link", { name: /manage on cubid passport/i }).getAttribute("href")).toBe(
      "https://passport.cubid.me",
    )
  })
})
