import { describe, expect, it, vi } from "vitest"
import {
  executeProjectOnboardingDraftClearCommand,
  executeProjectOnboardingDraftUpsertCommand,
  executeProjectOnboardingPublishCommand,
} from "@/lib/onboarding/project-onboarding-commands"

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
    insert() {
      return this
    },
    then(onFulfilled: (value: unknown) => unknown, onRejected?: (reason: unknown) => unknown) {
      return Promise.resolve(response).then(onFulfilled, onRejected)
    },
  }
}

function createSupabaseMock(responsesByTable: Record<string, unknown[]>, rpcResponses?: Record<string, unknown>) {
  const counters = new Map<string, number>()

  return {
    from(table: string) {
      const nextIndex = counters.get(table) ?? 0
      counters.set(table, nextIndex + 1)
      return createQueryResponse(responsesByTable[table]?.[nextIndex] ?? { data: null, error: null })
    },
    rpc(name: string) {
      return {
        single() {
          return Promise.resolve(rpcResponses?.[name] ?? { data: null, error: null })
        },
      }
    },
  }
}

describe("project onboarding commands", () => {
  it("upserts a project onboarding draft", async () => {
    const supabase = createSupabaseMock({
      project_onboarding_drafts: [
        {
          data: {
            id: 9,
            user_id: "user-1",
            current_screen: "basics",
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
      executeProjectOnboardingDraftUpsertCommand(supabase as never, {
        actorUserId: "user-1",
        currentScreen: "basics",
        payload: {
          name: "Civic Mesh",
          slug: "civic-mesh",
          logoUrl: "",
          website: "https://civicmesh.example.com",
          description: "Routing public transit coordination.",
          contactEmail: "team@civicmesh.example.com",
          detailedDescription: "",
          categoryIds: [],
          pledgeAccepted: false,
          billingEmail: "",
          billingFrequency: "monthly",
          paymentPercentage: "1.0",
          paymentPeriodicityId: "1",
          cryptoPaymentMethods: [],
        },
      }),
    ).resolves.toEqual({
      ok: true,
      data: expect.objectContaining({ id: 9, current_screen: "basics" }),
    })
  })

  it("clears a project onboarding draft", async () => {
    const supabase = createSupabaseMock({
      project_onboarding_drafts: [{ data: null, error: null }],
    })

    await expect(
      executeProjectOnboardingDraftClearCommand(supabase as never, { actorUserId: "user-1" }),
    ).resolves.toEqual({ ok: true, data: undefined })
  })

  it("publishes a project draft and inserts configured crypto methods", async () => {
    const supabase = createSupabaseMock(
      {
        project_onboarding_drafts: [
          {
            data: {
              id: 10,
              user_id: "user-1",
              current_screen: "review",
              payload: {
                name: "Civic Mesh",
                slug: "civic-mesh",
                logoUrl: "",
                website: "https://civicmesh.example.com",
                description: "Routing public transit coordination.",
                contactEmail: "team@civicmesh.example.com",
                detailedDescription: "Longer description",
                categoryIds: ["2"],
                pledgeAccepted: true,
                billingEmail: "finance@civicmesh.example.com",
                billingFrequency: "monthly",
                paymentPercentage: "1.5",
                paymentPeriodicityId: "1",
                cryptoPaymentMethods: [
                  {
                    id: "method-1",
                    chainId: "10",
                    chainAssetId: "11",
                    intakeContractId: "12",
                    label: "Base USDC",
                    isDefault: true,
                  },
                ],
              },
              started_at: "2026-04-15T00:00:00.000Z",
              updated_at: "2026-04-15T00:00:00.000Z",
              completed_at: null,
            },
            error: null,
          },
        ],
        users: [{ data: { cubid_identity_status: "linked" }, error: null }],
        projects: [{ data: null, error: null }],
        ref_payment_methods: [{ data: { id: 55 }, error: null }],
        payment_methods: [{ data: null, error: null }],
      },
      {
        publish_project_onboarding_draft_atomic: {
          data: { project_id: 99, project_slug: "civic-mesh" },
          error: null,
        },
      },
    )

    await expect(
      executeProjectOnboardingPublishCommand(supabase as never, { actorUserId: "user-1" }),
    ).resolves.toEqual({
      ok: true,
      data: {
        projectSlug: "civic-mesh",
      },
    })
  })

  it("uses the authenticated RPC client when publishing from an Edge Function", async () => {
    const rpc = vi.fn(() => ({
      single() {
        return Promise.resolve({
          data: { project_id: 99, project_slug: "civic-mesh" },
          error: null,
        })
      },
    }))
    const rpcSupabase = { rpc }
    const supabase = createSupabaseMock({
      project_onboarding_drafts: [
        {
          data: {
            id: 10,
            user_id: "user-1",
            current_screen: "review",
            payload: {
              name: "Civic Mesh",
              slug: "civic-mesh",
              logoUrl: "",
              website: "",
              description: "Routing public transit coordination.",
              contactEmail: "",
              detailedDescription: "",
              categoryIds: [],
              pledgeAccepted: true,
              billingEmail: "",
              billingFrequency: "monthly",
              paymentPercentage: "1.5",
              paymentPeriodicityId: "",
              cryptoPaymentMethods: [],
            },
            started_at: "2026-04-15T00:00:00.000Z",
            updated_at: "2026-04-15T00:00:00.000Z",
            completed_at: null,
          },
          error: null,
        },
      ],
      users: [{ data: { cubid_identity_status: "linked" }, error: null }],
      projects: [{ data: null, error: null }],
    })

    await expect(
      executeProjectOnboardingPublishCommand(supabase as never, {
        actorUserId: "user-1",
        rpcSupabase: rpcSupabase as never,
      }),
    ).resolves.toEqual({
      ok: true,
      data: {
        projectSlug: "civic-mesh",
      },
    })

    expect(rpc).toHaveBeenCalledWith(
      "publish_project_onboarding_draft_atomic",
      expect.objectContaining({
        p_slug: "civic-mesh",
      }),
    )
  })

  it("rejects incomplete project publish requirements", async () => {
    const supabase = createSupabaseMock({
      project_onboarding_drafts: [
        {
          data: {
            id: 10,
            user_id: "user-1",
            current_screen: "review",
            payload: {
              name: "Civic Mesh",
              slug: "civic-mesh",
              description: "Short description",
              pledgeAccepted: false,
              paymentPercentage: "0.5",
            },
            started_at: "2026-04-15T00:00:00.000Z",
            updated_at: "2026-04-15T00:00:00.000Z",
            completed_at: null,
          },
          error: null,
        },
      ],
      users: [{ data: { cubid_identity_status: "linked" }, error: null }],
    })

    await expect(
      executeProjectOnboardingPublishCommand(supabase as never, { actorUserId: "user-1" }),
    ).resolves.toEqual({
      ok: false,
      error: {
        code: "pledge_required",
        message: "The FundLoop pledge must be accepted before publishing",
      },
    })
  })

  it("blocks project publish when the actor has not linked CUBID yet", async () => {
    const supabase = createSupabaseMock({
      project_onboarding_drafts: [
        {
          data: {
            id: 10,
            user_id: "user-1",
            current_screen: "review",
            payload: {
              name: "Civic Mesh",
              slug: "civic-mesh",
              description: "Short description",
              pledgeAccepted: true,
              paymentPercentage: "1.5",
            },
            started_at: "2026-04-15T00:00:00.000Z",
            updated_at: "2026-04-15T00:00:00.000Z",
            completed_at: null,
          },
          error: null,
        },
      ],
      users: [{ data: { cubid_identity_status: "unlinked" }, error: null }],
    })

    await expect(
      executeProjectOnboardingPublishCommand(supabase as never, { actorUserId: "user-1" }),
    ).resolves.toEqual({
      ok: false,
      error: {
        code: "cubid_identity_required",
        message: "Link your CUBID identity before publishing a FundLoop project.",
      },
    })
  })
})
