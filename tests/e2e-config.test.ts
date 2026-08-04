import { describe, expect, it } from "vitest"
import { getConfiguredE2ESecret, isAuthorizedE2ERequest, isE2EAuthEnabled } from "@/lib/e2e/config"

function buildRequest(secret: string | null) {
  return new Request("https://fundloop.test/api/internal/e2e/login", {
    headers: secret
      ? {
          "x-fundloop-e2e-secret": secret,
        }
      : undefined,
  })
}

describe("e2e config helpers", () => {
  it("enables the e2e auth bootstrap only outside production deployments when explicitly flagged", () => {
    expect(isE2EAuthEnabled({ FUNDLOOP_E2E_ENABLED: "true", NODE_ENV: "development" })).toBe(true)
    expect(
      isE2EAuthEnabled({
        FUNDLOOP_DEPLOYMENT_ENV: "dev",
        FUNDLOOP_E2E_ENABLED: "true",
        NODE_ENV: "production",
      }),
    ).toBe(true)
    expect(
      isE2EAuthEnabled({
        FUNDLOOP_DEPLOYMENT_ENV: "production",
        FUNDLOOP_E2E_ENABLED: "true",
        NODE_ENV: "production",
      }),
    ).toBe(false)
    expect(isE2EAuthEnabled({ FUNDLOOP_E2E_ENABLED: "true", NODE_ENV: "production" })).toBe(false)
    expect(isE2EAuthEnabled({ FUNDLOOP_E2E_ENABLED: "false", NODE_ENV: "development" })).toBe(false)
  })

  it("requires the configured shared secret to authorize requests", () => {
    expect(getConfiguredE2ESecret({ FUNDLOOP_E2E_SECRET: "shared-secret", NODE_ENV: "development" })).toBe("shared-secret")
    expect(getConfiguredE2ESecret({ FUNDLOOP_E2E_SECRET: "   ", NODE_ENV: "development" })).toBeNull()

    expect(
      isAuthorizedE2ERequest(buildRequest("shared-secret"), { FUNDLOOP_E2E_SECRET: "shared-secret", NODE_ENV: "development" }),
    ).toBe(true)
    expect(
      isAuthorizedE2ERequest(buildRequest("wrong-secret"), { FUNDLOOP_E2E_SECRET: "shared-secret", NODE_ENV: "development" }),
    ).toBe(false)
    expect(isAuthorizedE2ERequest(buildRequest(null), { FUNDLOOP_E2E_SECRET: "shared-secret", NODE_ENV: "development" })).toBe(
      false,
    )
  })
})
