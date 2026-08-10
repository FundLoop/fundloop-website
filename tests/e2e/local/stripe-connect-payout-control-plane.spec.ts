import { mkdir } from "node:fs/promises"
import path from "node:path"
import { expect, test } from "@playwright/test"
import { loginThroughE2EEndpoint } from "../support/e2e-login"

const outputDir = path.resolve("output/playwright/issue-141")
test("user reviews redacted Stripe Connect sandbox readiness", async ({ page, context, baseURL }) => {
  if (!baseURL) throw new Error("stripe-connect-browser-base-url-required")
  const consoleErrors: string[] = []; page.on("console", (message) => { if (message.type() === "error") consoleErrors.push(message.text()) })
  await loginThroughE2EEndpoint(context, { baseURL, email: "maya@fundloop.example.com", password: "FundLoopFounder123!", secret: "allocation-local-secret" })
  await page.setViewportSize({ width: 1440, height: 900 }); await page.goto(`${baseURL}/en/workspace/earnings`)
  const panel = page.getByTestId("stripe-connect-panel"); await panel.scrollIntoViewIfNeeded()
  await expect(panel.getByText("Stripe Connect payout account")).toBeVisible(); await expect(panel.getByText(/FundLoop retains only readiness/)).toBeVisible()
  await expect(panel.getByText("Ready in sandbox")).toBeVisible(); await expect(panel.getByText("Bank ••••6789")).toBeVisible()
  await expect(panel.getByText(/Paid appears only after Stripe settlement and a balanced journal/)).toBeVisible()
  await expect(panel.getByText(/routing number/i)).toHaveCount(0); await expect(panel.getByText(/account number/i)).toHaveCount(0)
  await mkdir(outputDir, { recursive: true }); await panel.evaluate((element) => element.scrollIntoView({ block: "start" })); await page.evaluate(() => window.scrollBy(0, -120))
  await page.screenshot({ path: path.join(outputDir, "earnings-desktop-1440x900.png"), fullPage: false })
  await page.setViewportSize({ width: 390, height: 844 }); await panel.evaluate((element) => element.scrollIntoView({ block: "start" })); await page.evaluate(() => window.scrollBy(0, -180))
  await expect(panel).toBeVisible(); await page.screenshot({ path: path.join(outputDir, "earnings-mobile-390x844.png"), fullPage: false })
  await page.goto(`${baseURL}/en/workspace/account`); await expect(page.getByTestId("stripe-connect-panel")).toBeVisible()
  expect(consoleErrors).toEqual([])
})
