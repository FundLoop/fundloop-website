import { invokeBrowserEdgeCommand } from "./invoke"
import { edgeCommandFailure, edgeCommandSuccess, type EdgeCommandResult } from "./result"
import {
  EPOCH_PROJECT_PACKAGE_WORKFLOW_FUNCTION,
  isEpochProjectPackageWorkflowOutput,
  type EpochProjectPackageWorkflowInput,
  type EpochProjectPackageWorkflowOutput,
} from "./epoch-project-package-contract"

export function normalizeEpochProjectPackageWorkflowResult(result: EdgeCommandResult<unknown>): EdgeCommandResult<EpochProjectPackageWorkflowOutput> {
  if (!result.ok) return result
  return isEpochProjectPackageWorkflowOutput(result.data)
    ? edgeCommandSuccess(result.data)
    : edgeCommandFailure("invalid_edge_response", "Project package workflow returned an invalid response.")
}

export async function invokeEpochProjectPackageWorkflowBrowser(input: EpochProjectPackageWorkflowInput) {
  return normalizeEpochProjectPackageWorkflowResult(
    await invokeBrowserEdgeCommand<EpochProjectPackageWorkflowInput, unknown>(EPOCH_PROJECT_PACKAGE_WORKFLOW_FUNCTION, input),
  )
}
