import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "../../types/supabase.ts"
import type { ProjectMemberSharedProfile } from "../edge-functions/project-member-shared-profiles-contract.ts"

type Failure = { ok: false; error: { code: string; message: string } }
type Success<T> = { ok: true; data: T }

export async function executeProjectMemberSharedProfilesRead(
  supabase: SupabaseClient<Database>,
  input: { projectId: number; actorUserId: string; reviewRuntimeEnabled: boolean },
): Promise<Success<ProjectMemberSharedProfile[]> | Failure> {
  if (!input.reviewRuntimeEnabled) {
    return { ok: false, error: { code: "review_preview_disabled", message: "Project member review sharing is unavailable in this environment." } }
  }
  const { data, error } = await supabase.rpc("list_project_member_shared_profiles", {
    p_project_id: input.projectId,
    p_actor_user_id: input.actorUserId,
  })
  if (error) return { ok: false, error: { code: "project_member_sharing_read_failed", message: "Project member sharing could not be loaded." } }
  return { ok: true, data: (data ?? []).map((row) => ({
    userId: row.user_id,
    displayName: row.display_name,
    avatarUrl: row.avatar_url,
    profileHeadline: row.profile_headline,
    bio: row.bio,
    occupationName: row.occupation_name,
    locationName: row.location_name,
    isAdmin: row.is_admin,
    sharedProfileFields: row.shared_profile_fields as ProjectMemberSharedProfile["sharedProfileFields"],
  })) }
}
