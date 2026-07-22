import { invokeBrowserEdgeCommand } from "./invoke"
import {
  normalizeProjectAttributionDatasetSubmitResult,
  PROJECT_ATTRIBUTION_DATASET_SUBMIT_FUNCTION,
  type ProjectAttributionDatasetSubmitCommandInput,
} from "./project-attribution-dataset-submit-contract"

export async function invokeProjectAttributionDatasetSubmitBrowser(input: ProjectAttributionDatasetSubmitCommandInput) {
  return normalizeProjectAttributionDatasetSubmitResult(
    await invokeBrowserEdgeCommand<ProjectAttributionDatasetSubmitCommandInput, unknown>(
      PROJECT_ATTRIBUTION_DATASET_SUBMIT_FUNCTION,
      input,
    ),
  )
}
