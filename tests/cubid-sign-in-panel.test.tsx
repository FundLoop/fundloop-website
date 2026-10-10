import React from "react"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

// The Sign in with Cubid card on the account page (#275, stage 2c UI).

const disconnect = vi.fn()
vi.mock("@/lib/edge-functions/cubid-identity", () => ({ invokeCubidIdentityDisconnectBrowser: disconnect }))

const { CubidSignInPanel } = await import("@/components/account/cubid-sign-in-panel")

const connected = { available: true, linked: true, linkedAt: "2026-10-01T00:00:00.000Z", lastSeenAt: null }
const notConnected = { available: true, linked: false, linkedAt: null, lastSeenAt: null }

beforeEach(() => {
  disconnect.mockReset()
  disconnect.mockResolvedValue({ ok: true, data: { outcome: "unlinked", revokedClients: 0 } })
})

describe("CubidSignInPanel", () => {
  it("renders nothing where Cubid sign-in is not configured", () => {
    // Cubid is not deployed yet, so an action that always fails is worse than no action.
    const { container } = render(<CubidSignInPanel status={{ ...notConnected, available: false }} />)
    expect(container.innerHTML).toBe("")
  })

  it("offers to connect, and sends the person through the link round trip", () => {
    const onNavigate = vi.fn()
    render(<CubidSignInPanel status={notConnected} onNavigate={onNavigate} />)

    expect(screen.getByText("Not connected")).toBeTruthy()
    fireEvent.click(screen.getByTestId("cubid-connect"))
    // `intent=link` is what makes the callback attach the identity to this account rather than
    // signing somebody in.
    expect(onNavigate).toHaveBeenCalledWith("/auth/cubid/start?intent=link&redirect_to=/workspace/account")
  })

  it("says it is connected, and does not reveal the pairwise subject", () => {
    const { container } = render(<CubidSignInPanel status={connected} />)
    expect(screen.getByText("Connected")).toBeTruthy()
    // The subject is Cubid's identifier for this person at this client. It has no business in a
    // page, and the status reader never sends it.
    expect(container.textContent).not.toContain("pairwise")
  })

  it("asks before disconnecting, and says what disconnecting costs", () => {
    render(<CubidSignInPanel status={connected} />)
    fireEvent.click(screen.getByTestId("cubid-disconnect"))

    expect(screen.getByText(/ends the access of every application/i)).toBeTruthy()
    expect(screen.getByText(/still sign in with your email/i)).toBeTruthy()
    expect(disconnect).not.toHaveBeenCalled()
  })

  it("can be backed out of without disconnecting", () => {
    render(<CubidSignInPanel status={connected} />)
    fireEvent.click(screen.getByTestId("cubid-disconnect"))
    fireEvent.click(screen.getByText("Keep it connected"))

    expect(disconnect).not.toHaveBeenCalled()
    expect(screen.getByTestId("cubid-disconnect")).toBeTruthy()
  })

  it("reports how many applications lost access", async () => {
    disconnect.mockResolvedValue({ ok: true, data: { outcome: "unlinked", revokedClients: 2 } })
    render(<CubidSignInPanel status={connected} />)
    fireEvent.click(screen.getByTestId("cubid-disconnect"))
    fireEvent.click(screen.getByTestId("cubid-disconnect-confirm"))

    await waitFor(() => expect(screen.getByRole("status").textContent).toContain("2 connected applications"))
    expect(screen.getByText("Not connected")).toBeTruthy()
  })

  it("keeps showing as connected when disconnecting fails", async () => {
    disconnect.mockResolvedValue({
      ok: false,
      error: { code: "last_sign_in_method", message: "Cubid is the only way to sign in to this account." },
    })
    render(<CubidSignInPanel status={connected} />)
    fireEvent.click(screen.getByTestId("cubid-disconnect"))
    fireEvent.click(screen.getByTestId("cubid-disconnect-confirm"))

    await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("only way to sign in"))
    // The person's state did not change, so the card must not pretend it did.
    expect(screen.getByText("Connected")).toBeTruthy()
  })
})
