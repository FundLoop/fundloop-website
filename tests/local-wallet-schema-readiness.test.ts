import { describe, expect, it, vi } from "vitest"
import {
  probeLocalWalletSchema,
  waitForLocalWalletSchema,
} from "../scripts/local-wallet-schema-readiness.mjs"

const env = {
  NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:55321",
  SUPABASE_SERVICE_ROLE_KEY: "local-service-role",
}

const currentBaseRow = {
  id: 2,
  network_key: "base",
  ecosystem: "evm",
  evm_chain_id: 8453,
  is_active: true,
}

function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  })
}

describe("local wallet PostgREST schema readiness", () => {
  it("requires the service-role authenticated current Base projection", async () => {
    const fetcher = vi.fn(async () => response([currentBaseRow])) as unknown as typeof fetch
    await expect(probeLocalWalletSchema(env, fetcher)).resolves.toMatchObject({
      status: 200,
      row: currentBaseRow,
    })

    const [url, init] = vi.mocked(fetcher).mock.calls[0]!
    expect(String(url)).toContain("ref_chains?select=id%2Cnetwork_key%2Cecosystem%2Cevm_chain_id%2Cis_active")
    expect(String(url)).toContain("network_key=eq.base")
    expect(init?.headers).toMatchObject({
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
    })
  })

  it("rejects non-200 and malformed responses", async () => {
    await expect(probeLocalWalletSchema(env, async () => response({ message: "loading" }, 503)))
      .rejects.toThrow("local-wallet-schema-sentinel-http-503")
    await expect(probeLocalWalletSchema(env, async () => new Response("not-json", { status: 200 })))
      .rejects.toThrow("local-wallet-schema-sentinel-json-invalid")
  })

  it("retries delayed PostgREST readiness within the bound", async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(response({ message: "loading" }, 503))
      .mockResolvedValueOnce(response([currentBaseRow])) as unknown as typeof fetch
    await expect(waitForLocalWalletSchema({ env, fetcher, attempts: 2, intervalMs: 1, delayFn: async () => {} }))
      .resolves.toMatchObject({ attempt: 2, row: currentBaseRow })
  })

  it("rejects stale schema rows and reports a bounded classified timeout", async () => {
    const stale = { ...currentBaseRow, evm_chain_id: 1 }
    await expect(waitForLocalWalletSchema({
      env,
      fetcher: async () => response([stale]),
      attempts: 2,
      intervalMs: 1,
      delayFn: async () => {},
    })).rejects.toThrow("local-wallet-schema-sentinel-base-row-stale-timeout")
  })
})
