import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const getUser = vi.fn()
const recordPaymentFlowEvents = vi.fn()
const resolvePaymentFlowActorRole = vi.fn()

vi.mock("@/lib/supabase-server", () => ({
  createServerSupabaseClient: async () => ({
    auth: {
      getUser,
    },
  }),
}))

vi.mock("@/lib/observability/payment-flow-server", () => ({
  recordPaymentFlowEvents,
  resolvePaymentFlowActorRole,
}))

describe("POST /api/internal/observability/payment-events", () => {
  beforeEach(() => {
    vi.resetModules()
    getUser.mockReset()
    recordPaymentFlowEvents.mockReset()
    resolvePaymentFlowActorRole.mockReset()
    getUser.mockResolvedValue({
      data: {
        user: {
          id: "user-1",
          email: "admin@fundloop.org",
        },
      },
      error: null,
    })
    resolvePaymentFlowActorRole.mockResolvedValue("project_admin")
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it("rejects unauthenticated requests", async () => {
    getUser.mockResolvedValueOnce({
      data: { user: null },
      error: null,
    })

    const { POST } = await import("@/app/api/internal/observability/payment-events/route")
    const response = await POST(
      new Request("http://localhost/api/internal/observability/payment-events", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          flow: "wallet_connect",
          stage: "cta_click",
          outcome: "attempt",
          attemptId: "attempt-1",
          environment: "local",
        }),
      }),
    )

    expect(response.status).toBe(401)
  })

  it("accepts a valid authenticated payload and enriches actor identity", async () => {
    vi.stubEnv("FUNDLOOP_DEPLOYMENT_ENV", "preview")

    const { POST } = await import("@/app/api/internal/observability/payment-events/route")
    const response = await POST(
      new Request("http://localhost/api/internal/observability/payment-events", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          flow: "wallet_connect",
          stage: "cta_click",
          outcome: "attempt",
          attemptId: "attempt-2",
          environment: "local",
          projectId: 7,
        }),
      }),
    )

    expect(resolvePaymentFlowActorRole).toHaveBeenCalledWith({
      userId: "user-1",
      email: "admin@fundloop.org",
      projectId: 7,
    })
    expect(recordPaymentFlowEvents).toHaveBeenCalledWith([
      expect.objectContaining({
        flow: "wallet_connect",
        stage: "cta_click",
        attemptId: "attempt-2",
        actorUserId: "user-1",
        actorRole: "project_admin",
        environment: "preview",
      }),
    ])
    expect(response.status).toBe(200)
  })
})
