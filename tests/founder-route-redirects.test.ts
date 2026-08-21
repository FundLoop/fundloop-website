import { describe, expect, it, vi } from "vitest"

const notFound = vi.fn()
const permanentRedirect = vi.fn()

vi.mock("next/navigation", () => ({
  notFound,
  permanentRedirect,
}))

describe("legacy founder route redirects", () => {
  it("redirects the pledge page into the founder commitment section", async () => {
    const { default: PledgePage } = await import("@/app/[locale]/(public)/pledge/page")

    await PledgePage({
      params: Promise.resolve({ locale: "en" }),
    })

    expect(permanentRedirect).toHaveBeenCalledWith("/en/founders#commitment")
  })

  it("redirects the pricing page into the founder support-model section", async () => {
    const { default: PricingPage } = await import("@/app/[locale]/(public)/pricing/page")

    await PricingPage({
      params: Promise.resolve({ locale: "en" }),
    })

    expect(permanentRedirect).toHaveBeenCalledWith("/en/founders#support-model")
  })
})
