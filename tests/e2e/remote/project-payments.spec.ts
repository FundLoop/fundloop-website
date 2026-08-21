import { expect, test } from "@playwright/test"
import { getRemoteE2EEnv } from "../support/env"
import { loginThroughE2EEndpoint } from "../support/e2e-login"
import { createProjectPaymentsFixture } from "../support/supabase-fixtures"

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

test.describe("remote-safe project payments", () => {
  test("renders seeded payment statuses and onchain progress safely", async ({ page }) => {
    const env = getRemoteE2EEnv()
    test.skip(!env, "Remote-safe Playwright env vars are not configured.")
    if (!env) {
      return
    }

    const fixture = await createProjectPaymentsFixture({
      scenario: "remote-safe",
      supabaseUrl: env.supabaseUrl,
      serviceRoleKey: env.serviceRoleKey,
    })

    try {
      await loginThroughE2EEndpoint(page.context(), {
        baseURL: env.baseURL,
        email: fixture.user.email,
        password: fixture.user.password,
        secret: env.e2eSecret,
      })

      await page.goto(`${env.baseURL}/projects/${fixture.project.slug}/payments`)

      await expect(page.getByTestId("project-payments-page")).toBeVisible()
      await expect(
        page.getByRole("heading", {
          name: new RegExp(`^${escapeRegExp(fixture.project.name)} Payments$`),
        }),
      ).toBeVisible()
      await expect(page.getByText("Onchain deposit verified with")).toBeVisible()
      await expect(page.getByText("Fixture seeded a failed reconciliation result for retry coverage.")).toBeVisible()
      await expect(page.getByText("Awaiting automatic onchain reconciliation to verify the recorded deposit.").first()).toBeVisible()
      await expect(page.getByRole("button", { name: "Retry crypto payment" })).toBeVisible()
      await expect(page.getByRole("button", { name: "Pay with crypto" }).first()).toBeVisible()
    } finally {
      await fixture.cleanup()
    }
  })

  test("manages crypto routes without touching irreversible onchain state", async ({ page }) => {
    const env = getRemoteE2EEnv()
    test.skip(!env, "Remote-safe Playwright env vars are not configured.")
    if (!env) {
      return
    }

    const fixture = await createProjectPaymentsFixture({
      scenario: "remote-safe",
      supabaseUrl: env.supabaseUrl,
      serviceRoleKey: env.serviceRoleKey,
    })

    try {
      const addCandidate = fixture.routes.available.find(
        (route) =>
          `${route.chainId}-${route.assetId}-${route.intakeContractId}` !==
            `${fixture.routes.primary.chainId}-${fixture.routes.primary.assetId}-${fixture.routes.primary.intakeContractId}` &&
          `${route.chainId}-${route.assetId}-${route.intakeContractId}` !==
            `${fixture.routes.secondary.chainId}-${fixture.routes.secondary.assetId}-${fixture.routes.secondary.intakeContractId}`,
      )

      test.skip(!addCandidate, "Remote-safe route management needs a third active route candidate.")
      if (!addCandidate) {
        return
      }

      await loginThroughE2EEndpoint(page.context(), {
        baseURL: env.baseURL,
        email: fixture.user.email,
        password: fixture.user.password,
        secret: env.e2eSecret,
      })

      await page.goto(`${env.baseURL}/projects/${fixture.project.slug}/payments`)
      await expect(page.getByTestId("crypto-route-manager")).toBeVisible()

      await page.getByTestId("add-crypto-route").click()

      const draftRoute = page.locator('[data-testid^="enabled-route-draft-"]').last()
      await draftRoute.locator('[data-testid^="route-chain-trigger-"]').click()
      await page.getByRole("option", { name: addCandidate.chainDisplayName }).click()
      await draftRoute.locator('[data-testid^="route-token-trigger-"]').click()
      await page.getByRole("option", { name: `${addCandidate.assetSymbol} · ${addCandidate.assetName}` }).click()
      await draftRoute.locator('[data-testid^="route-label-input-"]').fill("Playwright Added Route")
      await draftRoute.locator('[data-testid^="route-save-"]').click()

      await expect(page.locator('[data-testid^="enabled-route-draft-"]')).toHaveCount(0)
      const persistedRoutes = page.locator('[data-testid^="enabled-route-"]:not([data-testid^="enabled-route-draft-"])')
      const createdRoute = persistedRoutes.last()
      await expect(createdRoute.locator('[data-testid^="route-label-input-"]')).toHaveValue("Playwright Added Route")
      const createdRouteTestId = await createdRoute.getAttribute("data-testid")
      expect(createdRouteTestId).toBeTruthy()
      const persistedRoute = page.getByTestId(createdRouteTestId!)

      await persistedRoute.locator('[data-testid^="route-label-input-"]').fill("Playwright Edited Route")
      await persistedRoute.locator('[data-testid^="route-save-"]').click()
      await expect(persistedRoute.locator('[data-testid^="route-label-input-"]')).toHaveValue("Playwright Edited Route")

      await persistedRoute.locator('[data-testid^="route-move-up-"]').click()
      await persistedRoute.locator('[data-testid^="route-move-down-"]').click()
      await persistedRoute.locator('[data-testid^="route-disable-"]').click()

      const disabledRoute = page.locator('[data-testid^="disabled-route-"]').filter({ hasText: "Playwright Edited Route" }).first()
      await expect(disabledRoute).toBeVisible()
      await disabledRoute.locator('[data-testid^="route-enable-"]').click()

      await page.reload()
      await expect(page.getByTestId(createdRouteTestId!).locator('[data-testid^="route-label-input-"]')).toHaveValue(
        "Playwright Edited Route",
      )
    } finally {
      await fixture.cleanup()
    }
  })
})
