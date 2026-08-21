import { expect, test } from "@playwright/test"
import { returningOperatorJourney } from "./journeys"
import { executePersonaJourney } from "../support/persona-journey-runner"
import { createPersonaOperatorActions } from "../support/persona-operator-actions"

test.setTimeout(600_000)

test("@persona:returning-operator executes the monthly cadence journey", async ({ page }) => {
  const scenario = createPersonaOperatorActions(page)
  const result = await executePersonaJourney({
    journey: returningOperatorJourney(scenario.actions),
    outputRoot: scenario.outputRoot,
    runId: scenario.runId,
    cleanup: scenario.fixtures.cleanup,
  })
  expect(result.status).toBe("passed")
})
