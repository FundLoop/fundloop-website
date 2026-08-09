import { describe, expect, it, vi } from "vitest"
import { executeProjectMemberSharedProfilesRead } from "@/lib/invitations/project-member-shared-profiles-command"
import {
  normalizeProjectMemberSharedProfilesReadResult,
  validateProjectMemberSharedProfilesReadInput,
} from "@/lib/edge-functions/project-member-shared-profiles-contract"
import { edgeCommandSuccess } from "@/lib/edge-functions/result"

describe("project member shared profile Edge boundary", () => {
  it("denies the service-role read command when the production review gate is closed", async () => {
    const rpc = vi.fn()
    const result = await executeProjectMemberSharedProfilesRead({ rpc } as never, {
      projectId: 7, actorUserId: "actor-1", reviewRuntimeEnabled: false,
    })
    expect(result).toEqual({ ok: false, error: {
      code: "review_preview_disabled", message: "Project member review sharing is unavailable in this environment.",
    } })
    expect(rpc).not.toHaveBeenCalled()
  })

  it("allows local/dev Edge reads and passes only the authenticated actor to the scoped RPC", async () => {
    const rpc = vi.fn(async () => ({ data: [{
      user_id: "member-1", display_name: "Member", avatar_url: null, profile_headline: null, bio: null,
      occupation_name: null, location_name: null, is_admin: false, shared_profile_fields: ["display_name"],
    }], error: null }))
    const result = await executeProjectMemberSharedProfilesRead({ rpc } as never, {
      projectId: 7, actorUserId: "verified-actor", reviewRuntimeEnabled: true,
    })
    expect(result).toEqual({ ok: true, data: [expect.objectContaining({ userId: "member-1", displayName: "Member" })] })
    expect(rpc).toHaveBeenCalledWith("list_project_member_shared_profiles", {
      p_project_id: 7, p_actor_user_id: "verified-actor",
    })
  })

  it("validates crafted project ids and rejects unsafe Edge response fields", () => {
    expect(validateProjectMemberSharedProfilesReadInput({ projectId: -1 }).ok).toBe(false)
    expect(normalizeProjectMemberSharedProfilesReadResult(edgeCommandSuccess([{
      userId: "member-1", displayName: "Member", avatarUrl: null, profileHeadline: null, bio: null,
      occupationName: null, locationName: null, isAdmin: false, sharedProfileFields: ["private_email"],
    }])).ok).toBe(false)
  })
})
