import { invokeServerEdgeCommand } from "./invoke-server"
import { normalizeEpochProjectPackageWorkflowResult } from "./epoch-project-package-workflow"
import {
  EPOCH_PROJECT_PACKAGE_WORKFLOW_FUNCTION,
  type EpochProjectPackageWorkflowInput,
} from "./epoch-project-package-contract"

export async function invokeEpochProjectPackageWorkflowServer(input: EpochProjectPackageWorkflowInput) {
  return normalizeEpochProjectPackageWorkflowResult(
    await invokeServerEdgeCommand<EpochProjectPackageWorkflowInput, unknown>(EPOCH_PROJECT_PACKAGE_WORKFLOW_FUNCTION, input),
  )
}
