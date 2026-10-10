import "server-only"

import { crossAppSignInConfig } from "@/lib/cross-app/config"
import { getAdminSupabaseClient } from "@/lib/supabase-admin"

// Whether a FundLoop account has a Cubid sign-in identity attached (#275, stage 2c UI).
//
// `cubid_oidc_subjects` is service-role only — it is the mapping delegated access is resolved
// through — so this reads it on the server and hands the page a boolean and a date, never the
// subject itself. The pairwise subject is not something to put in a page: it is Cubid's identifier
// for this person at this client, and it has no business in a browser.
//
// Not to be confused with `public.users.cubid_id`, which belongs to the older Cubid Passport API
// integration and is what the rest of the account panel shows.

export type CubidSignInLinkStatus = {
  /** Whether sign-in with Cubid is configured on this deployment at all. */
  available: boolean
  linked: boolean
  linkedAt: string | null
  lastSeenAt: string | null
}

export async function getCubidSignInLinkStatus(userId: string | null | undefined): Promise<CubidSignInLinkStatus> {
  const available = crossAppSignInConfig() !== null
  // No user, or nothing to link to: there is nothing to look up, and asking would construct an
  // admin client that throws where no service-role key is configured — which local and preview
  // deployments support on purpose. The panel renders nothing in that case anyway.
  if (!userId || !available) return { available, linked: false, linkedAt: null, lastSeenAt: null }

  let admin: ReturnType<typeof getAdminSupabaseClient>
  try {
    admin = getAdminSupabaseClient()
  } catch (error) {
    // Configured for Cubid but not for the service role is a misconfiguration, not a reason for the
    // whole account page to fail.
    console.error(`[cubid-link-status] no admin client: ${error instanceof Error ? error.message : "unknown"}`)
    return { available, linked: false, linkedAt: null, lastSeenAt: null }
  }

  const { data, error } = await admin
    .from("cubid_oidc_subjects")
    .select("linked_at, last_seen_at")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle()
  // A read failure must not break the account page: the panel shows "not connected" and the person
  // can try, which fails loudly, rather than the whole page failing quietly.
  if (error) {
    console.error(`[cubid-link-status] could not read the Cubid link for ${userId}: ${error.message}`)
    return { available, linked: false, linkedAt: null, lastSeenAt: null }
  }

  return {
    available,
    linked: Boolean(data),
    linkedAt: data?.linked_at ?? null,
    lastSeenAt: data?.last_seen_at ?? null,
  }
}
