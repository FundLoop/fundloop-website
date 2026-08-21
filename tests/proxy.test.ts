import { describe, expect, it } from "vitest"
import { NextRequest } from "next/server"
import { getLocaleRedirectTarget, hasUnsupportedLocalePrefix, shouldSkipLocaleRouting } from "@/i18n/proxy-helpers"

describe("locale proxy", () => {
  it("identifies paths that should bypass locale redirects", () => {
    expect(shouldSkipLocaleRouting("/api/internal/health")).toBe(true)
    expect(shouldSkipLocaleRouting("/_next/static/chunk.js")).toBe(true)
    expect(shouldSkipLocaleRouting("/favicon.ico")).toBe(true)
    expect(shouldSkipLocaleRouting("/support")).toBe(false)
  })

  it("detects unsupported locale prefixes", () => {
    expect(hasUnsupportedLocalePrefix("/de/support")).toBe(true)
    expect(hasUnsupportedLocalePrefix("/en/support")).toBe(false)
    expect(hasUnsupportedLocalePrefix("/support")).toBe(false)
  })

  it("builds redirect targets for bare routes using the default locale", () => {
    const request = new NextRequest("https://fundloop.test/participation")

    expect(getLocaleRedirectTarget(request).toString()).toBe("https://fundloop.test/en/participation")
  })

  it("respects the saved locale cookie when redirecting bare routes", () => {
    const request = new NextRequest("https://fundloop.test/support", {
      headers: {
        cookie: "FUNDLOOP_LOCALE=fr",
      },
    })

    expect(getLocaleRedirectTarget(request).toString()).toBe("https://fundloop.test/fr/support")
  })

  it("does not treat unsupported locale prefixes as redirect candidates", () => {
    expect(hasUnsupportedLocalePrefix("/de/support")).toBe(true)
    expect(hasUnsupportedLocalePrefix("/pt/projects")).toBe(true)
  })
})
