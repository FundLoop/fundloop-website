import { expect, test } from "@playwright/test"
import { createHash } from "node:crypto"
import { createE2EClient, createProjectPaymentsFixture } from "../support/supabase-fixtures"
import { getLocalWalletE2EEnv } from "../support/env"
import { loginThroughE2EEndpoint } from "../support/e2e-login"
import { connectInjectedLocalWallet, installInjectedLocalWallet } from "../support/local-wallet-provider"

export const LOCAL_WALLET_SUBMISSION_TIMEOUT_MS = 60_000
export const LOCAL_WALLET_PAYMENT_TEST_TIMEOUT_MS = 180_000

function hashToHex(seed: string) {
  return `0x${createHash("sha256").update(seed).digest("hex")}`
}

async function acknowledgeProjectFundingTerms(page: import("@playwright/test").Page) {
  const checkbox = page.getByRole("checkbox", {
    name: "I reviewed the non-effective Terms preview and understand this is only a test acknowledgement.",
  })
  await expect(checkbox).toBeVisible()
  await checkbox.check()
  const acknowledgement = page.waitForResponse((response) =>
    response.url().includes("/functions/v1/policy-acknowledgement-record") && response.request().method() === "POST")
  await page.getByRole("button", { name: "Record review acknowledgement" }).click()
  expect((await acknowledgement).ok()).toBe(true)
  await expect(page.getByText("Review acknowledgement recorded. The simulated boundary is unlocked for this page session only.")).toBeVisible()
}

async function rpcRequest<T>(url: string, method: string, params: unknown[]) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: Date.now(),
      method,
      params,
    }),
  })

  const body = (await response.json()) as { result?: T; error?: { message?: string } }
  if (body.error) {
    throw new Error(body.error.message ?? `RPC ${method} failed`)
  }

  return body.result as T
}

