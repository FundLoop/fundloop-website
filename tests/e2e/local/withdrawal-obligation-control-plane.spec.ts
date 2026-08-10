import { mkdir } from "node:fs/promises"
import path from "node:path"
import { expect, test } from "@playwright/test"
import { loginThroughE2EEndpoint } from "../support/e2e-login"

const outputDir = path.resolve("output/playwright/issue-139")

test("user reviews partial withdrawal inventory and obligation states", async ({ page, context, baseURL }) => {
  if (!baseURL) throw new Error("withdrawal-browser-base-url-required")
  const consoleErrors: string[] = []
  page.on("console", (message) => { if (message.type() === "error") consoleErrors.push(message.text()) })
  await loginThroughE2EEndpoint(context, { baseURL, email: "maya@fundloop.example.com", password: "FundLoopFounder123!", secret: "allocation-local-secret" })
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto(`${baseURL}/en/workspace/earnings`)
  const panel = page.getByTestId("withdrawal-request-panel")
  await panel.scrollIntoViewIfNeeded()
  await expect(panel.getByText("Request a partial withdrawal")).toBeVisible()
  await expect(panel.getByText(/oldest earnings and exact inventory atomically/)).toBeVisible()
  await expect(panel.getByLabel("Amount (USD)")).toBeVisible()
  await expect(panel.getByLabel("Project-linked asset")).toBeVisible()
  await expect(panel.getByLabel("User fee snapshot (%)")).toHaveValue("0")
  await expect(panel.getByText("Minimum $10.00 · partial requests allowed")).toBeVisible()
  await expect(panel.getByText(/one obligation path · no payout executed/).first()).toBeVisible()
  await mkdir(outputDir, { recursive: true })
  await panel.evaluate((element) => element.scrollIntoView({ block: "start" }))
  await page.evaluate(() => window.scrollBy(0, -150))
  await page.screenshot({ path: path.join(outputDir, "desktop-1440x900.png"), fullPage: false })
  await page.setViewportSize({ width: 390, height: 844 })
  await panel.evaluate((element) => element.scrollIntoView({ block: "start" }))
  await page.evaluate(() => window.scrollBy(0, -135))
  await expect(panel).toBeVisible()
  await page.screenshot({ path: path.join(outputDir, "mobile-390x844.png"), fullPage: false })
  expect(consoleErrors).toEqual([])
})
