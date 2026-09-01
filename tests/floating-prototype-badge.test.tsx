import React from "react"
import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { FloatingPrototypeBadge } from "@/components/floating-prototype-badge"

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => {
    const messages: Record<string, string> = {
      label: "Prototype",
      title: "Prototype Notice",
      body: "This page is a work in progress. Please have patience with us if things break. We would appreciate if you would send a note to support@firebelly.xyz with any observations or suggestions.",
      contactUs: "Email support@firebelly.xyz",
      openNotice: "Open prototype notice",
      close: "Close notice",
    }
    return messages[key] ?? key
  },
}))

describe("FloatingPrototypeBadge", () => {
  it("renders collapsed Prototype badge by default", () => {
    render(<FloatingPrototypeBadge />)

    expect(screen.getByRole("button", { name: /open prototype notice/i })).toBeDefined()
    expect(screen.getByText("Prototype")).toBeDefined()
    expect(screen.queryByText(/This page is a work in progress/i)).toBeNull()
  })

  it("expands on click to display prototype notice and mailto support link", () => {
    render(<FloatingPrototypeBadge />)

    const badgeButton = screen.getByRole("button", { name: /open prototype notice/i })
    fireEvent.click(badgeButton)

    expect(screen.getByText("Prototype Notice")).toBeDefined()
    expect(
      screen.getByText(
        "This page is a work in progress. Please have patience with us if things break. We would appreciate if you would send a note to support@firebelly.xyz with any observations or suggestions.",
      ),
    ).toBeDefined()

    const mailLinks = screen.getAllByRole("link")
    expect(mailLinks.some((link) => link.getAttribute("href")?.includes("mailto:support@firebelly.xyz"))).toBe(true)
  })

  it("collapses back when close button is clicked", () => {
    render(<FloatingPrototypeBadge />)

    fireEvent.click(screen.getByRole("button", { name: /open prototype notice/i }))
    expect(screen.getByText("Prototype Notice")).toBeDefined()

    const closeButtons = screen.getAllByRole("button", { name: /close notice/i })
    fireEvent.click(closeButtons[0])

    expect(screen.queryByText(/This page is a work in progress/i)).toBeNull()
    expect(screen.getByRole("button", { name: /open prototype notice/i })).toBeDefined()
  })

  it("manages focus on open and supports Escape key to close", () => {
    render(<FloatingPrototypeBadge />)

    const trigger = screen.getByRole("button", { name: /open prototype notice/i })
    fireEvent.click(trigger)

    expect(screen.getByText("Prototype Notice")).toBeDefined()

    fireEvent.keyDown(window, { key: "Escape" })
    expect(screen.queryByText(/This page is a work in progress/i)).toBeNull()
    expect(screen.getByRole("button", { name: /open prototype notice/i })).toBeDefined()
  })
})