test.describe("local-wallet project payments", () => {
  test("submits a real local wallet payment and reconciles it to confirmed", async ({ page }) => {
    test.setTimeout(LOCAL_WALLET_PAYMENT_TEST_TIMEOUT_MS)
    const env = getLocalWalletE2EEnv()
    test.skip(!env, "Local wallet Playwright env vars are not configured.")
    if (!env) {
      return
    }

    await installInjectedLocalWallet(page.context(), {
      rpcUrl: env.rpcUrl,
      chainId: env.chainId,
      account: env.injectedAccount,
    })

    const fixture = await createProjectPaymentsFixture({
      scenario: "local-wallet",
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
      await acknowledgeProjectFundingTerms(page)

      await page.getByTestId(`pay-with-crypto-${fixture.payments.draftId}`).click()
      await expect(page.getByTestId("project-crypto-payment-dialog")).toBeVisible()

      await connectInjectedLocalWallet(page)
      await expect(page.getByTestId("approve-token-button")).toBeVisible()
      await page.getByTestId("approve-token-button").click()

      await expect(page.getByTestId("submit-crypto-payment-button")).toBeVisible()
      await page.getByTestId("submit-crypto-payment-button").click()

      await expect(page.getByTestId("project-crypto-payment-dialog")).not.toBeVisible({
        timeout: LOCAL_WALLET_SUBMISSION_TIMEOUT_MS,
      })
      const awaitingRow = page.getByTestId(`payment-row-${fixture.payments.draftId}`)
      await expect(awaitingRow).toContainText("Awaiting automatic onchain reconciliation")

      const reconcileResponse = await page.context().request.post(`${env.baseURL}/api/internal/payments/reconcile-onchain`, {
        headers: {
          authorization: `Bearer ${env.cronSecret}`,
        },
        data: {
          paymentId: fixture.payments.draftId,
        },
      })

      expect(reconcileResponse.ok()).toBeTruthy()
      await page.reload()

      await expect(page.getByTestId(`payment-row-${fixture.payments.draftId}`)).toContainText("Confirmed")
    } finally {
      await fixture.cleanup()
    }
  })

  test("marks a mismatched local submission failed and exposes the retry action", async ({ page }) => {
    const env = getLocalWalletE2EEnv()
    test.skip(!env, "Local wallet Playwright env vars are not configured.")
    if (!env) {
      return
    }

    const treasuryAddress = process.env.PLAYWRIGHT_LOCAL_TREASURY_ADDRESS?.trim()
    test.skip(!treasuryAddress, "Local wallet treasury address is not configured.")

    const supabase = createE2EClient({
      supabaseUrl: env.supabaseUrl,
      serviceRoleKey: env.serviceRoleKey,
    })

    const fixture = await createProjectPaymentsFixture({
      scenario: "local-wallet",
      supabaseUrl: env.supabaseUrl,
      serviceRoleKey: env.serviceRoleKey,
    })

    try {
      const transferHash = await rpcRequest<string>(env.rpcUrl, "eth_sendTransaction", [
        {
          from: env.injectedAccount,
          to: treasuryAddress,
          value: "0x1",
        },
      ])

      const { data: awaitingStatus, error: awaitingStatusError } = await supabase
        .from("ref_payment_statuses")
        .select("id")
        .eq("code", "awaiting_confirmation")
        .single()

      if (!awaitingStatus?.id || awaitingStatusError) {
        throw new Error("Could not load local awaiting_confirmation status.")
      }

      const { error: paymentError } = await supabase
        .from("payments")
        .update({
          status_id: awaitingStatus.id,
          paid_at: new Date().toISOString(),
        })
        .eq("id", fixture.payments.pendingId)

      if (paymentError) {
        throw new Error(paymentError.message)
      }

      const { error: submissionError } = await supabase.from("onchain_payment_submissions").insert({
        payment_id: fixture.payments.pendingId,
        project_id: fixture.project.id,
        payment_method_id: fixture.routes.primary.paymentMethodId,
        chain_id: fixture.routes.primary.chainId,
        chain_asset_id: fixture.routes.primary.assetId,
        intake_contract_id: fixture.routes.primary.intakeContractId,
        chain_network_key: fixture.routes.primary.networkKey,
        intake_contract_address: fixture.routes.primary.contractAddress,
        intake_treasury_address: fixture.routes.primary.treasuryAddress,
        intake_abi_version: fixture.routes.primary.abiVersion,
        asset_token_address: fixture.routes.primary.tokenAddress,
        asset_is_native: fixture.routes.primary.assetIsNative,
        wallet_address: env.injectedAccount,
        tx_hash: transferHash ?? hashToHex(`local-wallet-mismatch-${fixture.runId}`),
        amount_raw: "150000000",
        amount_decimal: 150,
        period_id: 2,
        status: "submitted",
        confirmation_count: 0,
        receipt: null,
        metadata: {
          source: "playwright_local_mismatch",
        },
      })

      if (submissionError) {
        throw new Error(submissionError.message)
      }

      await loginThroughE2EEndpoint(page.context(), {
        baseURL: env.baseURL,
        email: fixture.user.email,
        password: fixture.user.password,
        secret: env.e2eSecret,
      })

      await page.goto(`${env.baseURL}/projects/${fixture.project.slug}/payments`)

      const reconcileResponse = await page.context().request.post(`${env.baseURL}/api/internal/payments/reconcile-onchain`, {
        headers: {
          authorization: `Bearer ${env.cronSecret}`,
        },
        data: {
          paymentId: fixture.payments.pendingId,
        },
      })

      expect(reconcileResponse.ok()).toBeTruthy()
      await page.reload()

      const failedRow = page.getByTestId(`payment-row-${fixture.payments.pendingId}`)
      await expect(failedRow).toContainText("Failed")
      await expect(failedRow).toContainText("Retry crypto payment")
    } finally {
      await fixture.cleanup()
    }
  })
})
