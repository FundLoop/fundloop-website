import { describe, expect, it } from "vitest"
import { executeUserAssetPreferencesUpdateCommand } from "@/lib/preferences/user-asset-preferences-command"

type Response = { data: unknown; error: { message: string } | null }

function createQueryResponse(response: Response, operations: Array<{ table: string; method: string; args: unknown[] }>, table: string) {
  return {
    delete() {
      operations.push({ table, method: "delete", args: [] })
      return this
    },
    insert(...args: unknown[]) {
      operations.push({ table, method: "insert", args })
      return Promise.resolve(response)
    },
    select(...args: unknown[]) {
      operations.push({ table, method: "select", args })
      return this
    },
    eq(...args: unknown[]) {
      operations.push({ table, method: "eq", args })
      return this
    },
    order(...args: unknown[]) {
      operations.push({ table, method: "order", args })
      return Promise.resolve(response)
    },
    then(resolve: (value: Response) => void) {
      operations.push({ table, method: "then", args: [] })
      resolve(response)
    },
  }
}

function createSupabaseMock(responsesByTable: Record<string, Response[]>, rpcResponses: Record<string, Response> = {}) {
  const counters = new Map<string, number>()
  const operations: Array<{ table: string; method: string; args: unknown[] }> = []
  const rpcCalls: Array<{ name: string; args: unknown }> = []

  return {
    operations,
    rpcCalls,
    from(table: string) {
      const nextIndex = counters.get(table) ?? 0
      counters.set(table, nextIndex + 1)
      return createQueryResponse(responsesByTable[table]?.[nextIndex] ?? { data: [], error: null }, operations, table)
    },
    rpc(name: string, args: unknown) {
      rpcCalls.push({ name, args })
      return Promise.resolve(rpcResponses[name] ?? { data: [], error: null })
    },
  }
}

describe("user asset preferences update command", () => {
  it("replaces custom preferences with deterministic ranks for the authenticated user", async () => {
    const rows = [
      { id: 1, rank: 1, asset_type: "stablecoin", asset_code: "USDC", project_id: null, accepted: true },
      { id: 2, rank: 2, asset_type: "fiat", asset_code: "USD", project_id: null, accepted: true },
      { id: 3, rank: 3, asset_type: "project_token", asset_code: "CIVIC", project_id: 7, accepted: false },
    ]
    const supabase = createSupabaseMock({}, { replace_user_asset_preferences_atomic: { data: rows, error: null } })

    const result = await executeUserAssetPreferencesUpdateCommand(supabase as never, {
      actorUserId: "user-1",
      preferences: [
        { assetType: "stablecoin", assetCode: "USDC", accepted: true },
        { assetType: "fiat", assetCode: "USD", accepted: true },
        { assetType: "project_token", assetCode: "CIVIC", projectId: 7, accepted: false },
      ],
    })

    expect(result).toEqual({
      ok: true,
      data: expect.objectContaining({
        userId: "user-1",
        hasCustomPreferences: true,
        rejectsAllProjectTokens: true,
        preferences: [
          { id: 1, rank: 1, assetType: "stablecoin", assetCode: "USDC", projectId: null, accepted: true },
          { id: 2, rank: 2, assetType: "fiat", assetCode: "USD", projectId: null, accepted: true },
          { id: 3, rank: 3, assetType: "project_token", assetCode: "CIVIC", projectId: 7, accepted: false },
        ],
      }),
    })
    expect(supabase.operations).toEqual([])
    expect(supabase.rpcCalls).toEqual([
      {
        name: "replace_user_asset_preferences_atomic",
        args: {
          p_user_id: "user-1",
          p_preferences: [
            { assetType: "stablecoin", assetCode: "USDC", accepted: true },
            { assetType: "fiat", assetCode: "USD", accepted: true },
            { assetType: "project_token", assetCode: "CIVIC", projectId: 7, accepted: false },
          ],
        },
      },
    ])
  })

  it("clears custom rows and returns default preference guidance", async () => {
    const supabase = createSupabaseMock({}, { replace_user_asset_preferences_atomic: { data: [], error: null } })

    const result = await executeUserAssetPreferencesUpdateCommand(supabase as never, {
      actorUserId: "user-1",
      preferences: [],
    })

    expect(result.ok).toBe(true)
    expect(result.ok ? result.data.hasCustomPreferences : true).toBe(false)
    expect(result.ok ? result.data.defaultPreferences.map((preference) => preference.assetType) : []).toEqual([
      "stablecoin",
      "fiat",
      "project_token",
    ])
    expect(supabase.operations.some((operation) => operation.method === "insert")).toBe(false)
    expect(supabase.rpcCalls).toEqual([
      {
        name: "replace_user_asset_preferences_atomic",
        args: { p_user_id: "user-1", p_preferences: [] },
      },
    ])
  })

  it("returns safe failures through the atomic replacement RPC without client-side deletes", async () => {
    const insertFailure = createSupabaseMock(
      {},
      { replace_user_asset_preferences_atomic: { data: null, error: { message: "project token project not found" } } },
    )
    const result = await executeUserAssetPreferencesUpdateCommand(insertFailure as never, {
      actorUserId: "user-1",
      preferences: [{ assetType: "project_token", assetCode: "CIVIC", projectId: 999, accepted: true }],
    })
    expect(result).toEqual({
      ok: false,
      error: { code: "preference_replace_failed", message: "project token project not found" },
    })
    expect(insertFailure.operations).toEqual([])
    expect(insertFailure.rpcCalls[0]).toEqual({
      name: "replace_user_asset_preferences_atomic",
      args: {
        p_user_id: "user-1",
        p_preferences: [{ assetType: "project_token", assetCode: "CIVIC", projectId: 999, accepted: true }],
      },
    })
  })
})
