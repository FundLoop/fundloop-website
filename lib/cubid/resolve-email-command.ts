import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "../../types/supabase"
import { resolveCubidIdentityByEmail } from "./resolve-by-email"
import { type CubidIdentitySnapshot, isResolvedCubidIdentityStatus } from "./types"

type CubidResolutionCommandFailureCode =
  | "missing_email"
  | "profile_load_failed"
  | "profile_update_failed"
  | "cubid_resolution_failed"

type CubidResolutionCommandFailure = {
  ok: false
  error: {
    code: CubidResolutionCommandFailureCode
    message: string
  }
}

type CubidResolutionCommandSuccess = {
  ok: true
  data: CubidIdentitySnapshot
}

export type CubidResolutionCommandResult = CubidResolutionCommandSuccess | CubidResolutionCommandFailure

type CubidResolutionCommandInput = {
  actorUserId: string
  actorEmail: string | null
}

type CubidUserRow = Pick<
  Database["public"]["Tables"]["users"]["Row"],
  "cubid_id" | "cubid_identity_status" | "cubid_score" | "primary_email_identity"
>

function commandFailure(
  code: CubidResolutionCommandFailureCode,
  message: string,
): CubidResolutionCommandFailure {
  return {
    ok: false,
    error: {
      code,
      message,
    },
  }
}

export async function executeResolveCubidIdentityByEmailCommand(
  supabase: SupabaseClient<Database>,
  input: CubidResolutionCommandInput,
): Promise<CubidResolutionCommandResult> {
  const actorEmail = input.actorEmail?.trim().toLowerCase() ?? ""
  if (!actorEmail) {
    return commandFailure("missing_email", "A signed-in email address is required before CUBID can be linked.")
  }

  const { data: existingUser, error: existingUserError } = await supabase
    .from("users")
    .select("cubid_id, cubid_identity_status, cubid_score, primary_email_identity")
    .eq("user_id", input.actorUserId)
    .single<CubidUserRow>()

  if (existingUserError || !existingUser) {
    return commandFailure("profile_load_failed", existingUserError?.message ?? "Failed to load the user profile.")
  }

  if (existingUser.cubid_id && isResolvedCubidIdentityStatus(existingUser.cubid_identity_status)) {
    return {
      ok: true,
      data: {
        cubidId: existingUser.cubid_id,
        primaryEmailIdentity: existingUser.primary_email_identity,
        cubidScore: existingUser.cubid_score,
        cubidIdentityStatus: existingUser.cubid_identity_status,
      },
    }
  }

  let resolvedIdentity: CubidIdentitySnapshot

  try {
    resolvedIdentity = await resolveCubidIdentityByEmail({
      email: actorEmail,
      primaryEmailIdentity: existingUser.primary_email_identity,
    })
  } catch (error) {
    return commandFailure(
      "cubid_resolution_failed",
      error instanceof Error ? error.message : "Failed to resolve CUBID identity for this email.",
    )
  }

  const nextPrimaryEmailIdentity = existingUser.primary_email_identity ?? resolvedIdentity.primaryEmailIdentity
  const { error: updateError } = await supabase
    .from("users")
    .update({
      cubid_id: resolvedIdentity.cubidId,
      cubid_score: resolvedIdentity.cubidScore,
      cubid_identity_status: resolvedIdentity.cubidIdentityStatus,
      ...(nextPrimaryEmailIdentity ? { primary_email_identity: nextPrimaryEmailIdentity } : {}),
    })
    .eq("user_id", input.actorUserId)

  if (updateError) {
    return commandFailure("profile_update_failed", updateError.message)
  }

  return {
    ok: true,
    data: {
      cubidId: resolvedIdentity.cubidId,
      primaryEmailIdentity: nextPrimaryEmailIdentity,
      cubidScore: resolvedIdentity.cubidScore,
      cubidIdentityStatus: resolvedIdentity.cubidIdentityStatus,
    },
  }
}
