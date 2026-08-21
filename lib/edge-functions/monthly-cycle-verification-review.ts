import { invokeBrowserEdgeCommand } from "./invoke"
import {
  MONTHLY_CYCLE_VERIFICATION_REVIEW_FUNCTION,
  normalizeMonthlyCycleVerificationReviewResult,
  type MonthlyCycleVerificationReviewCommandInput,
} from "./monthly-cycle-verification-review-contract"

export async function invokeMonthlyCycleVerificationReviewBrowser(input: MonthlyCycleVerificationReviewCommandInput) {
  return normalizeMonthlyCycleVerificationReviewResult(
    await invokeBrowserEdgeCommand<MonthlyCycleVerificationReviewCommandInput, unknown>(
      MONTHLY_CYCLE_VERIFICATION_REVIEW_FUNCTION,
      input,
    ),
  )
}
