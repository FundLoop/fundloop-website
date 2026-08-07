import { expect, test } from "@playwright/test"
import { returningOperatorJourney } from "../personas/journeys"
import { executePersonaJourney } from "../support/persona-journey-runner"
import { createPersonaOperatorActions } from "../support/persona-operator-actions"
import type { LocalPersonaEnv } from "../support/persona-env"

function required(name: string) {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`hosted-smoke-env-missing-${name.toLowerCase().replaceAll("_", "-")}`)
  return value
}

test.setTimeout(600_000)

test("@hosted-operator executes the dev founder/operator/member cadence", async ({ page }) => {
  if (process.env.FUNDLOOP_DEPLOYMENT_ENV !== "dev") throw new Error("hosted-smoke-target-not-dev")
  const baseURL = required("PLAYWRIGHT_REMOTE_BASE_URL")
  const supabaseUrl = required("PLAYWRIGHT_REMOTE_SUPABASE_URL")
  const baseHostname = new URL(baseURL).hostname
  if (baseHostname !== "fundloop-website.vercel.app" && !/^fundloop-website-[a-z0-9]+-cubid-team\.vercel\.app$/.test(baseHostname)) {
    throw new Error("hosted-smoke-base-url-refused")
  }
  if (new URL(supabaseUrl).hostname !== "kyxtqnfnksvcaugxwzuj.supabase.co") throw new Error("hosted-smoke-supabase-refused")
  const protectionBypassCookie = process.env.VERCEL_PROTECTION_BYPASS_COOKIE?.trim()
  if (protectionBypassCookie) {
    await page.context().addCookies([{
      name: "_vercel_jwt",
      value: protectionBypassCookie,
      domain: baseHostname,
      path: "/",
      httpOnly: true,
      secure: true,
      sameSite: "Lax",
    }])
  }
  const protectionProbe = await page.context().request.get(`${baseURL}/en/admin/cycles`, { maxRedirects: 0 })
  const loginProbe = await page.context().request.post(`${baseURL}/api/internal/e2e/login`, {
    headers: { "x-fundloop-e2e-secret": required("FUNDLOOP_E2E_SECRET") },
    data: { email: "maya@fundloop.example.com", password: required("FUNDLOOP_PERSONA_OPERATOR_PASSWORD") },
  })
  console.log(JSON.stringify({ hostedPreviewProbe: { protectionStatus: protectionProbe.status(), loginStatus: loginProbe.status() } }))
  if (!loginProbe.ok()) throw new Error("hosted-smoke-login-probe-failed")
  const env: LocalPersonaEnv = {
    baseURL,
    supabaseUrl,
    anonKey: required("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    serviceRoleKey: required("PLAYWRIGHT_REMOTE_SUPABASE_SERVICE_ROLE_KEY"),
    mailpitUrl: "http://127.0.0.1:55324",
    cycleBase: "2032-01",
  }
  const scenario = createPersonaOperatorActions(page, {
    env,
    operatorPassword: required("FUNDLOOP_PERSONA_OPERATOR_PASSWORD"),
    ensureOperatorProfile: true,
    ignoreWalletProviderConsoleErrors: true,
  })
  const result = await executePersonaJourney({
    journey: returningOperatorJourney(scenario.actions),
    outputRoot: scenario.outputRoot,
    runId: scenario.runId,
    cleanup: scenario.fixtures.cleanup,
  })
  expect(result.status).toBe("passed")
})
