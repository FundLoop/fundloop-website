import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import os from "node:os"
import path from "node:path"
import { describe, expect, it, vi } from "vitest"
import { expectedFunctionNames, expectedSourceClosure, parseFunctionSourceResponse, verifyDownloadedSource } from "../scripts/verify-supabase-function-parity.mjs"

type Part = { headers: Record<string, string>, body: string | Buffer }

function multipart(parts: Part[], boundary = "fundloop-source-boundary") {
  const chunks: Buffer[] = []
  for (const part of parts) {
    chunks.push(Buffer.from(`--${boundary}\r\n`))
    for (const [name, value] of Object.entries(part.headers)) chunks.push(Buffer.from(`${name}: ${value}\r\n`))
    chunks.push(Buffer.from("\r\n"), Buffer.isBuffer(part.body) ? part.body : Buffer.from(part.body), Buffer.from("\r\n"))
  }
  chunks.push(Buffer.from(`--${boundary}--\r\n`))
  return new Response(Buffer.concat(chunks), { status: 200, headers: { "content-type": `multipart/form-data; boundary=${boundary}` } })
}

function rawResponse(body: Buffer | string, contentType = "multipart/form-data; boundary=fundloop-source-boundary") {
  return new Response(typeof body === "string" ? body : new Uint8Array(body), { status: 200, headers: { "content-type": contentType } })
}

function file(path: string, body: string | Buffer = "export {}\n", extraHeaders: Record<string, string> = {}): Part {
  return {
    headers: {
      "Content-Disposition": `form-data; name="file"; filename="${path}"`,
      "Content-Type": "application/typescript",
      ...extraHeaders,
    },
    body,
  }
}

