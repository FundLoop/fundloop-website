import React from "react"
import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

vi.mock("next-intl/server", () => ({
  getTranslations: vi.fn().mockImplementation(async ({ namespace }: { namespace?: string } = {}) => {
    if (namespace === "metadata.ecosystem") {
      return (key: string) =>
        ({
          title: "Ecosystem - FundLoop",
          description: "Explore the surrounding network.",
        })[key] ?? key
    }

    return (key: string) =>
      ({
        "backToHome": "Back to home",
        "hero.eyebrow": "Ecosystem",
        "hero.title": "Our ecosystem",
        "hero.body": "Supporting systems around FundLoop.",
        "open": "Open",
      })[key] ?? key
  }),
}))

vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={typeof href === "string" ? href : ""} {...props}>
      {children}
    </a>
  ),
}))

describe("EcosystemPage", () => {
  it("renders ecosystem heading and sites", async () => {
    const { default: EcosystemPage } = await import("@/app/[locale]/(public)/ecosystem/page")

    render(await EcosystemPage({ params: Promise.resolve({ locale: "en" }) }))
    expect(screen.getByRole("heading", { name: /our ecosystem/i })).toBeDefined()
    expect(screen.getByText("ChainCrew")).toBeDefined()
  })

  it("adds rel noopener noreferrer to external links", async () => {
    const { default: EcosystemPage } = await import("@/app/[locale]/(public)/ecosystem/page")

    render(await EcosystemPage({ params: Promise.resolve({ locale: "en" }) }))
    const link = screen.getByRole("link", { name: "ChainCrew" })
    expect(link.getAttribute("rel")).toBe("noopener noreferrer")
  })

  it("generates localized metadata", async () => {
    const { generateMetadata } = await import("@/app/[locale]/(public)/ecosystem/page")

    await expect(generateMetadata({ params: Promise.resolve({ locale: "en" }) })).resolves.toMatchObject({
      title: "Ecosystem - FundLoop",
      description: "Explore the surrounding network.",
    })
  })
})
