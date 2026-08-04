import { mkdir } from "node:fs/promises"
import path from "node:path"
import { expect, test } from "@playwright/test"
import type { PersonaId, PersonaResult } from "./contracts"
import { parsePersonaSelection } from "../support/persona-selection"
import { createPersonaFixtureController, createPersonaServiceClient, createRunIdentity, createStoredActorWithProfile } from "../support/persona-fixtures"
import { readLocalPersonaEnv } from "../support/persona-env"
import { assertSafePersonaScreenshotSurface, writePersonaResult } from "../support/persona-reporting"

test("@harness:self-test local persona foundation cleans after pass or forced failure", async ({ page, context }) => {
  const outputRoot = process.env.PLAYWRIGHT_PERSONA_OUTPUT_ROOT
  const runId = process.env.PLAYWRIGHT_PERSONA_RUN_ID
  if (!outputRoot || !runId) throw new Error("persona-self-test-env-missing")
  const selected = parsePersonaSelection(process.env.PLAYWRIGHT_PERSONA_SELECTED)
  const run = { ...createRunIdentity(selected), runId }
  const startedAt = Date.now()
  const forceTimeout = process.env.PLAYWRIGHT_PERSONA_FORCE_TIMEOUT === "true"
  if (forceTimeout) test.setTimeout(5_000)
  const env = readLocalPersonaEnv()
  const supabase = createPersonaServiceClient(env)
  const fixtures = createPersonaFixtureController({ run, outputRoot, supabase, ledgerName: forceTimeout ? selected[0] : undefined })
  let forcedFailure = false

  await fixtures.checkpoint()
  await fixtures.markRunning()

  try {
    if (forceTimeout) {
      await createStoredActorWithProfile(supabase, fixtures, "returning-member")
      await new Promise<never>(() => undefined)
    }
    await page.goto("/")
    await expect(page.locator("body")).toBeVisible()
    forcedFailure = process.env.PLAYWRIGHT_PERSONA_FORCE_FAILURE === "true"
    if (forcedFailure) {
      const artifactDirectory = path.join(process.cwd(), "output", "playwright", "persona-harness", runId)
      await mkdir(artifactDirectory, { recursive: true })
      await page.setContent("<main><h1>Sanitized forced-failure probe</h1><p>No private fixture data is rendered.</p></main>")
      await assertSafePersonaScreenshotSurface(page)
      await page.screenshot({ path: path.join(artifactDirectory, "forced-failure.png") })
      await context.tracing.start({ screenshots: true, snapshots: true })
      await page.getByRole("heading", { name: "Sanitized forced-failure probe" }).click()
      await context.tracing.stop({ path: path.join(artifactDirectory, "forced-failure-trace.zip") })
    }
  } finally {
    const cleanup = await fixtures.cleanup()
    const durationMs = Date.now() - startedAt
    for (const personaId of selected) {
      const result: PersonaResult = {
        personaId: personaId as PersonaId,
        status: forcedFailure ? "failed" : "passed",
        durationMs,
        checkpoints: [{
          checkpointId: "harness.self-test",
          capabilityId: "harness-foundation",
          status: forcedFailure ? "fail" : "pass",
          durationMs,
          reasonCode: forcedFailure ? "forced-self-test-failure" : null,
          evidence: { "app-ready": true, "cleanup-path-exercised": true },
        }],
        cleanup,
      }
      await writePersonaResult(outputRoot, runId, result)
    }
  }

  expect(forcedFailure, "forced-failure probe").toBe(false)
})
