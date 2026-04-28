import { invokeServerEdgeCommand } from "./invoke-server"
import {
  MONTHLY_CYCLE_LOCK_FUNCTION,
  normalizeMonthlyCycleLockResult,
  type MonthlyCycleLockCommandInput,
} from "./monthly-cycle-lock-contract"

export async function invokeMonthlyCycleLockServer(input: MonthlyCycleLockCommandInput) {
  return normalizeMonthlyCycleLockResult(
    await invokeServerEdgeCommand<MonthlyCycleLockCommandInput, unknown>(MONTHLY_CYCLE_LOCK_FUNCTION, input),
  )
}
