import "server-only"

import { invokeServerEdgeCommand } from "./invoke-server"
import {
  MONTHLY_CYCLE_BOOKKEEPING_CREDITS_CREATE_FUNCTION,
  normalizeMonthlyCycleBookkeepingCreditsCreateResult,
  type MonthlyCycleBookkeepingCreditsCreateCommandInput,
} from "./monthly-cycle-bookkeeping-credits-create-contract"

export async function invokeMonthlyCycleBookkeepingCreditsCreateServer(
  input: MonthlyCycleBookkeepingCreditsCreateCommandInput,
) {
  return normalizeMonthlyCycleBookkeepingCreditsCreateResult(
    await invokeServerEdgeCommand<MonthlyCycleBookkeepingCreditsCreateCommandInput, unknown>(
      MONTHLY_CYCLE_BOOKKEEPING_CREDITS_CREATE_FUNCTION,
      input,
    ),
  )
}
