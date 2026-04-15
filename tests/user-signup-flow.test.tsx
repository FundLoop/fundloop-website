import React from "react"
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

const refresh = vi.fn()
const push = vi.fn()
const replace = vi.fn()
const toast = vi.fn()
const getOnboardingState = vi.fn()
const searchProjectsForTeamMember = vi.fn()
const invokeUserOnboardingDraftUpsertBrowser = vi.fn()
const invokeUserOnboardingDraftClearBrowser = vi.fn()
const invokeUserOnboardingPublishBrowser = vi.fn()
const invokeUserCubidResolveEmailBrowser = vi.fn()
const invokeUserCubidSyncProfileBrowser = vi.fn()

function createBrowserSupabaseClient() {
  const queryResponse = (data: unknown) => ({
    select() {
      return this
    },
    order() {
      return Promise.resolve({ data, error: null })
    },
  })

  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-1", email: "maya@example.com" } } }),
      onAuthStateChange: vi.fn().mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } }),
    },
    from(table: string) {
      switch (table) {
        case "ref_genders":
        case "ref_interests":
        case "ref_locations":
        case "ref_occupations":
          return queryResponse([])
        default:
          return queryResponse([])
      }
    },
  }
}

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh, push, replace }),
}))

vi.mock("@/app/actions/onboarding-actions", () => ({
  getOnboardingState,
  searchProjectsForTeamMember,
}))

vi.mock("@/lib/edge-functions/user-onboarding-draft-upsert", () => ({
  invokeUserOnboardingDraftUpsertBrowser,
}))

vi.mock("@/lib/edge-functions/user-onboarding-draft-clear", () => ({
  invokeUserOnboardingDraftClearBrowser,
}))

vi.mock("@/lib/edge-functions/user-onboarding-publish", () => ({
  invokeUserOnboardingPublishBrowser,
}))

vi.mock("@/lib/edge-functions/user-cubid-resolve-email", () => ({
  invokeUserCubidResolveEmailBrowser,
}))

vi.mock("@/lib/edge-functions/user-cubid-sync-profile", () => ({
  invokeUserCubidSyncProfileBrowser,
}))

vi.mock("@/lib/supabase", () => ({
  getSupabaseBrowserClient: () => createBrowserSupabaseClient(),
}))

vi.mock("@/components/ui/use-toast", () => ({
  toast,
}))

vi.mock("@/components/onboarding/onboarding-shell", () => ({
  OnboardingShell: ({
    title,
    description,
    footer,
    children,
  }: {
    title: string
    description: string
    footer?: React.ReactNode
    children: React.ReactNode
  }) => (
    <div>
      <h1>{title}</h1>
      <p>{description}</p>
      <div>{children}</div>
      <div>{footer}</div>
    </div>
  ),
}))

vi.mock("@/components/onboarding/onboarding-auth-step", () => ({
  OnboardingAuthStep: () => <div>Auth step</div>,
}))

vi.mock("@/components/onboarding/user-profile-preview", () => ({
  UserProfilePreview: () => <div>Profile preview</div>,
}))

