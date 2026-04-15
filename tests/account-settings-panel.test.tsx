import React from "react"
import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { AccountSettingsPanel } from "@/components/account/account-settings-panel"

const translations: Record<string, string> = {
  identity: "CUBID Identity",
  profile: "Profile & Visibility",
  emails: "Email Addresses",
  wallets: "Wallet Addresses",
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
      />,
    )

    expect(screen.getByRole("tab", { name: /cubid identity/i })).toBeTruthy()
    fireEvent.click(screen.getByRole("tab", { name: /cubid identity/i }))

    expect(screen.getAllByText(/linked/i).length).toBeGreaterThan(0)
    expect(screen.getByText(/cubid-user-1/i)).toBeTruthy()
    expect(screen.getByRole("link", { name: /manage on cubid passport/i }).getAttribute("href")).toBe(
      "https://passport.cubid.me",
    )
  })
})
