import { describe, expect, it } from "vitest"
import {
  executeUserOnboardingDraftClearCommand,
  executeUserOnboardingDraftUpsertCommand,
  executeUserOnboardingPublishCommand,
} from "@/lib/onboarding/user-onboarding-commands"

function createQueryResponse(response: unknown) {
  return {
    select() {
      return this
    },
    eq() {
      return this
    },
    maybeSingle() {
      return Promise.resolve(response)
    },
    single() {
      return Promise.resolve(response)
    },
    upsert() {
      return this
    },
    delete() {
      return this
    },
    update() {
      return this
    },
    insert() {
      return this
    },
    then(onFulfilled: (value: unknown) => unknown, onRejected?: (reason: unknown) => unknown) {
      return Promise.resolve(response).then(onFulfilled, onRejected)
    },
  }
}

function createSupabaseMock(responsesByTable: Record<string, unknown[]>) {
  const counters = new Map<string, number>()

  return {
    from(table: string) {
      const nextIndex = counters.get(table) ?? 0
      counters.set(table, nextIndex + 1)
      return createQueryResponse(responsesByTable[table]?.[nextIndex] ?? { data: null, error: null })
    },
  }
}

describe("user onboarding commands", () => {
  it("upserts a user onboarding draft", async () => {
    const supabase = createSupabaseMock({
      user_onboarding_drafts: [
        {
          data: {
            id: 7,
            user_id: "user-1",
            current_screen: "identity",
            payload: {},
            started_at: "2026-04-15T00:00:00.000Z",
            updated_at: "2026-04-15T00:00:00.000Z",
            completed_at: null,
          },
          error: null,
        },
      ],
    })

    await expect(
      executeUserOnboardingDraftUpsertCommand(supabase as never, {
        actorUserId: "user-1",
        currentScreen: "identity",
        payload: {
          fullName: "Maya",
          displayName: "",
          profileHeadline: "",
          avatarUrl: "",
          bio: "",
          occupationId: "",
          locationId: "",
          genderId: "",
          interestIds: [],
          inviteCode: "",
          privacyPreset: "limited",
          visibility: {
            isPublic: true,
            isNamePublic: true,
            isPfpPublic: true,
            isGenderPublic: false,
            isOccupationPublic: true,
            isLocationPublic: true,
            isBirthyearPublic: false,
            isBirthdayPublic: false,
          },
          relationshipChoice: "individual",
          selectedProjectId: null,
        },
      }),
    ).resolves.toEqual({
      ok: true,
      data: expect.objectContaining({ id: 7, current_screen: "identity" }),
    })
  })

  it("clears a user onboarding draft", async () => {
    const supabase = createSupabaseMock({
      user_onboarding_drafts: [{ data: null, error: null }],
    })

    await expect(
      executeUserOnboardingDraftClearCommand(supabase as never, { actorUserId: "user-1" }),
    ).resolves.toEqual({ ok: true, data: undefined })
  })

  it("publishes a user onboarding draft and returns the next flow", async () => {
    const supabase = createSupabaseMock({
      user_onboarding_drafts: [
        {
          data: {
            id: 8,
            user_id: "user-1",
            current_screen: "review",
            payload: {
              fullName: "Maya Torres",
              displayName: "",
              profileHeadline: "Builder",
              avatarUrl: "",
              bio: "Bio",
              occupationId: "1",
              locationId: "2",
              genderId: "3",
              interestIds: ["4"],
              inviteCode: "invite-1",
              privacyPreset: "limited",
              visibility: {
                isPublic: true,
                isNamePublic: true,
                isPfpPublic: true,
                isGenderPublic: false,
                isOccupationPublic: true,
                isLocationPublic: true,
                isBirthyearPublic: false,
                isBirthdayPublic: false,
              },
              relationshipChoice: "create_project",
              selectedProjectId: null,
            },
            started_at: "2026-04-15T00:00:00.000Z",
            updated_at: "2026-04-15T00:00:00.000Z",
            completed_at: null,
          },
          error: null,
        },
        { data: null, error: null },
      ],
      users: [
        { data: { invited_by_code: null, cubid_identity_status: "linked" }, error: null },
        { data: null, error: null },
      ],
      user_interests: [{ data: null, error: null }, { data: null, error: null }],
      invitation_codes: [{ data: { usage_count: 2 }, error: null }, { data: null, error: null }],
    })

    await expect(
      executeUserOnboardingPublishCommand(supabase as never, {
        actorUserId: "user-1",
        actorEmail: "maya@example.com",
      }),
    ).resolves.toEqual({
      ok: true,
      data: {
        nextFlow: "project",
        relationshipChoice: "create_project",
      },
    })
  })

  it("returns a clear failure when the user draft is missing", async () => {
    const supabase = createSupabaseMock({
      user_onboarding_drafts: [{ data: null, error: null }],
    })

    await expect(
      executeUserOnboardingPublishCommand(supabase as never, {
        actorUserId: "user-1",
        actorEmail: "maya@example.com",
      }),
    ).resolves.toEqual({
      ok: false,
      error: {
        code: "draft_not_found",
        message: "User draft not found",
      },
    })
  })

  it("blocks publish when the user has not linked CUBID yet", async () => {
    const supabase = createSupabaseMock({
      user_onboarding_drafts: [
        {
          data: {
            id: 8,
            user_id: "user-1",
            current_screen: "review",
            payload: {
              fullName: "Maya Torres",
              relationshipChoice: "individual",
            },
            started_at: "2026-04-15T00:00:00.000Z",
            updated_at: "2026-04-15T00:00:00.000Z",
            completed_at: null,
          },
          error: null,
        },
      ],
      users: [{ data: { invited_by_code: null, cubid_identity_status: "unlinked" }, error: null }],
    })

    await expect(
      executeUserOnboardingPublishCommand(supabase as never, {
        actorUserId: "user-1",
        actorEmail: "maya@example.com",
      }),
    ).resolves.toEqual({
      ok: false,
      error: {
        code: "cubid_identity_required",
        message: "Link your CUBID identity before publishing your FundLoop profile.",
      },
    })
  })
})
