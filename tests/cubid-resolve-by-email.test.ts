import { describe, expect, it, vi } from "vitest"
import { resolveCubidIdentityByEmail } from "@/lib/cubid/resolve-by-email"

describe("resolveCubidIdentityByEmail", () => {
  it("ensures the CUBID user, fetches identity and score, and maps verified email state", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ user_id: "cubid-user-1" }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            stamp_details: [{ stamp_type: "email", value: "maya@example.com", status: "verified" }],
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ cubid_score: 87 }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      )

    await expect(
      resolveCubidIdentityByEmail({
        email: "maya@example.com",
        primaryEmailIdentity: "auth-identity-1",
        config: {
          dappId: "dapp-1",
          apiKey: "api-key-1",
          baseUrl: "https://passport.cubid.me/api/v2",
        },
        fetchImpl: fetchMock,
      }),
    ).resolves.toEqual({
      cubidId: "cubid-user-1",
      primaryEmailIdentity: "auth-identity-1",
      cubidScore: 87,
      cubidIdentityStatus: "verified",
    })
  })

  it("falls back to linked when no verification hint is present and tolerates score failures", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ user_id: "cubid-user-2" }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            stamp_details: [],
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
      )
      .mockRejectedValueOnce(new Error("boom"))

    await expect(
      resolveCubidIdentityByEmail({
        email: "person@example.com",
        primaryEmailIdentity: null,
        config: {
          dappId: "dapp-1",
          apiKey: "api-key-1",
          baseUrl: "https://passport.cubid.me/api/v2",
        },
        fetchImpl: fetchMock,
      }),
    ).resolves.toEqual({
      cubidId: "cubid-user-2",
      primaryEmailIdentity: null,
      cubidScore: null,
      cubidIdentityStatus: "linked",
    })
  })
})
