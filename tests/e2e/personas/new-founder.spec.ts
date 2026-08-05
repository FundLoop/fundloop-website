import { expect, test } from "@playwright/test"
import { newFounderJourney } from "./journeys"
import { createPersonaBrowserActions } from "../support/persona-browser-actions"
import { executePersonaJourney } from "../support/persona-journey-runner"

test.setTimeout(180_000)

test("@persona:new-founder executes the new founder journey", async ({ page }) => {
  const scenario = createPersonaBrowserActions("new-founder", page)
  const result = await executePersonaJourney({ journey: newFounderJourney(scenario.actions), outputRoot: scenario.outputRoot, runId: scenario.runId, cleanup: scenario.fixtures.cleanup })
  expect(result.status).toBe("incomplete")
})
