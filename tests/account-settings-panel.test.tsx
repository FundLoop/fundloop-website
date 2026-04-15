import React from "react"
import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { AccountSettingsPanel } from "@/components/account/account-settings-panel"

const translations: Record<string, string> = {
  identity: "CUBID Identity",
  emails: "Email Addresses",
  wallets: "Wallet Addresses",
  "panels.identity.title": "CUBID is becoming the account authority for FundLoop",
  "panels.identity.manage": "Manage on CUBID Passport",
  "panels.identity.labels.unlinked": "Not linked yet",
  "panels.identity.labels.linked": "Linked",
  "panels.identity.labels.verified": "Verified",
  "panels.identity.status.unlinked":
    "This account is still missing its CUBID link. FundLoop can keep local settings here, but publish and payout-touching flows now expect a linked identity first.",
  "panels.identity.status.linked":
    "This account is linked to CUBID through the signed-in email. Full verification can continue on CUBID.me, but FundLoop can already treat the identity bridge as established.",
  "panels.identity.status.verified":
    "This account is linked to CUBID and the latest response indicates the email identity is verified. That is the strongest state currently surfaced inside FundLoop.",
}

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
          email: "maya@example.com",
          cubidId: "cubid-user-1",
          cubidScore: 75,
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
