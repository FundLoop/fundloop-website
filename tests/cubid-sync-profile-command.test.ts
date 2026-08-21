import { beforeEach, describe, expect, it, vi } from "vitest"

const executeResolveCubidIdentityByEmailCommand = vi.fn()
const fetchIdentity = vi.fn()
const fetchScore = vi.fn()
const fetchStamps = vi.fn()
const fetchUserData = vi.fn()

vi.mock("@/lib/cubid/resolve-email-command", () => ({
  executeResolveCubidIdentityByEmailCommand,
}))

vi.mock("@/lib/cubid/server-client", () => ({
  createServerCubidApiClient: () => ({
    fetchIdentity,
    fetchScore,
    fetchStamps,
    fetchUserData,
  }),
}))

function createQueryResponse(response: unknown) {
  return {
    select() {
      return this
    },
    eq() {
      return this
    },
    single() {
      return Promise.resolve(response)
    },
    maybeSingle() {
      return Promise.resolve(response)
    },
    upsert() {
      return Promise.resolve({ error: null })
    },
    update() {
      return this
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

describe("executeSyncCubidProfileCommand", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    fetchUserData.mockResolvedValue({ name: "Maya Torres", error: null })
  })

  it("syncs the normalized snapshot and upgrades the local user record", async () => {
    const supabase = createSupabaseMock({
      users: [
        {
          data: {
            cubid_id: "cubid-user-1",
            cubid_identity_status: "linked",
            cubid_score: 72,
            primary_email_identity: "auth-identity-1",
          },
          error: null,
        },
        { data: null, error: null },
      ],
      cubid_identity_snapshots: [{ data: null, error: null }, { error: null }],
    })

    fetchIdentity.mockResolvedValue({
      error: null,
      stampDetails: [
        { stampType: "email", status: "verified", value: "maya@example.com" },
        { stampType: "phone", status: "verified", value: "+15555550123" },
      ],
    })
    fetchScore.mockResolvedValue({ cubidScore: 93, error: null, scoringSchema: 1 })
    fetchStamps.mockResolvedValue({
      email: "maya@example.com",
      allStamps: [
        { stampType: "phone", identity: "+15555550123", isValid: true, raw: {} },
        { stampType: "github", identity: "maya", isValid: true, raw: {} },
      ],
    })

    const { executeSyncCubidProfileCommand } = await import("@/lib/cubid/sync-profile-command")
    await expect(
      executeSyncCubidProfileCommand(supabase as never, {
        actorUserId: "user-1",
        actorEmail: "maya@example.com",
      }),
    ).resolves.toEqual({
      ok: true,
      data: expect.objectContaining({
        cubidId: "cubid-user-1",
        cubidScore: 93,
        cubidIdentityStatus: "verified",
        cubidSnapshot: expect.objectContaining({
          primaryName: "Maya Torres",
          primaryEmail: "maya@example.com",
          primaryPhone: "+15555550123",
          verifiedStampTypes: ["email", "phone", "github"],
        }),
      }),
    })
  })

  it("ensures the cubid id first when the FundLoop profile is still unlinked", async () => {
    const supabase = createSupabaseMock({
      users: [
        {
          data: {
            cubid_id: null,
            cubid_identity_status: "unlinked",
            cubid_score: null,
            primary_email_identity: null,
          },
          error: null,
        },
        { data: null, error: null },
      ],
      cubid_identity_snapshots: [{ data: null, error: null }, { error: null }],
    })

    executeResolveCubidIdentityByEmailCommand.mockResolvedValue({
      ok: true,
      data: {
        cubidId: "cubid-user-2",
        primaryEmailIdentity: "auth-identity-2",
        cubidScore: 80,
        cubidIdentityStatus: "linked",
      },
    })
    fetchIdentity.mockResolvedValue({ error: null, stampDetails: [] })
    fetchScore.mockResolvedValue({ cubidScore: 80, error: null, scoringSchema: 1 })
    fetchStamps.mockResolvedValue({ email: "maya@example.com", allStamps: [] })

    const { executeSyncCubidProfileCommand } = await import("@/lib/cubid/sync-profile-command")
    await executeSyncCubidProfileCommand(supabase as never, {
      actorUserId: "user-2",
      actorEmail: "maya@example.com",
    })

    expect(executeResolveCubidIdentityByEmailCommand).toHaveBeenCalled()
  })
})
