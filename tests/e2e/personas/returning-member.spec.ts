import { expect, test } from "@playwright/test"
import { returningMemberJourney } from "./journeys"
import { createPersonaBrowserActions } from "../support/persona-browser-actions"
import { executePersonaJourney } from "../support/persona-journey-runner"

test.setTimeout(180_000)

test("@persona:returning-member executes the returning member journey", async ({ page }) => {
  const scenario = createPersonaBrowserActions("returning-member", page)
  const result = await executePersonaJourney({ journey: returningMemberJourney(scenario.actions), outputRoot: scenario.outputRoot, runId: scenario.runId, cleanup: scenario.fixtures.cleanup })
  expect(result.status).toBe("incomplete")
})
