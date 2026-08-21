import { expect, test } from "@playwright/test"

const supportedLocales = ["en", "es", "fr"] as const

test.describe("@hosted-public localized reports", () => {
  for (const locale of supportedLocales) {
    test(`${locale} reports route renders on the configured Vercel deployment`, async ({ page }) => {
      const response = await page.goto(`/${locale}/reports`, { waitUntil: "domcontentloaded" })

      expect(response?.ok()).toBe(true)
      await expect(page).toHaveURL(new RegExp(`/${locale}/reports/?$`))
      await expect(page.locator("main")).toBeVisible()
      await expect(page.locator("h1, h2").first()).toBeVisible()
    })
  }
})
