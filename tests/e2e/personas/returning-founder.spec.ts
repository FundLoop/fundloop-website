import { expect, test } from "@playwright/test"
import { returningFounderJourney } from "./journeys"
import { createPersonaBrowserActions } from "../support/persona-browser-actions"
import { executePersonaJourney } from "../support/persona-journey-runner"

test.setTimeout(180_000)

test("@persona:returning-founder executes the returning founder journey", async ({ page }) => {
  const scenario = createPersonaBrowserActions("returning-founder", page)
  const result = await executePersonaJourney({ journey: returningFounderJourney(scenario.actions), outputRoot: scenario.outputRoot, runId: scenario.runId, cleanup: scenario.fixtures.cleanup })
  expect(result.status).toBe("passed")
})
