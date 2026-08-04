import { afterEach, describe, expect, it, vi } from "vitest"

import { getRemoteE2EEnv } from "./e2e/support/env"

describe("remote e2e env", () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it("requires explicit opt-in before using canonical Supabase env names for remote-safe smoke", () => {
    vi.stubEnv("PLAYWRIGHT_REMOTE_BASE_URL", "https://fundloop-website.vercel.app")
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co")
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-role-key")
    vi.stubEnv("FUNDLOOP_E2E_SECRET", "e2e-secret")

    expect(getRemoteE2EEnv()).toBeNull()
  })

  it("falls back to canonical Supabase env names only when explicitly allowed", () => {
    vi.stubEnv("PLAYWRIGHT_REMOTE_BASE_URL", "https://fundloop-website.vercel.app")
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co")
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-role-key")
    vi.stubEnv("FUNDLOOP_E2E_SECRET", "e2e-secret")
    vi.stubEnv("FUNDLOOP_DEPLOYMENT_ENV", "preview")
    vi.stubEnv("PLAYWRIGHT_REMOTE_ALLOW_CANONICAL_SUPABASE", "true")

    expect(getRemoteE2EEnv()).toEqual({
      baseURL: "https://fundloop-website.vercel.app",
      supabaseUrl: "https://example.supabase.co",
      serviceRoleKey: "service-role-key",
      e2eSecret: "e2e-secret",
    })
  })

  it("refuses to pair a hosted app URL with local canonical Supabase credentials", () => {
    vi.stubEnv("PLAYWRIGHT_REMOTE_BASE_URL", "https://fundloop-website.vercel.app")
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://127.0.0.1:55321")
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-role-key")
    vi.stubEnv("FUNDLOOP_E2E_SECRET", "e2e-secret")
    vi.stubEnv("FUNDLOOP_DEPLOYMENT_ENV", "preview")
    vi.stubEnv("PLAYWRIGHT_REMOTE_ALLOW_CANONICAL_SUPABASE", "true")

    expect(getRemoteE2EEnv()).toBeNull()
  })

  it("refuses canonical Supabase credentials in production deployment mode", () => {
    vi.stubEnv("PLAYWRIGHT_REMOTE_BASE_URL", "https://fundloop-website.vercel.app")
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co")
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-role-key")
    vi.stubEnv("FUNDLOOP_E2E_SECRET", "e2e-secret")
    vi.stubEnv("FUNDLOOP_DEPLOYMENT_ENV", "production")
    vi.stubEnv("PLAYWRIGHT_REMOTE_ALLOW_CANONICAL_SUPABASE", "true")

    expect(getRemoteE2EEnv()).toBeNull()
  })

  it("prefers explicit remote Supabase aliases when configured", () => {
    vi.stubEnv("PLAYWRIGHT_REMOTE_BASE_URL", "https://fundloop-website.vercel.app")
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://canonical.supabase.co")
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "canonical-service-role-key")
    vi.stubEnv("PLAYWRIGHT_REMOTE_SUPABASE_URL", "https://remote.supabase.co")
    vi.stubEnv("PLAYWRIGHT_REMOTE_SUPABASE_SERVICE_ROLE_KEY", "remote-service-role-key")
    vi.stubEnv("FUNDLOOP_E2E_SECRET", "e2e-secret")

    expect(getRemoteE2EEnv()).toMatchObject({
      supabaseUrl: "https://remote.supabase.co",
      serviceRoleKey: "remote-service-role-key",
    })
  })
})
