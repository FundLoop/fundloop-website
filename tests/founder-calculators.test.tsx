import React from "react"
import { render, screen, fireEvent } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { FounderGrowthMathPanel } from "@/components/marketing/founder-growth-math"
import { FounderRuntimeMoatMathPanel } from "@/components/marketing/founder-runtime-moat-math"

vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={typeof href === "string" ? href : ""} {...props}>
      {children}
    </a>
  ),
}))

class MockResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

beforeEach(() => {
  global.ResizeObserver = MockResizeObserver
})

describe("Founder Marketing Calculators", () => {
  describe("FounderGrowthMathPanel (Cold Start / Acquisition CAC)", () => {
    it("renders initial side-by-side comparison with key metrics", () => {
      render(<FounderGrowthMathPanel />)

      expect(screen.getByText("The Math: Why Founders Join FundLoop Over Running Ads")).toBeDefined()
      expect(screen.getByText("Option A")).toBeDefined()
      expect(screen.getByText("Traditional Ad Spend")).toBeDefined()
      expect(screen.getByText("Option B")).toBeDefined()
      expect(screen.getByText("The FundLoop Loop")).toBeDefined()
      expect(screen.getByText("900 MAU")).toBeDefined()
      expect(screen.getByText("7,000 qualified visits")).toBeDefined()
    })

    it("switches to step-by-step breakdown view on tab click", () => {
      render(<FounderGrowthMathPanel />)

      const stepsTab = screen.getByRole("button", { name: /Step-by-Step Breakdown/i })
      fireEvent.click(stepsTab)

      expect(screen.getByText("Your Baseline")).toBeDefined()
      expect(screen.getByText("Redirect Ad Spend")).toBeDefined()
      expect(screen.getByText("Ecosystem Discovery")).toBeDefined()
      expect(screen.getByText("Conversion Boost")).toBeDefined()
      expect(screen.getByText("Network Multiplier")).toBeDefined()
    })
  })

  describe("FounderRuntimeMoatMathPanel (Steady-State & Retention Moat)", () => {
    it("renders interactive sliders and dynamic financial comparison", () => {
      render(<FounderRuntimeMoatMathPanel />)

      expect(screen.getByText("Why Projects Stay: The Shared-Upside Competitive Moat")).toBeDefined()
      expect(screen.getByText("Monthly Active Users")).toBeDefined()
      expect(screen.getByText("Average Net Revenue / MAU")).toBeDefined()
      expect(screen.getByText("FundLoop Give-Back Share")).toBeDefined()
      expect(screen.getByText("Extractive Competitor")).toBeDefined()
      expect(screen.getByText("On FundLoop")).toBeDefined()
      expect(screen.getByText("01. Churn Deflation")).toBeDefined()
      expect(screen.getByText("02. Organic Vampire Migration")).toBeDefined()
      expect(screen.getByText("03. Unassailable Reputation Moat")).toBeDefined()
    })
  })
})
