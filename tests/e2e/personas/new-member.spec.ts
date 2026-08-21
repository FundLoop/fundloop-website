import { expect, test } from "@playwright/test"
import { newMemberJourney } from "./journeys"
import { createPersonaBrowserActions } from "../support/persona-browser-actions"
import { executePersonaJourney } from "../support/persona-journey-runner"

test.setTimeout(180_000)

test("@persona:new-member executes the new member journey", async ({ page }) => {
  const scenario = createPersonaBrowserActions("new-member", page)
  const result = await executePersonaJourney({ journey: newMemberJourney(scenario.actions), outputRoot: scenario.outputRoot, runId: scenario.runId, cleanup: scenario.fixtures.cleanup })
  expect(result.status).toBe("passed")
})
