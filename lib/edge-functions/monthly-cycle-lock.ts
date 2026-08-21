import { invokeBrowserEdgeCommand } from "./invoke"
import {
  MONTHLY_CYCLE_LOCK_FUNCTION,
  normalizeMonthlyCycleLockResult,
  type MonthlyCycleLockCommandInput,
} from "./monthly-cycle-lock-contract"

export async function invokeMonthlyCycleLockBrowser(input: MonthlyCycleLockCommandInput) {
  return normalizeMonthlyCycleLockResult(
    await invokeBrowserEdgeCommand<MonthlyCycleLockCommandInput, unknown>(MONTHLY_CYCLE_LOCK_FUNCTION, input),
  )
}
