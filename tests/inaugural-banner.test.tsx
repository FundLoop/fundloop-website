import React from "react"
import { fireEvent, render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { InauguralBanner } from "@/components/inaugural-banner"

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => {
    const translations: Record<string, string> = {
      badge: "Inaugural Cohort",
      message: "Now onboarding inaugural projects for Epoch 1",
      cta: "Apply now",
      dismiss: "Dismiss announcement",
    }
    return translations[key] ?? key
  },
}))

vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={typeof href === "string" ? href : ""} {...props}>
      {children}
    </a>
  ),
}))

describe("InauguralBanner", () => {
  beforeEach(() => {
    sessionStorage.clear()
  })

  it("renders the announcement banner with inaugural cohort badge and link to project onboarding", () => {
    render(<InauguralBanner />)

    expect(screen.getByText("Inaugural Cohort")).toBeDefined()
    expect(screen.getByText("Now onboarding inaugural projects for Epoch 1")).toBeDefined()
    expect(screen.getByText("Apply now")).toBeDefined()

    const link = screen.getByRole("link")
    expect(link.getAttribute("href")).toBe("/?onboarding=project")
  })

  it("hides when dismissed and writes dismissal to sessionStorage", () => {
    render(<InauguralBanner />)

    const dismissButton = screen.getByRole("button", { name: /dismiss announcement/i })
    fireEvent.click(dismissButton)

    expect(screen.queryByText("Inaugural Cohort")).toBeNull()
    expect(sessionStorage.getItem("fundloop_inaugural_banner_dismissed")).toBe("1")
  })

  it("does not render when already dismissed in sessionStorage", () => {
    sessionStorage.setItem("fundloop_inaugural_banner_dismissed", "1")
    render(<InauguralBanner />)

    expect(screen.queryByText("Inaugural Cohort")).toBeNull()
  })
})
