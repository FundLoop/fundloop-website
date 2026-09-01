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
  it("renders collapsed Prototype badge by default without stealing initial focus", () => {
    render(<FloatingPrototypeBadge />)

    const trigger = screen.getByRole("button", { name: /open prototype notice/i })
    expect(trigger).toBeDefined()
    expect(screen.getByText("Prototype")).toBeDefined()
    expect(screen.queryByText(/This page is a work in progress/i)).toBeNull()
    expect(document.activeElement).not.toBe(trigger)
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

  it("collapses back and restores focus to trigger when close button is clicked", () => {
    render(<FloatingPrototypeBadge />)

    const trigger = screen.getByRole("button", { name: /open prototype notice/i })
    fireEvent.click(trigger)
    expect(screen.getByText("Prototype Notice")).toBeDefined()

    const closeButtons = screen.getAllByRole("button", { name: /close notice/i })
    const topCloseButton = closeButtons[0]
    expect(document.activeElement).toBe(topCloseButton)

    fireEvent.click(topCloseButton)

    expect(screen.queryByText(/This page is a work in progress/i)).toBeNull()
    const collapsedTrigger = screen.getByRole("button", { name: /open prototype notice/i })
    expect(collapsedTrigger).toBeDefined()
    expect(document.activeElement).toBe(collapsedTrigger)
  })

  it("manages focus on open and restores focus when closed via Escape key", () => {
    render(<FloatingPrototypeBadge />)

    const trigger = screen.getByRole("button", { name: /open prototype notice/i })
    fireEvent.click(trigger)

    expect(screen.getByText("Prototype Notice")).toBeDefined()
    const closeButtons = screen.getAllByRole("button", { name: /close notice/i })
    expect(document.activeElement).toBe(closeButtons[0])

    fireEvent.keyDown(window, { key: "Escape" })
    expect(screen.queryByText(/This page is a work in progress/i)).toBeNull()
    const collapsedTrigger = screen.getByRole("button", { name: /open prototype notice/i })
    expect(collapsedTrigger).toBeDefined()
    expect(document.activeElement).toBe(collapsedTrigger)
  })
})
