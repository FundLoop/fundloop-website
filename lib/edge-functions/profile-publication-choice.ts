import { invokeBrowserEdgeCommand } from "./invoke"
import { normalizeProfilePublicationChoiceResult, PROFILE_PUBLICATION_CHOICE_FUNCTION, type ProfilePublicationChoiceInput } from "./profile-publication-choice-contract"
export async function invokeProfilePublicationChoice(input: ProfilePublicationChoiceInput) {
  return normalizeProfilePublicationChoiceResult(await invokeBrowserEdgeCommand<ProfilePublicationChoiceInput, unknown>(PROFILE_PUBLICATION_CHOICE_FUNCTION, input))
}
