import "server-only"

import { invokeServerEdgeCommand } from "./invoke-server"
import {
  MONTHLY_CYCLE_PAYOUT_INTENTS_CREATE_FUNCTION,
  normalizeMonthlyCyclePayoutIntentsCreateResult,
  type MonthlyCyclePayoutIntentsCreateCommandInput,
} from "./monthly-cycle-payout-intents-create-contract"

export async function invokeMonthlyCyclePayoutIntentsCreateServer(input: MonthlyCyclePayoutIntentsCreateCommandInput) {
  return normalizeMonthlyCyclePayoutIntentsCreateResult(
    await invokeServerEdgeCommand<MonthlyCyclePayoutIntentsCreateCommandInput, unknown>(
      MONTHLY_CYCLE_PAYOUT_INTENTS_CREATE_FUNCTION,
      input,
    ),
  )
}
