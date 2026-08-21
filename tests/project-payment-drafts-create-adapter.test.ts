import { beforeEach, describe, expect, it, vi } from "vitest"

const invokeBrowserEdgeCommand = vi.fn()
const invokeServerEdgeCommand = vi.fn()

vi.mock("@/lib/edge-functions/invoke", () => ({
  invokeBrowserEdgeCommand,
}))

vi.mock("@/lib/edge-functions/invoke-server", () => ({
  invokeServerEdgeCommand,
}))

describe("project payment drafts create adapter", () => {
  beforeEach(() => {
    vi.resetModules()
    invokeBrowserEdgeCommand.mockReset()
    invokeServerEdgeCommand.mockReset()
  })

  it("passes through a valid browser success envelope", async () => {
    invokeBrowserEdgeCommand.mockResolvedValue({
      ok: true,
      data: [
        {
          id: 1,
          project_id: 7,
          project_name: "FundLoop Studio",
          project_slug: "fundloop-studio",
          period_start: "2026-04-01",
          period_end: "2026-04-30",
          revenue: 1000,
          payment_amount: 10,
          payment_percentage: 1,
          payment_method_id: 1,
          payment_method_name: "Crypto contract",
          payment_method_code: "crypto_contract",
          status_id: 3,
          status_name: "Draft",
          status_code: "draft",
          created_at: "2026-04-14T12:00:00.000Z",
          updated_at: "2026-04-14T12:00:00.000Z",
          paid_at: null,
          confirmed_at: null,
          notes: null,
          latest_onchain_submission: null,
        },
      ],
    })

    const { invokeProjectPaymentDraftsCreateBrowser } = await import("@/lib/edge-functions/project-payment-drafts-create")
    await expect(
      invokeProjectPaymentDraftsCreateBrowser({
        projectSlug: "fundloop-studio",
        payments: [
          {
            period_start: "2026-04-01",
            period_end: "2026-04-30",
            revenue: 1000,
            payment_amount: 10,
            payment_percentage: 1,
            payment_method_id: 1,
          },
        ],
      }),
    ).resolves.toEqual({
      ok: true,
      data: [expect.objectContaining({ id: 1, status_code: "draft" })],
    })
  })

  it("passes through a declared server failure envelope", async () => {
    invokeServerEdgeCommand.mockResolvedValue({
      ok: false,
      error: {
        code: "permission_denied",
        message: "You do not have permission to manage payments for this project.",
      },
    })

    const { invokeProjectPaymentDraftsCreateServer } = await import("@/lib/edge-functions/project-payment-drafts-create-server")
    await expect(
      invokeProjectPaymentDraftsCreateServer({
        projectSlug: "fundloop-studio",
        payments: [],
      }),
    ).resolves.toEqual({
      ok: false,
      error: {
        code: "permission_denied",
        message: "You do not have permission to manage payments for this project.",
      },
    })
  })

  it("rejects invalid success payloads from the function transport", async () => {
    invokeBrowserEdgeCommand.mockResolvedValue({
      ok: true,
      data: [{ id: "oops" }],
    })

    const { invokeProjectPaymentDraftsCreateBrowser } = await import("@/lib/edge-functions/project-payment-drafts-create")
    await expect(
      invokeProjectPaymentDraftsCreateBrowser({
        projectSlug: "fundloop-studio",
        payments: [],
      }),
    ).resolves.toEqual({
      ok: false,
      error: {
        code: "invalid_edge_response",
        message: "Edge Function project-payment-drafts-create returned an invalid payment summary payload.",
      },
    })
  })
})
