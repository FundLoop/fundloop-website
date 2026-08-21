import "server-only"

import { invokeServerEdgeCommand } from "./invoke-server"
import {
  normalizeProjectMonthlyContributionSubmitResult,
  PROJECT_MONTHLY_CONTRIBUTION_SUBMIT_FUNCTION,
  type ProjectMonthlyContributionSubmitCommandInput,
} from "./project-monthly-contribution-submit-contract"

export async function invokeProjectMonthlyContributionSubmitServer(input: ProjectMonthlyContributionSubmitCommandInput) {
  return normalizeProjectMonthlyContributionSubmitResult(
    await invokeServerEdgeCommand<ProjectMonthlyContributionSubmitCommandInput, unknown>(
      PROJECT_MONTHLY_CONTRIBUTION_SUBMIT_FUNCTION,
      input,
    ),
  )
}
