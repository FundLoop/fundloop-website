import "server-only"

import type { Json, Tables } from "../../types/supabase.ts"
import {
  mergeProjectOnboardingPayload,
  type ProjectOnboardingPayload,
  type ProjectOnboardingScreen,
} from "../onboarding.ts"
import type { OnboardingCommandClient } from "./command-utils.ts"
import { getCryptoContractMethodId, parseDecimal, parseInteger } from "./command-utils.ts"

type ProjectDraftCommandFailureCode = "not_authenticated" | "draft_save_failed" | "draft_clear_failed"
type ProjectPublishCommandFailureCode =
  | "draft_not_found"
  | "cubid_identity_required"
  | "project_basics_incomplete"
  | "pledge_required"
  | "invalid_payment_percentage"
  | "project_slug_taken"
  | "invalid_crypto_method"
  | "reference_data_unavailable"
  | "publish_failed"
  | "payment_method_insert_failed"

type ProjectDraftUpsertInput = {
  actorUserId: string
  currentScreen: ProjectOnboardingScreen
  payload: ProjectOnboardingPayload
}

type ProjectDraftClearInput = {
  actorUserId: string
}

type ProjectPublishInput = {
  actorUserId: string
  rpcSupabase?: OnboardingCommandClient
}

type ProjectCommandFailure<TCode extends string> = {
  ok: false
  error: {
    code: TCode
    message: string
  }
}

type ProjectCommandSuccess<T> = {
  ok: true
  data: T
}

export type ProjectDraftUpsertCommandResult =
  | ProjectCommandSuccess<Tables<"project_onboarding_drafts">>
  | ProjectCommandFailure<ProjectDraftCommandFailureCode>

export type ProjectDraftClearCommandResult =
  | ProjectCommandSuccess<undefined>
  | ProjectCommandFailure<ProjectDraftCommandFailureCode>

export type ProjectPublishCommandResult =
  | ProjectCommandSuccess<{ projectSlug: string | null }>
  | ProjectCommandFailure<ProjectPublishCommandFailureCode>

function commandFailure<TCode extends string>(code: TCode, message: string): ProjectCommandFailure<TCode> {
  return {
    ok: false,
    error: {
      code,
      message,
    },
  }
}

export async function executeProjectOnboardingDraftUpsertCommand(
  supabase: OnboardingCommandClient,
  input: ProjectDraftUpsertInput,
): Promise<ProjectDraftUpsertCommandResult> {
  const payload = mergeProjectOnboardingPayload(input.payload)
  const { data, error } = await supabase
    .from("project_onboarding_drafts")
    .upsert(
      {
        user_id: input.actorUserId,
        current_screen: input.currentScreen,
        payload,
        completed_at: null,
      },
      { onConflict: "user_id" },
    )
    .select()
    .single()

  if (error || !data) {
    return commandFailure("draft_save_failed", error?.message ?? "Failed to save project draft")
  }

  return { ok: true, data }
}

export async function executeProjectOnboardingDraftClearCommand(
  supabase: OnboardingCommandClient,
  input: ProjectDraftClearInput,
): Promise<ProjectDraftClearCommandResult> {
  const { error } = await supabase.from("project_onboarding_drafts").delete().eq("user_id", input.actorUserId)

  if (error) {
    return commandFailure("draft_clear_failed", error.message)
  }

  return { ok: true, data: undefined }
}

