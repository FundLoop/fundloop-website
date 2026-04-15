import { describe, expect, it } from "vitest"
import { buildCubidIdentityReadModel } from "@/lib/cubid/read-model"

describe("buildCubidIdentityReadModel", () => {
  it("marks identity fields as synced when the CUBID snapshot provides them", () => {
    const model = buildCubidIdentityReadModel(
      {
        fullName: "Legacy Name",
        displayName: "Maya",
        profileHeadline: "Builder",
        bio: "Bio",
        occupationId: 1,
        locationId: 2,
        cubidIdentityStatus: "verified",
      },
      {
        user_id: "user-1",
        cubid_user_id: "cubid-user-1",
        primary_name: "Maya Torres",
        primary_email: "maya@example.com",
        primary_phone: "+15555550123",
        cubid_score: 91,
        available_stamp_types: ["email", "phone"],
        verified_stamp_types: ["email", "phone"],
        raw_identity: {},
        raw_stamps: [],
        last_synced_at: "2026-04-15T15:00:00.000Z",
        last_sync_error_code: null,
        last_sync_error_message: null,
      },
      2,
    )

    expect(model.managedIdentity.fullName).toEqual({
      value: "Maya Torres",
      state: "synced",
    })
    expect(model.managedIdentity.primaryEmail.state).toBe("synced")
    expect(model.profileCompletionMissingItems).not.toContain("profile_headline")
  })

  it("falls back to the legacy local full name until CUBID has one", () => {
    const model = buildCubidIdentityReadModel(
      {
        fullName: "Legacy Name",
        displayName: "Maya",
        profileHeadline: null,
        bio: null,
        occupationId: null,
        locationId: null,
        cubidIdentityStatus: "linked",
      },
      null,
      0,
    )

    expect(model.managedIdentity.fullName).toEqual({
      value: "Legacy Name",
      state: "legacy_local_fallback",
    })
    expect(model.managedIdentity.primaryPhone.state).toBe("pending")
    expect(model.profileCompletionMissingItems).toContain("profile_headline")
  })
})
