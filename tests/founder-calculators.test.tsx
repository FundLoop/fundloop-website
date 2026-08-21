import React from "react"
import { render, screen, fireEvent } from "@testing-library/react"
import { NextIntlClientProvider } from "next-intl"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { FounderGrowthMathPanel } from "@/components/marketing/founder-growth-math"
import { FounderRuntimeMoatMathPanel } from "@/components/marketing/founder-runtime-moat-math"
import { FounderCalculatorProvider } from "@/components/marketing/founder-calculator-context"
import { enMessages } from "@/i18n/messages/en"
import { esMessages } from "@/i18n/messages/es"

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

function renderWithMessages(
  ui: React.ReactNode,
  locale = "en",
  messages: unknown = enMessages
) {
  return render(
    <NextIntlClientProvider locale={locale} messages={messages as typeof enMessages}>
      {ui}
    </NextIntlClientProvider>
  )
}

describe("Founder Marketing Calculators", () => {
  describe("FounderGrowthMathPanel (Cold Start / Acquisition CAC)", () => {
    it("renders initial side-by-side comparison with symmetrical conclusion metrics and 5 parameter sliders", () => {
      renderWithMessages(<FounderGrowthMathPanel />)

      expect(screen.getByText("The math: why founders join FundLoop instead of running ads")).toBeDefined()
      expect(screen.getByText("Adjust your project parameters")).toBeDefined()
      expect(screen.getByText("Starting users")).toBeDefined()
      expect(screen.getByText("Baseline MAU")).toBeDefined()
      expect(screen.getAllByText("Monthly ad budget").length).toBe(2)
      expect(screen.getByText("New users / month")).toBeDefined()
      expect(screen.getByText("Monthly ARPU")).toBeDefined()

      expect(screen.getByText("Option A")).toBeDefined()
      expect(screen.getByText("Traditional ad spend")).toBeDefined()
      expect(screen.getByText("Option B")).toBeDefined()
      expect(screen.getByText("The FundLoop loop")).toBeDefined()

      // Symmetrical conclusion comparisons
      expect(screen.getByText("240 MAU")).toBeDefined()
      expect(screen.getByText("900 MAU")).toBeDefined()
      expect(screen.getByText("7,000 qualified visits")).toBeDefined()
      expect(screen.getByText("$25.00 / active MAU")).toBeDefined()
    })

    it("switches to step-by-step breakdown view on tab click", () => {
      renderWithMessages(<FounderGrowthMathPanel />)

      const stepsTab = screen.getByRole("button", { name: /Step-by-Step Breakdown/i })
      fireEvent.click(stepsTab)

      expect(screen.getByText("Your baseline")).toBeDefined()
      expect(screen.getByText("Redirect ad spend")).toBeDefined()
      expect(screen.getByText("Ecosystem discovery")).toBeDefined()
      expect(screen.getByText("Conversion model")).toBeDefined()
      expect(screen.getByText("Network multiplier")).toBeDefined()
    })
  })

  describe("FounderRuntimeMoatMathPanel (Steady-State & Retention Moat)", () => {
    it("renders interactive sliders, linked model callout, dynamic churn, and target ad spend", () => {
      renderWithMessages(<FounderRuntimeMoatMathPanel />)

      expect(screen.getByText("Why projects stay: the shared-upside competitive moat")).toBeDefined()
      expect(screen.getByText("Linked model:")).toBeDefined()
      expect(screen.getByText("Monthly active users")).toBeDefined()
      expect(screen.getByText("Average net revenue / MAU")).toBeDefined()
      expect(screen.getByText("Modelled give-back share")).toBeDefined()

      expect(screen.getByText("Extractive competitor")).toBeDefined()
      expect(screen.getByText("On FundLoop")).toBeDefined()

      // Dynamic churn and ad spend to keep up
      expect(screen.getAllByText("Monthly user migration to your project").length).toBeGreaterThan(0)
      expect(screen.getByText("Ad spend required to keep up")).toBeDefined()
      expect(screen.getAllByText("Monthly growth from migration").length).toBe(2)

      // Net retained profit Month +1 labels
      expect(screen.getAllByText("Net retained founder profit, month +1").length).toBe(2)

      // Both models start from the same ending MAU and therefore the same gross
      // revenue; only the competing cost structures differ.
      expect(screen.getAllByText("$52,500 / mo").length).toBe(2)

      expect(screen.getByText("01. Churn deflation")).toBeDefined()
      expect(screen.getByText("02. Organic migration")).toBeDefined()
      expect(screen.getByText("03. Reputation moat")).toBeDefined()
    })

    it("shares state seamlessly with FounderCalculatorProvider", () => {
      renderWithMessages(
        <FounderCalculatorProvider>
          <FounderGrowthMathPanel />
          <FounderRuntimeMoatMathPanel />
        </FounderCalculatorProvider>
      )

      expect(screen.getByText("The math: why founders join FundLoop instead of running ads")).toBeDefined()
      expect(screen.getByText("Why projects stay: the shared-upside competitive moat")).toBeDefined()
      expect(screen.getAllByText("Net retained founder profit, month +1").length).toBe(2)
    })

    it("renders localized calculator copy", () => {
      renderWithMessages(<FounderGrowthMathPanel />, "es", esMessages)

      expect(screen.getByText("Las matemáticas: por qué un fundador elige FundLoop en vez de anuncios")).toBeDefined()
      expect(screen.getByText("Ajusta los parámetros del proyecto")).toBeDefined()
      expect(screen.queryByText("Adjust your project parameters")).toBeNull()
    })
  })
})
