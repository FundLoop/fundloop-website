import { beforeEach, describe, expect, it, vi } from "vitest"

const invokeBrowserEdgeCommand = vi.fn()
const invokeServerEdgeCommand = vi.fn()

vi.mock("@/lib/edge-functions/invoke", () => ({
  invokeBrowserEdgeCommand,
}))

vi.mock("@/lib/edge-functions/invoke-server", () => ({
  invokeServerEdgeCommand,
}))

describe("onboarding edge adapters", () => {
  beforeEach(() => {
    vi.resetModules()
    invokeBrowserEdgeCommand.mockReset()
    invokeServerEdgeCommand.mockReset()
  })

  it("passes through a valid user draft browser response", async () => {
    invokeBrowserEdgeCommand.mockResolvedValue({
      ok: true,
      data: {
        id: 1,
        user_id: "user-1",
        current_screen: "identity",
        payload: {},
        started_at: "2026-04-15T00:00:00.000Z",
        updated_at: "2026-04-15T00:00:00.000Z",
        completed_at: null,
      },
    })

    const { invokeUserOnboardingDraftUpsertBrowser } = await import("@/lib/edge-functions/user-onboarding-draft-upsert")
    await expect(
      invokeUserOnboardingDraftUpsertBrowser({
        currentScreen: "identity",
        payload: {
          fullName: "",
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
      data: expect.objectContaining({ id: 1, current_screen: "identity" }),
    })
  })

  it("passes through a declared project publish server failure", async () => {
    invokeServerEdgeCommand.mockResolvedValue({
      ok: false,
      error: {
        code: "project_slug_taken",
        message: "A project with this slug already exists",
      },
    })

    const { invokeProjectOnboardingPublishServer } = await import("@/lib/edge-functions/project-onboarding-publish-server")
    await expect(invokeProjectOnboardingPublishServer()).resolves.toEqual({
      ok: false,
      error: {
        code: "project_slug_taken",
        message: "A project with this slug already exists",
      },
    })
  })

  it("rejects invalid clear payloads from the transport", async () => {
    invokeBrowserEdgeCommand.mockResolvedValue({
      ok: true,
      data: { unexpected: true },
    })

    const { invokeUserOnboardingDraftClearBrowser } = await import("@/lib/edge-functions/user-onboarding-draft-clear")
    await expect(invokeUserOnboardingDraftClearBrowser()).resolves.toEqual({
      ok: false,
      error: {
        code: "invalid_edge_response",
        message: "Edge Function user-onboarding-draft-clear returned an invalid clear response.",
      },
    })
  })
})
