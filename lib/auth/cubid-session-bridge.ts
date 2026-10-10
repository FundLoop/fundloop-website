import "server-only"

import { getAdminSupabaseClient } from "@/lib/supabase-admin"
import { createServerSupabaseClient } from "@/lib/supabase-server"

// Turning a verified Cubid identity into a Supabase session (#275, stage 2c).
//
// Supabase Auth has no generic OIDC provider, and `auth.uid()` is what every RLS policy in this
// schema is written against, so a Cubid sign-in cannot invent its own session: it has to end in a
// real Supabase one. The supported server-side route is the admin API — generate a magic link for
// the account and redeem it in the same request, so no mail is ever sent and nothing is left for
// anyone else to use.
//
// **This signs in whoever holds the address**, which is why the caller must have resolved the
// account first. `generateLink` with `type: "magiclink"` even creates the user when the address is
// unknown. It is called only for an account the Cubid subject already maps to, or one this request
// just created for that subject — never because an email matched.
export async function establishSupabaseSessionForEmail(input: {
  email: string
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const admin = getAdminSupabaseClient()
  const link = await admin.auth.admin.generateLink({ type: "magiclink", email: input.email })
  if (link.error) return { ok: false, error: link.error.code ?? link.error.message }

  const tokenHash = link.data.properties?.hashed_token
  if (!tokenHash) return { ok: false, error: "no_hashed_token" }

  const supabase = await createServerSupabaseClient()
  const { error } = await supabase.auth.verifyOtp({ type: "magiclink", token_hash: tokenHash })
  if (error) return { ok: false, error: error.code ?? error.message }
  return { ok: true }
}
