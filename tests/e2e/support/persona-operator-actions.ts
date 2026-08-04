import { mkdir } from "node:fs/promises"
import path from "node:path"
import { expect, type Page } from "@playwright/test"
import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import { MONTHLY_CYCLE_BOOKKEEPING_CREDITS_CREATE_FUNCTION, normalizeMonthlyCycleBookkeepingCreditsCreateResult } from "../../../lib/edge-functions/monthly-cycle-bookkeeping-credits-create-contract"
import { invokeEdgeCommandWithClient } from "../../../lib/edge-functions/invoke"
import { buildZkasRunArtifactPath, STORAGE_BUCKETS } from "../../../lib/storage/artifacts"
import type { Database } from "../../../types/supabase"
import type { CheckpointObservation } from "../personas/contracts"
import type { PersonaJourneyActions } from "../personas/journeys"
import { loginThroughE2EEndpoint } from "./e2e-login"
import { readLocalPersonaEnv } from "./persona-env"
import {
  arrangeOperatorCadenceInputs,
  createPersonaFixtureController,
  createPersonaServiceClient,
  createRunIdentity,
  resolveSeededOperator,
  type PersonaCadenceInputFixture,
} from "./persona-fixtures"
import { createCycleClock } from "./persona-monthly-cycle"
import { assertSupportedRequiredInputOverrideFailure, PERSONA_REQUIRED_INPUT_OVERRIDE_REASON } from "./persona-operator-audit"
import { assertSafePersonaScreenshotSurface } from "./persona-reporting"

const observed = (evidence: CheckpointObservation["evidence"] = {}): CheckpointObservation => ({ outcome: "observed", evidence })

const REQUIRED_EVENT_TYPES = [
  "lock_attempt",
  "lock_success",
  "calculation_package_attempt",
  "calculation_package_success",
  "verification_review",
  "approval_review",
  "bookkeeping_credits_create_attempt",
  "bookkeeping_credits_create_success",
] as const

