import { beforeEach, describe, expect, it, vi } from "vitest"

const resolveCubidIdentityByEmail = vi.fn()

vi.mock("@/lib/cubid/resolve-by-email", () => ({
  resolveCubidIdentityByEmail,
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

describe("executeResolveCubidIdentityByEmailCommand", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns the stored identity when the user is already linked", async () => {
    const supabase = createSupabaseMock({
      users: [
        {
          data: {
            cubid_id: "cubid-user-1",
            cubid_identity_status: "linked",
            cubid_score: 65,
            primary_email_identity: "auth-identity-1",
          },
          error: null,
        },
      ],
    })

    const { executeResolveCubidIdentityByEmailCommand } = await import("@/lib/cubid/resolve-email-command")
    await expect(
      executeResolveCubidIdentityByEmailCommand(supabase as never, {
        actorUserId: "user-1",
        actorEmail: "maya@example.com",
      }),
    ).resolves.toEqual({
      ok: true,
      data: {
        cubidId: "cubid-user-1",
        primaryEmailIdentity: "auth-identity-1",
        cubidScore: 65,
        cubidIdentityStatus: "linked",
      },
    })

    expect(resolveCubidIdentityByEmail).not.toHaveBeenCalled()
  })

  it("persists newly resolved identity state", async () => {
    resolveCubidIdentityByEmail.mockResolvedValue({
      cubidId: "cubid-user-2",
      primaryEmailIdentity: "auth-identity-2",
      cubidScore: 88,
      cubidIdentityStatus: "verified",
    })

    const supabase = createSupabaseMock({
      users: [
        {
          data: {
            cubid_id: null,
            cubid_identity_status: "unlinked",
            cubid_score: null,
            primary_email_identity: "auth-identity-2",
          },
          error: null,
        },
        { data: null, error: null },
      ],
    })

    const { executeResolveCubidIdentityByEmailCommand } = await import("@/lib/cubid/resolve-email-command")
    await expect(
      executeResolveCubidIdentityByEmailCommand(supabase as never, {
        actorUserId: "user-2",
        actorEmail: "person@example.com",
      }),
    ).resolves.toEqual({
      ok: true,
      data: {
        cubidId: "cubid-user-2",
        primaryEmailIdentity: "auth-identity-2",
        cubidScore: 88,
        cubidIdentityStatus: "verified",
      },
    })
  })

  it("rejects a missing authenticated email cleanly", async () => {
    const { executeResolveCubidIdentityByEmailCommand } = await import("@/lib/cubid/resolve-email-command")
    await expect(
      executeResolveCubidIdentityByEmailCommand({} as never, {
        actorUserId: "user-3",
        actorEmail: null,
      }),
    ).resolves.toEqual({
      ok: false,
      error: {
        code: "missing_email",
        message: "A signed-in email address is required before CUBID can be linked.",
      },
    })
  })
})
