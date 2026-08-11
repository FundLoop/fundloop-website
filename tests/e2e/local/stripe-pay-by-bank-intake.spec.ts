import { mkdir } from "node:fs/promises"
import path from "node:path"
import { createClient } from "@supabase/supabase-js"
import { expect, test } from "@playwright/test"
import { loginThroughE2EEndpoint } from "../support/e2e-login"
import { collectUnexpectedLocalConsoleErrors } from "../support/local-console-errors"

const outputDir = path.resolve("output/playwright/issue-153")

test("founder sees privacy-safe fail-closed Pay by Bank funding", async ({page, context, baseURL}) => {
  if (!baseURL) throw new Error("stripe-pay-by-bank-browser-base-url-required")
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ""
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ""
  if (!supabaseUrl || !serviceRoleKey) throw new Error("stripe-pay-by-bank-browser-supabase-env-required")
  const service = createClient(supabaseUrl, serviceRoleKey, {auth: {persistSession: false, autoRefreshToken: false}})
  const [{data: project}, users] = await Promise.all([
    service.from("projects").select("id").eq("slug", "civic-mesh").single(),
    service.auth.admin.listUsers(),
  ])
  const actor = users.data.users.find((user) => user.email === "maya@fundloop.example.com")
  if (!project || !actor) throw new Error("stripe-pay-by-bank-browser-fixture-actor-required")
  const {data: fixture, error: fixtureError} = await service.from("payments").insert({project_id: project.id,
    period_start: "2026-08-01", period_end: "2026-08-31", revenue: 100, payment_amount: 25,
    payment_percentage: 25, status_id: 1, updated_by: actor.id}).select("id").single()
  if (fixtureError || !fixture) throw new Error(fixtureError?.message ?? "stripe-pay-by-bank-browser-fixture-create-failed")
  const consoleErrors: string[] = []
  collectUnexpectedLocalConsoleErrors(page, consoleErrors)
  await loginThroughE2EEndpoint(context, {baseURL, email: "maya@fundloop.example.com", password: "FundLoopFounder123!", secret: process.env.FUNDLOOP_E2E_SECRET ?? ""})
  await page.setViewportSize({width: 1440, height: 900})
  let lifecycle = {status: "checkout_created", availableForPackage: false, reversed: false}
  await page.route("**/functions/v1/stripe-pay-by-bank-status-read", async (route) => route.fulfill({status: 200,
    contentType: "application/json", body: JSON.stringify({ok: true, data: [{commandId: "00000000-0000-4000-8000-000000000152",
      paymentId: fixture.id, currencyCode: "GBP", expectedAmountMinor: "2500", status: lifecycle.status,
      statusAt: "2026-08-11T00:00:00Z", availableForPackage: lifecycle.availableForPackage, reversed: lifecycle.reversed}]})}))
  await page.goto(`${baseURL}/en/projects/civic-mesh/payments`)
  const panel = page.getByTestId("stripe-pay-by-bank-panel")
  await panel.scrollIntoViewIfNeeded()
  await expect(panel.getByText("Pay by Bank", {exact: true})).toBeVisible()
  await expect(panel.getByText(/FundLoop never receives your bank credentials/)).toBeVisible()
  await expect(panel.getByText(/Returning from Checkout does not fund the project/)).toBeVisible()
  await expect(panel.getByText(/UK and Finland are generally available/)).toBeVisible()
  await expect(panel.getByText(/France, Germany, and Ireland are unavailable/)).toBeVisible()
  await expect(panel.getByText(/account number|transit number|institution number/i)).toHaveCount(0)
  await mkdir(outputDir, {recursive: true})
  const states = [
    {name: "authorization", status: "checkout_created", availableForPackage: false, reversed: false, copy: /Authorization required/i},
    {name: "pending", status: "processing", availableForPackage: false, reversed: false, copy: /settlement is pending/i},
    {name: "reconciled", status: "settled_available", availableForPackage: true, reversed: false, copy: /Reconciled: available custody/i},
    {name: "reversal", status: "refunded", availableForPackage: false, reversed: true, copy: /Refunded and removed/i},
  ]
  for (const state of states) {
    lifecycle = state
    await page.setViewportSize({width: 1440, height: 900})
    await page.reload()
    const statePanel = page.getByTestId("stripe-pay-by-bank-panel")
    await expect(statePanel.getByText(state.copy)).toBeVisible()
    await statePanel.evaluate((element) => element.scrollIntoView({block: "center"}))
    await page.screenshot({path: path.join(outputDir, `pay-by-bank-${state.name}-desktop-1440x900.png`), fullPage: false})
    await page.setViewportSize({width: 390, height: 844})
    await statePanel.evaluate((element) => element.scrollIntoView({block: "center"}))
    await expect(statePanel).toBeVisible()
    await page.screenshot({path: path.join(outputDir, `pay-by-bank-${state.name}-mobile-390x844.png`), fullPage: false})
  }
  expect(consoleErrors).toEqual([])
  await service.from("payments").delete().eq("id", fixture.id)
})