describe("Supabase Management API function source read-back", () => {
  it("derives runtime-only TypeScript dependency edges without concessions", () => {
    const root = mkdtempSync(path.join(os.tmpdir(), "fundloop-runtime-closure-"))
    try {
      const functionDir = path.join(root, "supabase/functions/example")
      mkdirSync(functionDir, { recursive: true })
      const files: Record<string, string> = {
        "supabase/functions/example/index.ts": [
          'import type { Pure } from "../../../lib/pure.ts"',
          'import { type InlineOnly } from "../../../lib/inline-only.ts"',
          'import { type MixedType, mixedValue } from "../../../lib/mixed.ts"',
          'import "../../../lib/side-effect.ts"',
          'export type { ReExportType } from "../../../lib/re-export-type.ts"',
          'export { type InlineReExportOnly } from "../../../lib/re-export-inline-only.ts"',
          'export { type MixedExportType, reExportValue } from "../../../lib/re-export-mixed.ts"',
          'export * from "../../../lib/re-export-all.ts"',
          'void import("../../../lib/dynamic.ts")',
          'void import("../../../lib/dynamic-json.json", { with: { type: "json" } })',
          "void mixedValue",
        ].join("\n"),
        "lib/pure.ts": "export type Pure = string\n",
        "lib/inline-only.ts": "export type InlineOnly = string\n",
        "lib/mixed.ts": "export type MixedType = string; export const mixedValue = 1\n",
        "lib/side-effect.ts": "globalThis.runtimeSideEffect = true\n",
        "lib/re-export-type.ts": "export type ReExportType = string\n",
        "lib/re-export-inline-only.ts": "export type InlineReExportOnly = string\n",
        "lib/re-export-mixed.ts": "export type MixedExportType = string; export const reExportValue = 1\n",
        "lib/re-export-all.ts": "export const reExportAllValue = 1\n",
        "lib/dynamic.ts": "export const dynamicValue = 1\n",
        "lib/dynamic-json.json": "{\"runtime\":true}\n",
      }
      for (const [relative, contents] of Object.entries(files)) {
        mkdirSync(path.dirname(path.join(root, relative)), { recursive: true })
        writeFileSync(path.join(root, relative), contents)
      }
      expect(expectedSourceClosure("example", root)).toEqual([
        "lib/dynamic-json.json",
        "lib/dynamic.ts",
        "lib/inline-only.ts",
        "lib/mixed.ts",
        "lib/re-export-all.ts",
        "lib/re-export-inline-only.ts",
        "lib/re-export-mixed.ts",
        "lib/side-effect.ts",
        "supabase/functions/example/index.ts",
      ])
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it("fails closed when a reviewed module cannot be parsed", () => {
    const root = mkdtempSync(path.join(os.tmpdir(), "fundloop-runtime-closure-invalid-"))
    try {
      const entrypoint = path.join(root, "supabase/functions/example/index.ts")
      mkdirSync(path.dirname(entrypoint), { recursive: true })
      writeFileSync(entrypoint, 'import { broken from "../../../lib/value.ts"\n')
      expect(() => expectedSourceClosure("example", root)).toThrow("invalid syntax")
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it.each([
    ["nonliteral", "const specifier = '../../../lib/value.ts'; void import(specifier)", /string literal/],
    ["over-arity", "void import('../../../lib/value.ts', {}, {})", /invalid syntax|one or two arguments/],
  ])("fails closed on %s dynamic imports", (_label, source, expectedError) => {
    const root = mkdtempSync(path.join(os.tmpdir(), "fundloop-runtime-dynamic-invalid-"))
    try {
      const entrypoint = path.join(root, "supabase/functions/example/index.ts")
      mkdirSync(path.dirname(entrypoint), { recursive: true })
      writeFileSync(entrypoint, source)
      expect(() => expectedSourceClosure("example", root)).toThrow(expectedError)
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it("derives runtime closures for all functions and omits erased Supabase types from admin reconciliation", () => {
    const names = expectedFunctionNames()
    expect(names).toHaveLength(64)
    for (const name of names) expect(expectedSourceClosure(name).length).toBeGreaterThan(0)
    const monthlyReportClosure = expectedSourceClosure("monthly-report-publication")
    expect(monthlyReportClosure).toContain("supabase/functions/monthly-report-publication/index.ts")
    expect(monthlyReportClosure).toContain("lib/edge-functions/monthly-report-publication-contract.ts")
    expect(monthlyReportClosure).toContain("supabase/functions/_shared/command-runtime.ts")
    const personaReadinessClosure = expectedSourceClosure("persona-readiness-identity")
    expect(personaReadinessClosure).toContain("supabase/functions/persona-readiness-identity/index.ts")
    expect(personaReadinessClosure).toContain("supabase/functions/persona-readiness-identity/source-contracts.json")
    expect(personaReadinessClosure).toContain("supabase/functions/_shared/command-runtime.ts")
    const adminClosure = expectedSourceClosure("admin-onchain-payment-reconciliation-run")
    expect(adminClosure).not.toContain("types/supabase.ts")
    expect(adminClosure).toContain("lib/onchain/payment-submissions.ts")
    expect(adminClosure).toContain("lib/onchain/payment-reconciliation.ts")
    expect(adminClosure).toContain("lib/payments/admin-payment-operations-command.ts")
  })

  it("accepts the official multipart response and strips only the known monorepo root", async () => {
    const expected = ["lib/edge-functions/result.ts", "supabase/functions/example/index.ts"]
    const parsed = await parseFunctionSourceResponse(multipart([
      { headers: { "Content-Disposition": "form-data; name=\"metadata\"" }, body: "{\"deno2_entrypoint_path\":\"fundloop-website/supabase/functions/example/index.ts\"}" },
      file("fundloop-website/lib/edge-functions/result.ts", "result\n"),
      file("fundloop-website/supabase/functions/example/index.ts", "entry\n"),
    ]), "example", expected)
    expect([...parsed.keys()].sort()).toEqual(expected)
    expect(parsed.get(expected[0])?.toString()).toBe("result\n")
  })

  it("accepts legal multipart parameter ordering and gives Supabase-Path precedence", async () => {
    const response = multipart([file("wrong.ts", "right\n", { "Supabase-Path": "fundloop-website/safe.ts" })])
    response.headers.set("content-type", "multipart/form-data; charset=utf-8; boundary=\"fundloop-source-boundary\"")
    const parsed = await parseFunctionSourceResponse(response, "example", ["safe.ts"])
    expect(parsed.get("safe.ts")?.toString()).toBe("right\n")
  })

  it.each([
    ["duplicate filename", "form-data; name=\"file\"; filename=\"safe.ts\"; filename=\"other.ts\""],
    ["duplicate name", "form-data; name=\"file\"; name=\"other\"; filename=\"safe.ts\""],
    ["trailing junk", "form-data; name=\"file\"; filename=\"safe.ts\" junk"],
    ["unterminated quote", "form-data; name=\"file\"; filename=\"safe.ts"],
  ])("rejects malformed Content-Disposition: %s", async (_label, disposition) => {
    const response = multipart([file("ignored.ts", "safe\n", {
      "Content-Disposition": disposition,
      "Supabase-Path": "safe.ts",
    })])
    await expect(parseFunctionSourceResponse(response, "example", ["safe.ts"]))
      .rejects.toThrow("invalid content disposition")
  })

  it("accepts valid quoted escapes in MIME parameters", async () => {
    const response = multipart([file("ignored.ts", "safe\n", {
      "Content-Disposition": "form-data; name=\"fi\\\"le\"; filename=\"safe.ts\"",
    })])
    const parsed = await parseFunctionSourceResponse(response, "example", ["safe.ts"])
    expect(parsed.get("safe.ts")?.toString()).toBe("safe\n")
  })

  it.each([
    ["traversal", "../secret.ts"],
    ["absolute POSIX", "/etc/passwd"],
    ["absolute Windows", "C:/secret.ts"],
  ])("rejects %s paths", async (_label, unsafePath) => {
    await expect(parseFunctionSourceResponse(multipart([file(unsafePath)]), "example", ["safe.ts"]))
      .rejects.toThrow("unsafe path")
  })

  it("rejects symlink and other non-regular parts", async () => {
    await expect(parseFunctionSourceResponse(multipart([file("safe.ts", "target", { "Supabase-File-Type": "symlink" })]), "example", ["safe.ts"]))
      .rejects.toThrow("non-regular entry")
  })

  it("rejects duplicate and normalized-path collisions", async () => {
    await expect(parseFunctionSourceResponse(multipart([file("safe.ts"), file("safe.ts")]), "example", ["safe.ts"]))
      .rejects.toThrow("duplicate or colliding paths")
    await expect(parseFunctionSourceResponse(multipart([file("Safe.ts"), file("safe.ts")]), "example", ["Safe.ts", "safe.ts"]))
      .rejects.toThrow("duplicate or colliding paths")
  })

  it("rejects unknown prefixes plus missing and extra closure paths", async () => {
    const secretLikePath = "other-repo/person@example.com-secret.ts"
    const unknownError = await parseFunctionSourceResponse(multipart([file(secretLikePath)]), "example", ["safe.ts"])
      .catch((caught) => String(caught))
    expect(unknownError).toContain("missing=safe.ts extraCount=1 extraPathSha256=")
    expect(unknownError).not.toContain(secretLikePath)
    expect(unknownError).not.toContain("person@example.com")
    await expect(parseFunctionSourceResponse(multipart([file("safe.ts"), file("extra.ts")]), "example", ["safe.ts"]))
      .rejects.toThrow("extraCount=1 extraPathSha256=")
    await expect(parseFunctionSourceResponse(multipart([file("other.ts")]), "example", ["safe.ts", "other.ts"]))
      .rejects.toThrow("missing=safe.ts")
  })

  it("rejects oversized files before comparison", async () => {
    await expect(parseFunctionSourceResponse(multipart([file("safe.ts", Buffer.alloc(2 * 1024 * 1024 + 1))]), "example", ["safe.ts"]))
      .rejects.toThrow("file exceeds size limit")
  })

  it("enforces total response and file-count bounds", async () => {
    const declaredOversize = multipart([file("safe.ts")])
    declaredOversize.headers.set("content-length", String(16 * 1024 * 1024 + 1))
    await expect(parseFunctionSourceResponse(declaredOversize, "example", ["safe.ts"]))
      .rejects.toThrow("response exceeds size limit")
    const paths = Array.from({ length: 257 }, (_, index) => `file-${index}.ts`)
    await expect(parseFunctionSourceResponse(multipart(paths.map((relative) => file(relative))), "example", paths))
      .rejects.toThrow("file count limit")
    await expect(parseFunctionSourceResponse(rawResponse(Buffer.alloc(16 * 1024 * 1024 + 1)), "example", ["safe.ts"]))
      .rejects.toThrow("response exceeds size limit")
  })

  it.each([
    ["missing terminal boundary", rawResponse("--fundloop-source-boundary\r\nContent-Disposition: form-data; name=\"file\"; filename=\"safe.ts\"\r\n\r\nsafe")],
    ["trailing bytes", rawResponse("--fundloop-source-boundary--\r\ntrailing")],
    ["malformed header", rawResponse("--fundloop-source-boundary\r\nnot-a-header\r\n\r\nsafe\r\n--fundloop-source-boundary--\r\n")],
    ["duplicate boundary parameter", rawResponse("--one--\r\n", "multipart/form-data; boundary=one; boundary=two")],
    ["boundary trailing junk", rawResponse("--one--\r\n", "multipart/form-data; boundary=one junk")],
    ["boundary unterminated quote", rawResponse("--one--\r\n", "multipart/form-data; boundary=\"one")],
    ["boundary duplicate charset", rawResponse("--one--\r\n", "multipart/form-data; boundary=one; charset=utf-8; charset=ascii")],
  ])("rejects %s", async (_label, response) => {
    await expect(parseFunctionSourceResponse(response, "example", ["safe.ts"]))
      .rejects.toThrow(/multipart/)
  })

  it("fails closed on redirects, auth errors, and untrusted response bodies", async () => {
    const redirected = multipart([file("safe.ts")])
    Object.defineProperty(redirected, "redirected", { value: true })
    await expect(parseFunctionSourceResponse(redirected, "example", ["safe.ts"]))
      .rejects.toThrow("refused redirect")

    const secret = "sbp_secret_token"
    const body = "untrusted provider body"
    const request = vi.fn().mockResolvedValue(new Response(body, { status: 401 }))
    await expect(verifyDownloadedSource("a".repeat(20), "epoch-allocation-close", secret, request))
      .rejects.toThrow("status 401")
    expect(request).toHaveBeenCalledWith(
      "https://api.supabase.com/v1/projects/aaaaaaaaaaaaaaaaaaaa/functions/epoch-allocation-close/body",
      expect.objectContaining({
        headers: { accept: "multipart/form-data", authorization: `Bearer ${secret}` },
        redirect: "error",
      }),
    )
    const error = await verifyDownloadedSource("a".repeat(20), "epoch-allocation-close", secret, request).catch((caught) => String(caught))
    expect(error).not.toContain(secret)
    expect(error).not.toContain(body)

    const transport = vi.fn().mockRejectedValue(new Error(`provider leaked ${secret} ${body}`))
    const transportError = await verifyDownloadedSource("a".repeat(20), "epoch-allocation-close", secret, transport).catch((caught) => String(caught))
    expect(transportError).toContain("source read-back transport failed")
    expect(transportError).not.toContain(secret)
    expect(transportError).not.toContain(body)
  })

  it("validates project refs, slugs, and token presence before network access", async () => {
    const request = vi.fn()
    await expect(verifyDownloadedSource("bad", "example", "token", request)).rejects.toThrow("Invalid Supabase project ref")
    await expect(verifyDownloadedSource("a".repeat(20), "../example", "token", request)).rejects.toThrow("Invalid Edge Function slug")
    await expect(verifyDownloadedSource("a".repeat(20), "example", "", request)).rejects.toThrow("SUPABASE_ACCESS_TOKEN")
    expect(request).not.toHaveBeenCalled()
  })

  it("matches every byte and digest in a local synthetic Management API response", async () => {
    const functionName = "epoch-allocation-close"
    const expected = expectedSourceClosure(functionName)
    const response = multipart(expected.map((relative) => file(`fundloop-website/${relative}`, readFileSync(relative))))
    const request = vi.fn().mockResolvedValue(response)
    const result = await verifyDownloadedSource("a".repeat(20), functionName, "fixture-token", request)
    expect(result.observedSourceSha256).toBe(result.expectedSourceSha256)

    const changed = multipart(expected.map((relative, index) => file(`fundloop-website/${relative}`, index === 0 ? "changed\n" : readFileSync(relative))))
    await expect(verifyDownloadedSource("a".repeat(20), functionName, "fixture-token", vi.fn().mockResolvedValue(changed)))
      .rejects.toThrow("source differs")
  })
})