export function createPersonaOperatorActions(page: Page) {
  const env = readLocalPersonaEnv()
  const runId = process.env.PLAYWRIGHT_PERSONA_RUN_ID ?? ""
  if (!runId) throw new Error("persona-run-id-missing")
  const run = createRunIdentity(["returning-operator"])
  Object.assign(run, { runId, startedAt: process.env.PLAYWRIGHT_PERSONA_STARTED_AT ?? run.startedAt })
  const supabase = createPersonaServiceClient(env) as SupabaseClient<Database>
  const fixtures = createPersonaFixtureController({ run, supabase, outputRoot: process.env.PLAYWRIGHT_PERSONA_OUTPUT_ROOT, ledgerName: "returning-operator" })
  const cycleKey = createCycleClock(env.cycleBase).cycleKeyFor("returning-operator")
  const browserErrors: string[] = []
  let scenario: PersonaCadenceInputFixture | null = null
  let runIdValue: number | null = null

  page.setDefaultTimeout(15_000)
  page.setDefaultNavigationTimeout(20_000)
  page.on("console", (message) => {
    if (message.type() === "error") browserErrors.push("console-error")
  })
  page.on("pageerror", () => browserErrors.push("page-error"))

  const requireScenario = () => {
    if (!scenario) throw new Error("persona-operator-scenario-missing")
    return scenario
  }

  async function login(email: string, password: string) {
    await loginThroughE2EEndpoint(page.context(), {
      baseURL: env.baseURL,
      email,
      password,
      secret: process.env.FUNDLOOP_E2E_SECRET ?? "",
    })
  }

  async function capture(name: string) {
    if (page.viewportSize()?.width !== 1440 || page.viewportSize()?.height !== 1100) throw new Error("persona-screenshot-viewport-invalid")
    await page.evaluate(() => {
      const sensitive = /(?:[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}|[^\s@]+@[^\s@]+\.[^\s@]+)/gi
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
      while (walker.nextNode()) {
        const node = walker.currentNode
        if (node.textContent && sensitive.test(node.textContent)) node.textContent = node.textContent.replace(sensitive, "sanitized-actor")
        sensitive.lastIndex = 0
      }
    })
    await assertSafePersonaScreenshotSurface(page)
    const directory = path.join(process.cwd(), "output", "playwright", "feature-96", runId)
    await mkdir(directory, { recursive: true })
    await page.screenshot({ path: path.join(directory, `${name}.png`), fullPage: false })
  }

  async function expectCycleStatus(status: string) {
    await expect.poll(async () => {
      const result = await supabase.from("monthly_cycles").select("status").eq("cycle_key", cycleKey).single()
      return result.error ? null : result.data?.status
    }, { timeout: 45_000 }).toBe(status)
  }

  const actions: PersonaJourneyActions = {
    "auth.login-returning-operator": async () => {
      const operator = await resolveSeededOperator(supabase)
      scenario = await arrangeOperatorCadenceInputs(supabase, fixtures, { cycleKey, operatorUserId: operator.actor.authUserId })
      await login(operator.email, operator.password)
      await page.goto(`${env.baseURL}/en/admin/cycles`)
      await expect(page.getByRole("heading", { name: "Monthly Cycles" })).toBeVisible()
      await expect(page.getByText(cycleKey).first()).toBeVisible()
      return observed({ session: "authorized", cycle: "arranged" })
    },
    "operator.view-cycle-readiness": async () => {
      await page.goto(`${env.baseURL}/en/admin/cycles/${cycleKey}/prep`)
      await expect(page.getByRole("heading", { name: `${cycleKey} prep workspace` })).toBeVisible()
      await expect(page.getByText("Contribution submissions", { exact: true })).toBeVisible()
      await expect(page.getByText("MVP Attribution", { exact: true })).toBeVisible()
      await capture("admin-cycle-prep")
      return observed({ readiness: "visible", capture: "admin-cycle-prep" })
    },
    "operator.lock-cycle": async () => {
      await page.goto(`${env.baseURL}/en/admin/cycles`)
      const row = page.getByRole("row").filter({ hasText: cycleKey })
      await row.getByRole("button", { name: "Lock", exact: true }).click()
      const overrideDialog = page.getByRole("dialog", { name: /Override missing MVP monthly inputs/i })
      await Promise.race([
        overrideDialog.waitFor({ state: "visible", timeout: 10_000 }).catch(() => undefined),
        expect.poll(async () => {
          const result = await supabase.from("monthly_cycles").select("status").eq("cycle_key", cycleKey).single()
          return result.data?.status
        }, { timeout: 10_000 }).not.toBe("open").catch(() => undefined),
      ])
      let overrideApplied = false
      if (await overrideDialog.isVisible().catch(() => false)) {
        overrideApplied = true
        await overrideDialog.getByLabel("Required override reason").fill(PERSONA_REQUIRED_INPUT_OVERRIDE_REASON)
        await overrideDialog.getByRole("button", { name: "Lock with override" }).click()
      }
      await expectCycleStatus("locked")
      return observed({ status: "locked", override: overrideApplied })
    },
    "operator.calculate-cycle": async () => {
      const current = requireScenario()
      await page.goto(`${env.baseURL}/en/admin/cycles/${cycleKey}/zkas`)
      await page.getByRole("button", { name: "Package calculation inputs" }).click()
      await expectCycleStatus("calculation")
      const runQuery = await supabase.from("zkas_runs").select("id, result_artifact_path").eq("monthly_cycle_id", current.cycleId).eq("status", "completed").single()
      if (runQuery.error || !runQuery.data?.result_artifact_path) throw new Error("persona-operator-calculation-run-missing")
      runIdValue = runQuery.data.id
      await fixtures.recordStoragePath(`${STORAGE_BUCKETS.zkasRuns}/${buildZkasRunArtifactPath({ cycleKey, cycleId: current.cycleId, artifact: "calculation-package" })}`)
      await fixtures.recordStoragePath(`${STORAGE_BUCKETS.zkasRuns}/${buildZkasRunArtifactPath({ cycleKey, runId: runIdValue, artifact: "run-manifest" })}`)
      await fixtures.recordStoragePath(`${STORAGE_BUCKETS.zkasRuns}/${runQuery.data.result_artifact_path}`)
      await page.goto(`${env.baseURL}/en/admin/cycles/${cycleKey}/verification`)
      await expect(page.getByText("Calculated MVP allocation")).toBeVisible()
      await expect(page.getByText("$10").first()).toBeVisible()
      await capture("admin-calculation")
      return observed({ status: "calculation", allocated: 10, capture: "admin-calculation" })
    },
    "operator.verify-cycle": async () => {
      if (!runIdValue) throw new Error("persona-operator-run-id-missing")
      await page.goto(`${env.baseURL}/en/admin/superadmin/zkas/runs/${runIdValue}`)
      await page.getByRole("button", { name: "Mark Verified", exact: true }).click()
      await expect.poll(async () => {
        const query = await supabase.from("zkas_runs").select("verification_status").eq("id", runIdValue as number).single()
        return query.data?.verification_status
      }, { timeout: 30_000 }).toBe("verified")
      await page.goto(`${env.baseURL}/en/admin/cycles/${cycleKey}/verification`)
      await page.getByPlaceholder("Required review note").fill("Persona harness verification")
      await page.getByRole("button", { name: "Mark cycle verified" }).click()
      await expectCycleStatus("verification")
      return observed({ run: "verified", cycle: "verified" })
    },
    "operator.approve-cycle": async () => {
      await page.goto(`${env.baseURL}/en/admin/cycles/${cycleKey}/verification`)
      await page.getByPlaceholder("Required review note").fill("Persona harness approval")
      await page.getByRole("button", { name: "Approve for bookkeeping credits" }).click()
      await expectCycleStatus("approval")
      return observed({ status: "approval" })
    },
    "operator.create-bookkeeping-credits": async () => {
      const operator = await resolveSeededOperator(supabase)
      const actorClient = createClient<Database>(env.supabaseUrl, env.anonKey, { auth: { autoRefreshToken: false, persistSession: false } })
      const session = await actorClient.auth.signInWithPassword({ email: operator.email, password: operator.password })
      if (session.error || !session.data.session) throw new Error("persona-operator-command-auth-failed")
      const result = normalizeMonthlyCycleBookkeepingCreditsCreateResult(await invokeEdgeCommandWithClient(
        actorClient,
        MONTHLY_CYCLE_BOOKKEEPING_CREDITS_CREATE_FUNCTION,
        { cycleKey, attemptId: `${runId}-bookkeeping` },
      ))
      if (!result.ok) throw new Error(`persona-bookkeeping-${result.error.code.replaceAll("_", "-")}`)
      if (!result.data.noPayoutExecuted || result.data.totalCreditedUsd !== 10 || result.data.creditedCount !== 1) {
        throw new Error("persona-bookkeeping-output-mismatch")
      }
      await page.goto(`${env.baseURL}/en/admin/cycles/${cycleKey}/payouts`)
      await expect(page.getByText(/1 credited rows, not paid yet/i)).toBeVisible()
      await expect(page.getByText("$10").first()).toBeVisible()
      await capture("admin-distribution")
      return observed({ status: "distribution", credited: 10, paid: false, capture: "admin-distribution" })
    },
    "operator.view-performance": async () => {
      const current = requireScenario()
      const [events, cycle] = await Promise.all([
        supabase.from("monthly_cycle_events").select("actor_user_id, attempt_id, event_type, message, metadata, outcome").eq("monthly_cycle_id", current.cycleId),
        supabase.from("monthly_cycles").select("locked_manifest, lock_override_reason").eq("id", current.cycleId).single(),
      ])
      if (events.error || cycle.error || !cycle.data) throw new Error("persona-operator-events-query-failed")
      const eventTypes = new Set((events.data ?? []).map((event) => event.event_type))
      if (REQUIRED_EVENT_TYPES.some((event) => !eventTypes.has(event))) throw new Error("persona-operator-events-incomplete")
      assertSupportedRequiredInputOverrideFailure({
        cycle: cycle.data,
        events: events.data ?? [],
        operatorUserId: current.operatorUserId,
      })
      const failures = (events.data ?? []).filter((event) => event.outcome === "failure")
      await page.goto(`${env.baseURL}/en/admin/cycles/observability?cycleKey=${cycleKey}`)
      await expect(page.getByRole("heading", { name: "Cycle Events" })).toBeVisible()
      await expect(page.getByText(cycleKey).first()).toBeVisible()
      await capture("admin-observability")
      return observed({ events: REQUIRED_EVENT_TYPES.length, failures: failures.length, capture: "admin-observability" })
    },
    "operator.view-allocation-breakdown": async () => {
      const current = requireScenario()
      const [credits, projectRows] = await Promise.all([
        supabase.from("monthly_cycle_bookkeeping_credits").select("usd_equivalent_amount, payment_status, source_breakdown").eq("monthly_cycle_id", current.cycleId),
        supabase.from("monthly_cycle_allocation_project_results").select("project_id, user_id, raw_usd").eq("monthly_cycle_id", current.cycleId),
      ])
      if (credits.error || projectRows.error || credits.data?.length !== 1 || projectRows.data?.length !== 1) throw new Error("persona-operator-allocation-missing")
      if (Number(credits.data[0].usd_equivalent_amount) !== 10 || credits.data[0].payment_status !== "not_paid" || projectRows.data[0].project_id !== current.project.id) {
        throw new Error("persona-operator-allocation-mismatch")
      }
      await page.goto(`${env.baseURL}/en/admin/cycles/${cycleKey}/verification`)
      await expect(page.getByText("Raw project entitlements")).toBeVisible()
      await capture("admin-allocation")

      await login(current.founder.email, current.founder.password)
      await page.goto(`${env.baseURL}/en/founder/projects/${current.project.slug}/reporting`)
      await expect(page.getByText("$10").first()).toBeVisible()
      await expect(page.getByText(/not paid/i).first()).toBeVisible()
      await capture("founder-distribution-readback")

      await login(current.member.email, current.member.password)
      await page.goto(`${env.baseURL}/en/workspace/earnings`)
      await expect(page.getByText("$10").first()).toBeVisible()
      await expect(page.getByText(current.project.name).first()).toBeVisible()
      await expect(page.getByText(/not paid/i).first()).toBeVisible()
      await capture("member-earnings-readback")
      if (browserErrors.length > 0) throw new Error(`persona-browser-${browserErrors[0]}`)
      return observed({ users: 1, projects: 1, allocated: 10, paid: false, capture: "integrated-readback" })
    },
  }

  return {
    actions,
    fixtures,
    outputRoot: process.env.PLAYWRIGHT_PERSONA_OUTPUT_ROOT ?? path.join(process.cwd(), "output", "persona-harness"),
    runId,
  }
}
