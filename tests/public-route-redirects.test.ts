import { beforeEach, describe, expect, it, vi } from "vitest"

const notFound = vi.fn()
const permanentRedirect = vi.fn()

vi.mock("next/navigation", () => ({
  notFound,
  permanentRedirect,
}))

describe("legacy public route redirects", () => {
  beforeEach(() => {
    notFound.mockReset()
    permanentRedirect.mockReset()
  })

  it("redirects about into the documentation about section", async () => {
    const { default: AboutPage } = await import("@/app/[locale]/(public)/about/page")

    await AboutPage({
      params: Promise.resolve({ locale: "en" }),
    })

    expect(permanentRedirect).toHaveBeenCalledWith("/en/documentation#about-fundloop")
  })

  it("redirects api into the documentation integrations section", async () => {
    const { default: APIPage } = await import("@/app/[locale]/(public)/api/page")

    await APIPage({
      params: Promise.resolve({ locale: "en" }),
    })

    expect(permanentRedirect).toHaveBeenCalledWith("/en/documentation#protocol-and-integrations")
  })

  it("redirects analytics into reports", async () => {
    const { default: AnalyticsPage } = await import("@/app/[locale]/(public)/analytics/page")

    await AnalyticsPage({
      params: Promise.resolve({ locale: "en" }),
    })

    expect(permanentRedirect).toHaveBeenCalledWith("/en/reports")
  })

  it("renders the persisted project invitation acceptance route", async () => {
    const { default: ProjectInvitationPage } = await import("@/app/[locale]/(public)/invitations/[token]/page")

    const result = await ProjectInvitationPage({
      params: Promise.resolve({ locale: "en", token: "invite-123" }),
    })

    expect(result).toBeTruthy()
    expect(permanentRedirect).not.toHaveBeenCalled()
  })
})
