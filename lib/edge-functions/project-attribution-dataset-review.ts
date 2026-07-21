import { invokeBrowserEdgeCommand } from "./invoke"
import {
  normalizeProjectAttributionDatasetReviewResult,
  PROJECT_ATTRIBUTION_DATASET_REVIEW_FUNCTION,
  type ProjectAttributionDatasetReviewCommandInput,
} from "./project-attribution-dataset-review-contract"

export async function invokeProjectAttributionDatasetReviewBrowser(input: ProjectAttributionDatasetReviewCommandInput) {
  return normalizeProjectAttributionDatasetReviewResult(
    await invokeBrowserEdgeCommand<ProjectAttributionDatasetReviewCommandInput, unknown>(
      PROJECT_ATTRIBUTION_DATASET_REVIEW_FUNCTION,
      input,
    ),
  )
}
