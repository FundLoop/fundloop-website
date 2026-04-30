import { invokeBrowserEdgeCommand } from "./invoke"
import {
  MONTHLY_CYCLE_PAYOUT_INTENTS_CREATE_FUNCTION,
  normalizeMonthlyCyclePayoutIntentsCreateResult,
  type MonthlyCyclePayoutIntentsCreateCommandInput,
} from "./monthly-cycle-payout-intents-create-contract"

export async function invokeMonthlyCyclePayoutIntentsCreateBrowser(input: MonthlyCyclePayoutIntentsCreateCommandInput) {
  return normalizeMonthlyCyclePayoutIntentsCreateResult(
    await invokeBrowserEdgeCommand<MonthlyCyclePayoutIntentsCreateCommandInput, unknown>(
      MONTHLY_CYCLE_PAYOUT_INTENTS_CREATE_FUNCTION,
      input,
    ),
  )
}
