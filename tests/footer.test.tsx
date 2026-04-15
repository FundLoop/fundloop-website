import React from "react"
import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

vi.mock("next-intl/server", () => ({
  getTranslations: vi.fn().mockResolvedValue((key: string) => {
    const translations: Record<string, string> = {
      "footer.buildTheLoop": "Build the loop",
      "footer.body": "Body copy",
      "footer.startProjectProfile": "Start a project profile",
      "footer.explore": "Explore",
      "footer.resources": "Resources",
      "footer.legal": "Legal",
      "footer.ecosystem": "Ecosystem",
      "footer.terms": "Terms of Service",
      "footer.privacy": "Privacy Policy",
      "footer.cookies": "Cookie Policy",
      "footer.rightsReserved": "FundLoop. All rights reserved.",
      "footer.mission": "A network state for mutual prosperity.",
      "nav.primary.founders": "Founders",
      "nav.primary.participation": "Participation",
      "nav.primary.projects": "Projects",
      "nav.primary.documentation": "Documentation",
      "nav.primary.blog": "Blog",
      "nav.primary.support": "Support",
      "nav.resourceLinks.participation.label": "Participation",
      "nav.resourceLinks.pricing.label": "Pricing",
      "nav.resourceLinks.documentation.label": "Documentation",
      "nav.resourceLinks.faq.label": "FAQ",
      "nav.resourceLinks.support.label": "Support",
      "nav.resourceLinks.api.label": "API",
    }

    return translations[key] ?? key
  }),
}))

vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={typeof href === "string" ? href : ""} {...props}>
      {children}
    </a>
  ),
}))

import Footer from "@/components/footer"

describe("Footer", () => {
  it("links to ecosystem page", async () => {
    render(await Footer())
    const link = screen.getByRole("link", { name: /ecosystem/i })
    expect(link.getAttribute("href")).toBe("/ecosystem")
  })

  it("links to the founder path from the footer", async () => {
    render(await Footer())
    const links = screen.getAllByRole("link", { name: /founders/i })
    expect(links[0]?.getAttribute("href")).toBe("/founders")
  })
})
