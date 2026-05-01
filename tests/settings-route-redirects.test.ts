import { beforeEach, describe, expect, it, vi } from "vitest"

const redirect = vi.fn()

vi.mock("next/navigation", () => ({
  redirect,
}))

describe("legacy settings route redirects", () => {
  beforeEach(() => {
    redirect.mockReset()
  })

  it("redirects settings into workspace account", async () => {
    const { default: SettingsPage } = await import("@/app/[locale]/(app)/settings/page")

    await SettingsPage({
      params: Promise.resolve({ locale: "en" }),
    })

    expect(redirect).toHaveBeenCalledWith("/en/workspace/account")
  })

  it("redirects settings account into workspace account", async () => {
    const { default: SettingsAccountPage } = await import("@/app/[locale]/(app)/settings/account/page")

    await SettingsAccountPage({
      params: Promise.resolve({ locale: "en" }),
    })

    expect(redirect).toHaveBeenCalledWith("/en/workspace/account")
  })

  it("redirects raw zkAS settings into workspace reporting", async () => {
    const { default: SettingsZkasPage } = await import("@/app/[locale]/(app)/settings/zkas/page")

    await SettingsZkasPage({
      params: Promise.resolve({ locale: "en" }),
    })

    expect(redirect).toHaveBeenCalledWith("/en/workspace/reporting")
  })
})
