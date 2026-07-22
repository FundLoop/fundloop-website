import { invokeBrowserEdgeCommand } from "./invoke"
import {
  MONTHLY_CYCLE_BOOKKEEPING_CREDITS_CREATE_FUNCTION,
  normalizeMonthlyCycleBookkeepingCreditsCreateResult,
  type MonthlyCycleBookkeepingCreditsCreateCommandInput,
} from "./monthly-cycle-bookkeeping-credits-create-contract"

export async function invokeMonthlyCycleBookkeepingCreditsCreateBrowser(
  input: MonthlyCycleBookkeepingCreditsCreateCommandInput,
) {
  return normalizeMonthlyCycleBookkeepingCreditsCreateResult(
    await invokeBrowserEdgeCommand<MonthlyCycleBookkeepingCreditsCreateCommandInput, unknown>(
      MONTHLY_CYCLE_BOOKKEEPING_CREDITS_CREATE_FUNCTION,
      input,
    ),
  )
}
