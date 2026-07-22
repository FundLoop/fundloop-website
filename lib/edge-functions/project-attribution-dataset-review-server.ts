import { invokeServerEdgeCommand } from "./invoke-server"
import {
  normalizeProjectAttributionDatasetReviewResult,
  PROJECT_ATTRIBUTION_DATASET_REVIEW_FUNCTION,
  type ProjectAttributionDatasetReviewCommandInput,
} from "./project-attribution-dataset-review-contract"

export async function invokeProjectAttributionDatasetReviewServer(input: ProjectAttributionDatasetReviewCommandInput) {
  return normalizeProjectAttributionDatasetReviewResult(
    await invokeServerEdgeCommand<ProjectAttributionDatasetReviewCommandInput, unknown>(
      PROJECT_ATTRIBUTION_DATASET_REVIEW_FUNCTION,
      input,
    ),
  )
}
