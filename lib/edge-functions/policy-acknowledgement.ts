import { invokeBrowserEdgeCommand } from "./invoke"
import {
  normalizePolicyAcknowledgementResult,
  POLICY_ACKNOWLEDGEMENT_FUNCTION,
  type PolicyAcknowledgementInput,
} from "./policy-acknowledgement-contract"

export async function invokePolicyAcknowledgement(input: PolicyAcknowledgementInput) {
  return normalizePolicyAcknowledgementResult(
    await invokeBrowserEdgeCommand<PolicyAcknowledgementInput, unknown>(POLICY_ACKNOWLEDGEMENT_FUNCTION, input),
  )
}
