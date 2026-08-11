import { mkdir } from "node:fs/promises"
import path from "node:path"
import { expect, test } from "@playwright/test"
import { loginThroughE2EEndpoint } from "../support/e2e-login"
import { collectUnexpectedLocalConsoleErrors } from "../support/local-console-errors"

const outputDir = path.resolve("output/playwright/issue-152")

test("founder sees privacy-safe fail-closed Canadian PAD funding", async ({page, context, baseURL}) => {
  if (!baseURL) throw new Error("stripe-acss-browser-base-url-required")
  const consoleErrors: string[] = []
  collectUnexpectedLocalConsoleErrors(page, consoleErrors)
  await loginThroughE2EEndpoint(context, {baseURL, email: "maya@fundloop.example.com", password: "FundLoopFounder123!", secret: process.env.FUNDLOOP_E2E_SECRET ?? ""})
  await page.setViewportSize({width: 1440, height: 900})
  await page.goto(`${baseURL}/en/projects/civic-mesh/payments`)
  const panel = page.getByTestId("stripe-acss-debit-panel")
  await panel.scrollIntoViewIfNeeded()
  await expect(panel.getByText("Canadian pre-authorized debit")).toBeVisible()
  await expect(panel.getByText(/FundLoop never receives your bank account details/)).toBeVisible()
  await expect(panel.getByText(/Returning from Checkout does not fund the project/)).toBeVisible()
  await expect(panel.getByText(/USD and production remain disabled/)).toBeVisible()
  await expect(panel.getByText(/account number|transit number|institution number/i)).toHaveCount(0)
  await mkdir(outputDir, {recursive: true})
  await panel.evaluate((element) => element.scrollIntoView({block: "center"}))
  await page.screenshot({path: path.join(outputDir, "pad-desktop-1440x900.png"), fullPage: false})
  await page.setViewportSize({width: 390, height: 844})
  await panel.evaluate((element) => element.scrollIntoView({block: "center"}))
  await expect(panel).toBeVisible()
  await page.screenshot({path: path.join(outputDir, "pad-mobile-390x844.png"), fullPage: false})
  expect(consoleErrors).toEqual([])
})
