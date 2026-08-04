import { readFile } from "node:fs/promises"
import path from "node:path"
import { describe, expect, it } from "vitest"

const founderCommandFunctions = [
  "project-monthly-contribution-submit",
  "project-attribution-dataset-submit",
]

describe("founder command Edge Function runtime", () => {
  it.each(founderCommandFunctions)("uses the shared local-compatible command runtime for %s", async (functionName) => {
    const source = await readFile(path.join(process.cwd(), "supabase", "functions", functionName, "index.ts"), "utf8")

    expect(source).toContain('from "../_shared/command-runtime.ts"')
    expect(source).toContain("authenticateRequest(request)")
    expect(source).toContain("serve(handleRequest)")
    expect(source).not.toContain('getEnv("NEXT_PUBLIC_SUPABASE_URL")')
    expect(source).not.toContain('getEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY")')
  })

  it("keeps hosted and local Supabase environment names compatible", async () => {
    const source = await readFile(path.join(process.cwd(), "supabase", "functions", "_shared", "command-runtime.ts"), "utf8")

    expect(source).toContain('getEnv("NEXT_PUBLIC_SUPABASE_URL") ?? getEnv("SUPABASE_URL")')
    expect(source).toContain('getEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY") ?? getEnv("SUPABASE_ANON_KEY")')
  })

  it("advances founder-owned identity sequences past explicit local seed rows", async () => {
    const source = await readFile(path.join(process.cwd(), "supabase", "seed.sql"), "utf8")

    for (const [sequence, table] of [
      ["organization_members_id_seq1", "organization_members"],
      ["organizations_id_seq1", "organizations"],
      ["projects_id_seq1", "projects"],
    ]) {
      expect(source).toContain(`'"public"."${sequence}"',\n  COALESCE((SELECT MAX(id) FROM public.${table}), 1)`)
    }
  })
})
