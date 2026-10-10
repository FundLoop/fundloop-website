import { beforeEach, describe, expect, it, vi } from "vitest"
import { executeCubidIdentityDisconnectCommand } from "@/lib/auth/cubid-identity-disconnect-command"
import {
  normalizeCubidIdentityDisconnectResult,
  validateCubidIdentityDisconnectInput,
} from "@/lib/edge-functions/cubid-identity-contract"

// Disconnecting a Cubid identity (#275, stage 2c UI).
//
// A typed Edge Function command rather than a route handler: the recorded exception in
// `docs/engineering/sign-in-with-cubid.md` covers the OIDC callback only, because that one has to
// set session cookies on the Next response. This has no cookie semantics at all.

const USER_ID = "11111111-1111-4111-8111-111111111111"

const getUserById = vi.fn()
const rpc = vi.fn()
const admin = { auth: { admin: { getUserById } }, rpc } as unknown as Parameters<
  typeof executeCubidIdentityDisconnectCommand
>[0]

beforeEach(() => {
  getUserById.mockReset()
  rpc.mockReset()
  getUserById.mockResolvedValue({ data: { user: { id: USER_ID, email: "person@example.com" } }, error: null })
  rpc.mockResolvedValue({ data: [{ outcome: "unlinked", revoked_clients: 2 }], error: null })
})

describe("executeCubidIdentityDisconnectCommand", () => {
  it("disconnects the caller's own identity and reports what lost access", async () => {
    const result = await executeCubidIdentityDisconnectCommand(admin, USER_ID)

    expect(result).toEqual({ ok: true, data: { outcome: "unlinked", revokedClients: 2 } })
    // The caller's id, and nothing a caller could choose.
    expect(rpc).toHaveBeenCalledWith("unlink_cubid_subject", { p_user_id: USER_ID })
  })

  it("says so plainly when there was nothing connected", async () => {
    rpc.mockResolvedValue({ data: [{ outcome: "not_linked", revoked_clients: 0 }], error: null })
    expect(await executeCubidIdentityDisconnectCommand(admin, USER_ID)).toEqual({
      ok: true,
      data: { outcome: "not_linked", revokedClients: 0 },
    })
  })

  it("refuses to remove the only way into an account", async () => {
    // Cannot happen today — every FundLoop account has an email address, including one created by
    // Cubid sign-in — but the invariant is the point: if one ever exists without one, the Cubid
    // link is that person's only way in.
    getUserById.mockResolvedValue({ data: { user: { id: USER_ID, email: null } }, error: null })

    const result = await executeCubidIdentityDisconnectCommand(admin, USER_ID)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe("last_sign_in_method")
    expect(rpc).not.toHaveBeenCalled()
  })

  it("does not disconnect anything when the account cannot be read", async () => {
    getUserById.mockResolvedValue({ data: { user: null }, error: { message: "gone" } })
    const result = await executeCubidIdentityDisconnectCommand(admin, USER_ID)
    expect(result.ok).toBe(false)
    expect(rpc).not.toHaveBeenCalled()
  })

  it("reports a database failure rather than claiming success", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "deadlock detected" } })
    const result = await executeCubidIdentityDisconnectCommand(admin, USER_ID)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe("unlink_failed")
  })

  it("refuses an outcome it does not recognise instead of reporting success", async () => {
    rpc.mockResolvedValue({ data: [{ outcome: "conflict", revoked_clients: 0 }], error: null })
    const result = await executeCubidIdentityDisconnectCommand(admin, USER_ID)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.message).toContain("conflict")
  })
})

describe("the command's contract", () => {
  it("takes no arguments, and refuses a caller that thinks it can name a target", () => {
    expect(validateCubidIdentityDisconnectInput(undefined).ok).toBe(true)
    expect(validateCubidIdentityDisconnectInput({}).ok).toBe(true)
    // A `userId` here would read as "disconnect this person", which is not something to ignore
    // silently.
    expect(validateCubidIdentityDisconnectInput({ userId: "somebody-else" }).ok).toBe(false)
    expect(validateCubidIdentityDisconnectInput("nope").ok).toBe(false)
  })

  it("refuses a response envelope it cannot read", () => {
    expect(normalizeCubidIdentityDisconnectResult({ ok: true, data: { outcome: "unlinked", revokedClients: 1 } }).ok).toBe(true)
    for (const data of [null, {}, { outcome: "unlinked" }, { outcome: "exploded", revokedClients: 0 }]) {
      expect(normalizeCubidIdentityDisconnectResult({ ok: true, data }).ok).toBe(false)
    }
  })
})