export async function executeProjectOnboardingPublishCommand(
  supabase: OnboardingCommandClient,
  input: ProjectPublishInput,
): Promise<ProjectPublishCommandResult> {
  const { data: draft, error: draftError } = await supabase
    .from("project_onboarding_drafts")
    .select("*")
    .eq("user_id", input.actorUserId)
    .single()

  if (draftError || !draft) {
    return commandFailure("draft_not_found", draftError?.message ?? "Project draft not found")
  }

  const payload = mergeProjectOnboardingPayload(draft.payload as Partial<ProjectOnboardingPayload>)
  const { data: actorProfile, error: actorProfileError } = await supabase
    .from("users")
    .select("cubid_identity_status")
    .eq("user_id", input.actorUserId)
    .single()

  if (
    actorProfileError ||
    !actorProfile ||
    (actorProfile.cubid_identity_status !== "linked" && actorProfile.cubid_identity_status !== "verified")
  ) {
    return commandFailure(
      "cubid_identity_required",
      "Link your CUBID identity before publishing a FundLoop project.",
    )
  }

  if (!payload.name.trim() || !payload.slug.trim() || !payload.description.trim()) {
    return commandFailure("project_basics_incomplete", "Project basics are incomplete")
  }

  if (!payload.pledgeAccepted) {
    return commandFailure("pledge_required", "The FundLoop pledge must be accepted before publishing")
  }

  if ((parseDecimal(payload.paymentPercentage) ?? 0) < 1) {
    return commandFailure("invalid_payment_percentage", "Project payment percentage must be at least 1")
  }

  const { data: existingProject } = await supabase.from("projects").select("id").eq("slug", payload.slug.trim()).maybeSingle()
  if (existingProject) {
    return commandFailure("project_slug_taken", "A project with this slug already exists")
  }

  const categoryIds = payload.categoryIds
    .map((categoryId) => parseInteger(categoryId))
    .filter((categoryId): categoryId is number => categoryId !== null)

  const normalizedCryptoPaymentMethods = payload.cryptoPaymentMethods.map((method, index) => ({
    index,
    chainId: parseInteger(method.chainId),
    chainAssetId: parseInteger(method.chainAssetId),
    intakeContractId: parseInteger(method.intakeContractId),
    label: method.label.trim(),
    isDefault: method.isDefault,
  }))

  if (
    normalizedCryptoPaymentMethods.some(
      (method) => method.chainId === null || method.chainAssetId === null || method.intakeContractId === null,
    )
  ) {
    return commandFailure("invalid_crypto_method", "Each crypto payment method must include a chain, asset, and contract.")
  }

  let cryptoContractMethodId: number | null = null
  if (normalizedCryptoPaymentMethods.length > 0) {
    try {
      cryptoContractMethodId = await getCryptoContractMethodId(supabase)
    } catch (error) {
      return commandFailure(
        "reference_data_unavailable",
        error instanceof Error ? error.message : "Crypto payment method reference is missing",
      )
    }
  }

  const rpcSupabase = input.rpcSupabase ?? supabase
  const { data: publishedProject, error: publishError } = await rpcSupabase
    .rpc("publish_project_onboarding_draft_atomic", {
      p_name: payload.name.trim(),
      p_slug: payload.slug.trim(),
      p_description: payload.description.trim(),
      p_website: payload.website.trim() || null,
      p_detailed_description: payload.detailedDescription.trim() || null,
      p_logo_url: payload.logoUrl.trim() || null,
      p_contact_email: payload.contactEmail.trim() || null,
      p_billing_email: payload.billingEmail.trim() || null,
      p_billing_frequency: payload.billingFrequency || null,
      p_payment_percentage: parseDecimal(payload.paymentPercentage) ?? 1,
      p_payment_periodicity_id: parseInteger(payload.paymentPeriodicityId),
      p_default_payment_method_id: cryptoContractMethodId,
      p_category_ids: categoryIds,
    } satisfies Record<string, Json>)
    .single()

  if (publishError || !publishedProject) {
    return commandFailure("publish_failed", publishError?.message ?? "Failed to publish project draft")
  }

  if (normalizedCryptoPaymentMethods.length > 0 && cryptoContractMethodId !== null) {
    const hasExplicitDefault = normalizedCryptoPaymentMethods.some((method) => method.isDefault)
    const paymentMethodRows = normalizedCryptoPaymentMethods.map((method) => ({
      project_id: publishedProject.project_id,
      method_id: cryptoContractMethodId,
      collection_mode: "contract" as const,
      chain_id: method.chainId,
      chain_asset_id: method.chainAssetId,
      intake_contract_id: method.intakeContractId,
      is_default: method.isDefault || (method.index === 0 && !hasExplicitDefault),
      is_enabled: true,
      label: method.label || null,
      details: {
        onboarding_source: "project_onboarding_v1",
        preferred_chain_asset_id: method.chainAssetId,
      },
    }))

    const { error: paymentMethodsError } = await supabase.from("payment_methods").insert(paymentMethodRows)
    if (paymentMethodsError) {
      return commandFailure("payment_method_insert_failed", paymentMethodsError.message)
    }
  }

  return { ok: true, data: { projectSlug: publishedProject.project_slug } }
}
