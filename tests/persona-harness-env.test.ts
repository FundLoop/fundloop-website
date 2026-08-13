import { describe, expect, it, vi } from "vitest"
import { assertPersonaOptions, probeLocalPersonaServices, readLocalPersonaEnv } from "@/tests/e2e/support/persona-env"

function localEnv(overrides: Record<string, string | undefined> = {}): NodeJS.ProcessEnv {
  return {
    NODE_ENV: "test",
    FUNDLOOP_DEPLOYMENT_ENV: "local",
    NEXT_PUBLIC_SUPABASE_URL: "http://localhost:55321",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: "local-anon",
    SUPABASE_SERVICE_ROLE_KEY: "local-service-role",
    PLAYWRIGHT_PERSONA_BASE_URL: "http://127.0.0.1:3002",
    PLAYWRIGHT_PERSONA_MAILPIT_URL: "http://localhost:55324",
    ...overrides,
  }
}

describe("persona local-only preflight", () => {
  it("normalizes only the exact local port block", () => {
    expect(readLocalPersonaEnv(localEnv())).toMatchObject({
      supabaseUrl: "http://127.0.0.1:55321",
      mailpitUrl: "http://127.0.0.1:55324",
      baseURL: "http://127.0.0.1:3002",
    })
    expect(() => readLocalPersonaEnv(localEnv({ NEXT_PUBLIC_SUPABASE_URL: "https://project.supabase.co" })))
      .toThrow("persona-supabase-origin-refused")
    expect(() => readLocalPersonaEnv(localEnv({ PLAYWRIGHT_PERSONA_BASE_URL: "http://127.0.0.1:3000" })))
      .toThrow("persona-base-url-refused")
    expect(() => readLocalPersonaEnv(localEnv({ FUNDLOOP_DEPLOYMENT_ENV: "preview" })))
      .toThrow("persona-env-not-local")
  })

  it("refuses remote mutation and payout options before setup", () => {
    expect(() => assertPersonaOptions({ remoteFixtures: true })).toThrow("persona-remote-option-refused")
    expect(() => assertPersonaOptions({ supabaseMutation: "push" })).toThrow("persona-supabase-operation-refused")
    expect(() => assertPersonaOptions({ payoutExecution: true })).toThrow("persona-payout-execution-refused")
  })

  it("probes Auth, the schema sentinel, Storage, and Mailpit with fixed failure codes", async () => {
    const env = readLocalPersonaEnv(localEnv())
    const ok = vi.fn(async () => new Response("{}", { status: 200 })) as unknown as typeof fetch
    await expect(probeLocalPersonaServices(env, ok)).resolves.toBeUndefined()
    expect(ok).toHaveBeenCalledTimes(4)
    const failed = vi.fn(async () => { throw new Error("private endpoint detail") }) as unknown as typeof fetch
    await expect(probeLocalPersonaServices(env, failed)).rejects.toThrow("persona-supabase-unavailable")
  })
})
