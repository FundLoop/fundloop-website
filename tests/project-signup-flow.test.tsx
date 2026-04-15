import React from "react"
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

const refresh = vi.fn()
const push = vi.fn()
const replace = vi.fn()
const toast = vi.fn()
const getOnboardingState = vi.fn()
const invokeProjectOnboardingDraftUpsertBrowser = vi.fn()
const invokeProjectOnboardingDraftClearBrowser = vi.fn()
const invokeProjectOnboardingPublishBrowser = vi.fn()
const invokeUserCubidResolveEmailBrowser = vi.fn()

function createBrowserSupabaseClient() {
  const queryResponse = (data: unknown) => ({
    select() {
      return this
    },
    eq() {
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
        case "ref_categories":
          return queryResponse([])
        case "ref_payment_periodicities":
          return queryResponse([{ id: 1, name: "Monthly", code: "month" }])
        case "ref_chains":
        case "ref_chain_assets":
        case "chain_intake_contracts":
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
}))

vi.mock("@/lib/edge-functions/project-onboarding-draft-upsert", () => ({
  invokeProjectOnboardingDraftUpsertBrowser,
}))

vi.mock("@/lib/edge-functions/project-onboarding-draft-clear", () => ({
  invokeProjectOnboardingDraftClearBrowser,
}))

vi.mock("@/lib/edge-functions/project-onboarding-publish", () => ({
  invokeProjectOnboardingPublishBrowser,
}))

vi.mock("@/lib/edge-functions/user-cubid-resolve-email", () => ({
  invokeUserCubidResolveEmailBrowser,
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

vi.mock("@/components/onboarding/project-preview", () => ({
  ProjectPreview: () => <div>Project preview</div>,
}))

describe("ProjectSignupFlow", () => {
  beforeEach(() => {
    vi.useRealTimers()
    vi.clearAllMocks()
  })

  it("autosaves through the browser upsert adapter", async () => {
    getOnboardingState.mockResolvedValue({
      authUserId: "user-1",
      authEmail: "maya@example.com",
      profile: {
        cubid_identity_status: "linked",
        cubid_id: "cubid-user-1",
        primary_email_identity: "auth-identity-1",
        cubid_score: 77,
      },
      userDraft: null,
      projectDraft: null,
    })
    invokeProjectOnboardingDraftUpsertBrowser.mockResolvedValue({
      ok: true,
      data: {
        id: 3,
        user_id: "user-1",
        current_screen: "basics",
        payload: {},
        started_at: "2026-04-15T00:00:00.000Z",
        updated_at: "2026-04-15T00:00:00.000Z",
        completed_at: null,
      },
    })

    const { default: ProjectSignupFlow } = await import("@/components/project-signup-flow")
    render(<ProjectSignupFlow onClose={vi.fn()} />)

    await screen.findByRole("heading", { name: /link your founder identity with cubid/i })
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /continue/i }))
    })
    await screen.findByLabelText(/project name/i)
    invokeProjectOnboardingDraftUpsertBrowser.mockClear()

    fireEvent.change(screen.getByLabelText(/project name/i), { target: { value: "Civic Mesh" } })

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 700))
    })

    await waitFor(() => {
      expect(invokeProjectOnboardingDraftUpsertBrowser).toHaveBeenCalledWith(
        expect.objectContaining({
          currentScreen: "basics",
          payload: expect.objectContaining({
            name: "Civic Mesh",
            slug: "civic-mesh",
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
        cubid_identity_status: "linked",
        cubid_id: "cubid-user-1",
        primary_email_identity: "auth-identity-1",
        cubid_score: 77,
      },
      userDraft: null,
      projectDraft: {
        id: 4,
        user_id: "user-1",
        current_screen: "review",
        payload: {
          name: "Civic Mesh",
          slug: "civic-mesh",
          website: "https://civicmesh.example.com",
          description: "Routing public transit coordination.",
          contactEmail: "team@civicmesh.example.com",
          detailedDescription: "Longer description",
          categoryIds: ["1"],
          pledgeAccepted: true,
          billingEmail: "finance@civicmesh.example.com",
          billingFrequency: "monthly",
          paymentPercentage: "1.0",
          paymentPeriodicityId: "1",
          cryptoPaymentMethods: [],
        },
        started_at: "2026-04-15T00:00:00.000Z",
        updated_at: "2026-04-15T00:00:00.000Z",
        completed_at: null,
      },
    })
    invokeProjectOnboardingDraftClearBrowser.mockResolvedValue({ ok: true, data: undefined })
    invokeProjectOnboardingPublishBrowser.mockResolvedValue({
      ok: true,
      data: {
        projectSlug: "civic-mesh",
      },
    })

    const onClose = vi.fn()
    const { default: ProjectSignupFlow } = await import("@/components/project-signup-flow")
    const { unmount } = render(<ProjectSignupFlow onClose={onClose} />)

    await screen.findByRole("heading", { name: /you already have a draft project/i })
    fireEvent.click(screen.getByRole("button", { name: /start over/i }))
    await waitFor(() => expect(invokeProjectOnboardingDraftClearBrowser).toHaveBeenCalled())

    unmount()
    render(<ProjectSignupFlow onClose={onClose} />)
    await screen.findByRole("heading", { name: /you already have a draft project/i })
    fireEvent.click(screen.getByRole("button", { name: /continue draft/i }))
    await screen.findByRole("button", { name: /publish project/i })

    fireEvent.click(screen.getByRole("button", { name: /publish project/i }))

    await waitFor(() => {
      expect(invokeProjectOnboardingPublishBrowser).toHaveBeenCalled()
      expect(refresh).toHaveBeenCalled()
      expect(onClose).toHaveBeenCalled()
    })
  })

  it("lets the founder resolve CUBID before continuing to project basics", async () => {
    getOnboardingState.mockResolvedValue({
      authUserId: "user-1",
      authEmail: "maya@example.com",
      profile: {
        cubid_identity_status: "unlinked",
        cubid_id: null,
        primary_email_identity: "auth-identity-1",
        cubid_score: null,
      },
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

    const { default: ProjectSignupFlow } = await import("@/components/project-signup-flow")
    render(<ProjectSignupFlow onClose={vi.fn()} />)

    await screen.findByRole("heading", { name: /link your founder identity with cubid/i })
    fireEvent.click(screen.getByRole("button", { name: /link cubid now/i }))

    await waitFor(() => {
      expect(invokeUserCubidResolveEmailBrowser).toHaveBeenCalled()
      expect(screen.getByText(/cubid-user-1/i)).toBeTruthy()
    })
  })
})
