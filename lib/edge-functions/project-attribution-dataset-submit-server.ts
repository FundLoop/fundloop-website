import "server-only"

import { invokeServerEdgeCommand } from "./invoke-server"
import {
  normalizeProjectAttributionDatasetSubmitResult,
  PROJECT_ATTRIBUTION_DATASET_SUBMIT_FUNCTION,
  type ProjectAttributionDatasetSubmitCommandInput,
} from "./project-attribution-dataset-submit-contract"

export async function invokeProjectAttributionDatasetSubmitServer(input: ProjectAttributionDatasetSubmitCommandInput) {
  return normalizeProjectAttributionDatasetSubmitResult(
    await invokeServerEdgeCommand<ProjectAttributionDatasetSubmitCommandInput, unknown>(
      PROJECT_ATTRIBUTION_DATASET_SUBMIT_FUNCTION,
      input,
    ),
  )
}
