import { invokeBrowserEdgeCommand } from "./invoke"
import {
  normalizeProjectMonthlyContributionSubmitResult,
  PROJECT_MONTHLY_CONTRIBUTION_SUBMIT_FUNCTION,
  type ProjectMonthlyContributionSubmitCommandInput,
} from "./project-monthly-contribution-submit-contract"

export async function invokeProjectMonthlyContributionSubmitBrowser(input: ProjectMonthlyContributionSubmitCommandInput) {
  return normalizeProjectMonthlyContributionSubmitResult(
    await invokeBrowserEdgeCommand<ProjectMonthlyContributionSubmitCommandInput, unknown>(
      PROJECT_MONTHLY_CONTRIBUTION_SUBMIT_FUNCTION,
      input,
    ),
  )
}
