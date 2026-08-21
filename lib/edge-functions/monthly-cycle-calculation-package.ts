import { invokeBrowserEdgeCommand } from "./invoke"
import {
  MONTHLY_CYCLE_CALCULATION_PACKAGE_FUNCTION,
  normalizeMonthlyCycleCalculationPackageResult,
  type MonthlyCycleCalculationPackageCommandInput,
} from "./monthly-cycle-calculation-package-contract"

export async function invokeMonthlyCycleCalculationPackageBrowser(input: MonthlyCycleCalculationPackageCommandInput) {
  return normalizeMonthlyCycleCalculationPackageResult(
    await invokeBrowserEdgeCommand<MonthlyCycleCalculationPackageCommandInput, unknown>(
      MONTHLY_CYCLE_CALCULATION_PACKAGE_FUNCTION,
      input,
    ),
  )
}
