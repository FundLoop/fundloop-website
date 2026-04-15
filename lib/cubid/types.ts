import type { Database } from "../../types/supabase"

export type CubidIdentityStatus = Database["public"]["Enums"]["cubid_identity_status"]

export type CubidIdentitySnapshot = {
  cubidId: string | null
  primaryEmailIdentity: string | null
  cubidScore: number | null
  cubidIdentityStatus: CubidIdentityStatus
}

export function isResolvedCubidIdentityStatus(status: CubidIdentityStatus | null | undefined) {
  return status === "linked" || status === "verified"
}
