import { describe, expect, it } from "vitest"
import { apiServers, isSandboxDeployment, publicApiBaseUrl, sandboxApiBaseUrl } from "@/lib/api/v1/config"

describe("public api hosts are configuration", () => {
  it("defaults to the production and sandbox hosts", () => {
    expect(publicApiBaseUrl({})).toBe("https://www.fundloop.org")
    expect(sandboxApiBaseUrl({})).toBe("https://dev.fundloop.org")
  })

  it("accepts an override and keeps only its origin", () => {
    expect(publicApiBaseUrl({ FUNDLOOP_PUBLIC_API_BASE_URL: "https://api.fundloop.org/ignored/path" })).toBe("https://api.fundloop.org")
    expect(sandboxApiBaseUrl({ FUNDLOOP_SANDBOX_API_BASE_URL: "https://sandbox.example.org" })).toBe("https://sandbox.example.org")
  })

  it("refuses non-https and unparseable overrides", () => {
    expect(publicApiBaseUrl({ FUNDLOOP_PUBLIC_API_BASE_URL: "http://insecure.example.org" })).toBe("https://www.fundloop.org")
    expect(sandboxApiBaseUrl({ FUNDLOOP_SANDBOX_API_BASE_URL: "not a url" })).toBe("https://dev.fundloop.org")
    expect(sandboxApiBaseUrl({ FUNDLOOP_SANDBOX_API_BASE_URL: "   " })).toBe("https://dev.fundloop.org")
  })

  it("lists both servers, and only one when they coincide", () => {
    expect(apiServers({})).toEqual([
      { url: "https://www.fundloop.org/api/v1", description: "Production" },
      { url: "https://dev.fundloop.org/api/v1", description: "Sandbox" },
    ])
    const single = apiServers({ FUNDLOOP_SANDBOX_API_BASE_URL: "https://www.fundloop.org" })
    expect(single).toHaveLength(1)
    expect(single[0].description).toBe("Production")
  })

  it("knows which deployments are the sandbox", () => {
    expect(isSandboxDeployment({ FUNDLOOP_DEPLOYMENT_ENV: "dev" })).toBe(true)
    expect(isSandboxDeployment({ FUNDLOOP_DEPLOYMENT_ENV: "Local" })).toBe(true)
    expect(isSandboxDeployment({ FUNDLOOP_DEPLOYMENT_ENV: "preview" })).toBe(true)
    expect(isSandboxDeployment({ FUNDLOOP_DEPLOYMENT_ENV: "main" })).toBe(false)
    expect(isSandboxDeployment({})).toBe(false)
  })
})
