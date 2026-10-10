import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "../../types/supabase.ts"
import { edgeCommandFailure, edgeCommandSuccess, type EdgeCommandResult } from "../edge-functions/result.ts"
import type { CubidIdentityDisconnectOutput } from "../edge-functions/cubid-identity-contract.ts"

// Disconnecting a Cubid identity (#275, stage 2c UI).
//
// Framework-free so the Edge Function can import it directly, and so the rule below is testable
// without a Deno runtime.

export async function executeCubidIdentityDisconnectCommand(
  admin: SupabaseClient<Database>,
  actorUserId: string,
): Promise<EdgeCommandResult<CubidIdentityDisconnectOutput>> {
  // Disconnecting must never leave somebody unable to get back in. Every FundLoop account currently
  // has an email address — including one created by Cubid sign-in, which sets a confirmed one — so
  // the email code path is always available and this check cannot fire today. It is here because
  // the invariant is the point: if an account ever exists without one, the Cubid link is that
  // person's only way in and removing it would lock them out of their own account.
  const account = await admin.auth.admin.getUserById(actorUserId)
  if (account.error || !account.data.user) {
    return edgeCommandFailure("account_unavailable", "Your account could not be read. Please try again.")
  }
  if (!account.data.user.email) {
    return edgeCommandFailure(
      "last_sign_in_method",
      "Cubid is the only way to sign in to this account. Add an email address first, then disconnect Cubid.",
    )
  }

  const { data, error } = await admin.rpc("unlink_cubid_subject", { p_user_id: actorUserId })
  if (error) return edgeCommandFailure("unlink_failed", error.message)

  const row = data?.[0]
  if (!row) return edgeCommandFailure("unlink_failed", "Disconnecting Cubid returned no outcome.")
  if (row.outcome !== "unlinked" && row.outcome !== "not_linked") {
    return edgeCommandFailure("unlink_failed", `Disconnecting Cubid reported ${row.outcome}.`)
  }

  return edgeCommandSuccess({ outcome: row.outcome, revokedClients: row.revoked_clients ?? 0 })
}