describe("UserSignupFlow", () => {
  beforeEach(() => {
    vi.useRealTimers()
    vi.clearAllMocks()
    searchProjectsForTeamMember.mockResolvedValue({ ok: true, data: [] })
    invokeUserCubidSyncProfileBrowser.mockResolvedValue({
      ok: true,
      data: {
        cubidId: "cubid-user-1",
        primaryEmailIdentity: "auth-identity-1",
        cubidScore: 81,
        cubidIdentityStatus: "linked",
        cubidSnapshot: null,
        missingRecommendedStamps: ["phone", "github"],
      },
    })
  })

  it("autosaves through the browser upsert adapter", async () => {
    getOnboardingState.mockResolvedValue({
      authUserId: "user-1",
      authEmail: "maya@example.com",
      profile: {
        user_id: "user-1",
        status: "inactive",
        full_name: null,
        display_name: null,
        avatar_url: null,
        cubid_identity_status: "linked",
        cubid_id: "cubid-user-1",
        primary_email_identity: "auth-identity-1",
        cubid_score: 77,
      },
      cubidSnapshot: null,
      profileCompletionPercent: 70,
      profileCompletionMissingItems: ["cubid_provider"],
      cubidPassportOrigin: "https://passport.cubid.me",
      cubidStampPageId: "123",
      userDraft: {
        id: 11,
        user_id: "user-1",
        current_screen: "identity",
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
        started_at: "2026-04-15T00:00:00.000Z",
        updated_at: "2026-04-15T00:00:00.000Z",
        completed_at: null,
      },
      projectDraft: null,
    })
    invokeUserOnboardingDraftUpsertBrowser.mockResolvedValue({
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

    const { default: UserSignupFlow } = await import("@/components/user-signup-flow")
    render(<UserSignupFlow onClose={vi.fn()} />)

    await screen.findByRole("heading", { name: /you already have a draft profile/i })
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /continue draft/i }))
    })

    await screen.findByRole("heading", { name: /set the profile details fundloop still owns/i })
    await screen.findByLabelText(/public display name/i)
    invokeUserOnboardingDraftUpsertBrowser.mockClear()

    fireEvent.change(screen.getByLabelText(/public display name/i), { target: { value: "Maya Torres" } })

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 700))
    })

    await waitFor(() => {
      expect(invokeUserOnboardingDraftUpsertBrowser).toHaveBeenCalledWith(
        expect.objectContaining({
          currentScreen: "identity",
          payload: expect.objectContaining({
            displayName: "Maya Torres",
          }),
        }),
      )
    })
  })

  it("uses browser clear and publish adapters from resume and review", async () => {
    getOnboardingState.mockResolvedValue({
      authUserId: "user-1",
      authEmail: "maya@example.com",
      profile: {
        user_id: "user-1",
        status: "inactive",
        full_name: null,
        display_name: null,
        avatar_url: null,
        cubid_identity_status: "linked",
        cubid_id: "cubid-user-1",
        primary_email_identity: "auth-identity-1",
        cubid_score: 77,
      },
      cubidSnapshot: null,
      profileCompletionPercent: 70,
      profileCompletionMissingItems: ["cubid_provider"],
      cubidPassportOrigin: "https://passport.cubid.me",
      cubidStampPageId: "123",
      userDraft: {
        id: 2,
        user_id: "user-1",
        current_screen: "review",
        payload: {
          fullName: "Maya Torres",
          profileHeadline: "Builder",
          relationshipChoice: "create_project",
        },
        started_at: "2026-04-15T00:00:00.000Z",
        updated_at: "2026-04-15T00:00:00.000Z",
        completed_at: null,
      },
      projectDraft: null,
    })
    invokeUserOnboardingDraftClearBrowser.mockResolvedValue({ ok: true, data: undefined })
    invokeUserOnboardingPublishBrowser.mockResolvedValue({
      ok: true,
      data: {
        nextFlow: "project",
        relationshipChoice: "create_project",
      },
    })

    const onRequestFlowChange = vi.fn()
    const { default: UserSignupFlow } = await import("@/components/user-signup-flow")
    const { unmount } = render(<UserSignupFlow onClose={vi.fn()} onRequestFlowChange={onRequestFlowChange} />)

    await screen.findByRole("heading", { name: /you already have a draft profile/i })
    fireEvent.click(screen.getByRole("button", { name: /start over/i }))
    await waitFor(() => expect(invokeUserOnboardingDraftClearBrowser).toHaveBeenCalled())

    unmount()
    render(<UserSignupFlow onClose={vi.fn()} onRequestFlowChange={onRequestFlowChange} />)
    await screen.findByRole("heading", { name: /you already have a draft profile/i })
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /continue draft/i }))
    })
    await screen.findByRole("heading", { name: /review and publish your profile/i })
    await screen.findByRole("button", { name: /publish profile/i })

    fireEvent.click(screen.getByRole("button", { name: /publish profile/i }))

    await waitFor(() => {
      expect(invokeUserOnboardingPublishBrowser).toHaveBeenCalled()
      expect(refresh).toHaveBeenCalled()
      expect(onRequestFlowChange).toHaveBeenCalledWith("project")
    })
  })

  it("lets the user resolve CUBID from onboarding before continuing", async () => {
    getOnboardingState.mockResolvedValue({
      authUserId: "user-1",
      authEmail: "maya@example.com",
      profile: {
        user_id: "user-1",
        status: "inactive",
        full_name: null,
        display_name: null,
        avatar_url: null,
        cubid_identity_status: "unlinked",
        cubid_id: null,
        primary_email_identity: "auth-identity-1",
        cubid_score: null,
      },
      cubidSnapshot: null,
      profileCompletionPercent: 20,
      profileCompletionMissingItems: ["cubid_phone", "cubid_provider"],
      cubidPassportOrigin: "https://passport.cubid.me",
      cubidStampPageId: "123",
      userDraft: null,
      projectDraft: null,
    })
    invokeUserCubidResolveEmailBrowser.mockResolvedValue({
      ok: true,
      data: {
        cubidId: "cubid-user-1",
        primaryEmailIdentity: "auth-identity-1",
        cubidScore: 81,
        cubidIdentityStatus: "linked",
      },
    })

    const { default: UserSignupFlow } = await import("@/components/user-signup-flow")
    render(<UserSignupFlow onClose={vi.fn()} />)

    await screen.findByRole("heading", { name: /a better start for new fundloop members/i })
    fireEvent.click(screen.getByRole("button", { name: /continue/i }))
    await screen.findByRole("heading", { name: /link your identity with cubid/i })

    fireEvent.click(screen.getByRole("button", { name: /link cubid now/i }))

    await waitFor(() => {
      expect(invokeUserCubidResolveEmailBrowser).toHaveBeenCalled()
      expect(screen.getByText(/cubid-user-1/i)).toBeTruthy()
    })
  })
})
