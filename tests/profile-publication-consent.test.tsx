import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { ProfilePublicationConsent } from "@/components/account/profile-publication-consent"

const { choose } = vi.hoisted(() => ({ choose: vi.fn() }))
vi.mock("@/lib/edge-functions/profile-publication-choice", () => ({ invokeProfilePublicationChoice: choose }))

describe("ProfilePublicationConsent", () => {
  beforeEach(() => vi.clearAllMocks())
  it("requires an unselected affirmative choice before review publication", async () => {
    choose.mockResolvedValue({ ok: true, data: { consentId: "c1", recordedAt: "2026-08-08T00:00:00Z", isPublic: true, prospectiveWithdrawal: false, status: "review" } })
    render(<ProfilePublicationConsent initiallyPublic={false} />)
    const button = screen.getByRole("button", { name: "Publish profile in review preview" })
    expect(button.getAttribute("disabled")).not.toBeNull()
    fireEvent.click(screen.getByRole("checkbox")); fireEvent.click(button)
    await waitFor(() => expect(choose).toHaveBeenCalledTimes(1))
    expect(screen.getByText(/local\/dev discovery only/)).toBeTruthy()
  })
  it("offers immediate prospective withdrawal for a public profile", async () => {
    choose.mockResolvedValue({ ok: true, data: { consentId: "c2", recordedAt: "2026-08-08T00:00:00Z", isPublic: false, prospectiveWithdrawal: true, status: "review" } })
    render(<ProfilePublicationConsent initiallyPublic />)
    fireEvent.click(screen.getByRole("button", { name: "Withdraw public-profile publication" }))
    expect(await screen.findByText(/removed from FundLoop public discovery/)).toBeTruthy()
  })
})

