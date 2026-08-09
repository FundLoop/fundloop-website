import { describe, expect, it, vi } from "vitest"
import { invokeEdgeCommandWithClient } from "@/lib/edge-functions/invoke"

function createFunctionsClient(response: { data: unknown; error: unknown }) {
  return {
    functions: {
      invoke: vi.fn().mockResolvedValue(response),
    },
  }
}

describe("edge function invoker", () => {
  it("passes through a successful command envelope", async () => {
    const client = createFunctionsClient({
      data: { ok: true, data: { count: 2 } },
      error: null,
    })

    await expect(invokeEdgeCommandWithClient(client as never, "demo-command", { demo: true })).resolves.toEqual({
      ok: true,
      data: { count: 2 },
    })
  })

  it("passes through a declared failure envelope", async () => {
    const client = createFunctionsClient({
      data: { ok: false, error: { code: "forbidden", message: "nope" } },
      error: null,
    })

    await expect(invokeEdgeCommandWithClient(client as never, "demo-command", { demo: true })).resolves.toEqual({
      ok: false,
      error: { code: "forbidden", message: "nope" },
    })
  })

  it("normalizes invocation failures into the shared failure envelope", async () => {
    const client = createFunctionsClient({
      data: null,
      error: { name: "FunctionsHttpError", message: "upstream exploded" },
    })

    await expect(invokeEdgeCommandWithClient(client as never, "demo-command", { demo: true })).resolves.toEqual({
      ok: false,
      error: { code: "FunctionsHttpError", message: "upstream exploded" },
    })
  })

  it("preserves a typed failure envelope returned with a non-2xx function response", async () => {
    const client = createFunctionsClient({
      data: null,
      error: {
        name: "FunctionsHttpError",
        message: "Edge Function returned a non-2xx status code",
        context: { json: vi.fn().mockResolvedValue({ ok: false, error: { code: "provider_unavailable", message: "Enable Bank Transfers in Stripe." } }) },
      },
    })

    await expect(invokeEdgeCommandWithClient(client as never, "demo-command", { demo: true })).resolves.toEqual({
      ok: false,
      error: { code: "provider_unavailable", message: "Enable Bank Transfers in Stripe." },
    })
  })

  it("rejects invalid response envelopes", async () => {
    const client = createFunctionsClient({
      data: { hello: "world" },
      error: null,
    })

    await expect(invokeEdgeCommandWithClient(client as never, "demo-command", { demo: true })).resolves.toEqual({
      ok: false,
      error: {
        code: "invalid_edge_response",
        message: "Edge Function demo-command returned an invalid response envelope.",
      },
    })
  })
})
