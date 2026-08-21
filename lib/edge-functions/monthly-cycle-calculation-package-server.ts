import "server-only"

import { invokeServerEdgeCommand } from "./invoke-server"
import {
  MONTHLY_CYCLE_CALCULATION_PACKAGE_FUNCTION,
  normalizeMonthlyCycleCalculationPackageResult,
  type MonthlyCycleCalculationPackageCommandInput,
} from "./monthly-cycle-calculation-package-contract"

export async function invokeMonthlyCycleCalculationPackageServer(input: MonthlyCycleCalculationPackageCommandInput) {
  return normalizeMonthlyCycleCalculationPackageResult(
    await invokeServerEdgeCommand<MonthlyCycleCalculationPackageCommandInput, unknown>(
      MONTHLY_CYCLE_CALCULATION_PACKAGE_FUNCTION,
      input,
    ),
  )
}
