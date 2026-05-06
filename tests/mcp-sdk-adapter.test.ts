import { describe, expect, it, vi } from "vitest"
import { createRemoteMcpAuthContext, createValidatedRemoteMcpAuthContext } from "@/packages/mcp-server/src/http-auth"
import { createBaseMcpToolRegistry } from "@/packages/mcp-server/src/tools"
import { mcpInputSchemaToZod, registerRegistryToolsWithSdkServer } from "@/packages/mcp-server/src/sdk-adapter"
import { edgeCommandSuccess, type EdgeCommandResult } from "@/lib/edge-functions/result"
import type { EdgeCommandClient } from "@/packages/mcp-server/src/edge-client"

const auth = {
  actorRole: "founder" as const,
  bearerToken: "test-token",
}

const edge: EdgeCommandClient = {
  async invoke<TInput, TOutput>() {
    return edgeCommandSuccess({ ok: true }) as EdgeCommandResult<TOutput>
  },
}

describe("MCP SDK adapter", () => {
  it("converts registry JSON object schemas into strict Zod schemas", () => {
    const registry = createBaseMcpToolRegistry({ allowedFunctionNames: ["monthly-cycle-lock"] })
    const edgeInvoker = registry.list().find((tool) => tool.name === "fundloop.edge_command.invoke")

    expect(edgeInvoker).toBeTruthy()
    const schema = mcpInputSchemaToZod(edgeInvoker!)

    expect(schema.parse({ functionName: "monthly-cycle-lock", input: { cycleKey: "2026-04" } })).toEqual({
      functionName: "monthly-cycle-lock",
      input: { cycleKey: "2026-04" },
    })
    expect(() => schema.parse({ functionName: "monthly-cycle-lock", unexpected: true })).toThrow()
    expect(() => schema.parse({ input: {} })).toThrow()
  })

  it("registers existing registry tools on an SDK-like server", async () => {
    const registry = createBaseMcpToolRegistry()
    const registerTool = vi.fn()
    registerRegistryToolsWithSdkServer({ registerTool }, registry, { auth, edge })

    expect(registerTool).toHaveBeenCalledWith(
      "fundloop.health",
      expect.objectContaining({
        title: "FundLoop MCP Health",
        description: expect.stringContaining("health"),
        inputSchema: expect.any(Object),
        outputSchema: expect.objectContaining({
          safeParse: expect.any(Function),
        }),
        annotations: expect.objectContaining({
          readOnlyHint: true,
          destructiveHint: false,
          openWorldHint: false,
        }),
      }),
      expect.any(Function),
    )

    const healthHandler = registerTool.mock.calls.find(([name]) => name === "fundloop.health")?.[2]
    await expect(healthHandler({})).resolves.toMatchObject({
      content: [expect.objectContaining({ text: expect.stringContaining("fundloop-mcp-server") })],
      structuredContent: expect.objectContaining({
        ok: true,
        service: "fundloop-mcp-server",
        authenticated: false,
      }),
    })
  })

  it("registers the generic Edge command bridge with explicit non-read annotations", () => {
    const registry = createBaseMcpToolRegistry()
    const registerTool = vi.fn()
    registerRegistryToolsWithSdkServer({ registerTool }, registry, { auth, edge })

    expect(registerTool).toHaveBeenCalledWith(
      "fundloop.edge_command.invoke",
      expect.objectContaining({
        title: "FundLoop Edge Command Invoke",
        annotations: {
          readOnlyHint: false,
          destructiveHint: false,
          openWorldHint: false,
        },
        inputSchema: expect.objectContaining({ safeParse: expect.any(Function) }),
        outputSchema: expect.objectContaining({ safeParse: expect.any(Function) }),
      }),
      expect.any(Function),
    )
  })

  it("requires bearer auth for remote MCP requests without changing stdio env auth", () => {
    expect(createRemoteMcpAuthContext(null)).toMatchObject({
      ok: false,
      status: 401,
      code: "not_authenticated",
    })
    expect(createRemoteMcpAuthContext("Bearer remote-token")).toMatchObject({
      ok: true,
      auth: { bearerToken: "remote-token", actorRole: "founder" },
    })
  })

  it("validates remote MCP bearer auth through Supabase user lookup", async () => {
    const authClient = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "user-1", email: "founder@example.com" } },
          error: null,
        }),
      },
    }

    await expect(
      createValidatedRemoteMcpAuthContext({
        authorizationHeader: "Bearer remote-token",
        authClient,
        internalAdminEmails: "",
      }),
    ).resolves.toMatchObject({
      ok: true,
      auth: {
        bearerToken: "remote-token",
        userId: "user-1",
        email: "founder@example.com",
        actorRole: "founder",
        isInternalOperator: false,
      },
    })
  })

  it("rejects missing bearer tokens before Supabase user lookup", async () => {
    const authClient = {
      auth: {
        getUser: vi.fn(),
      },
    }

    await expect(
      createValidatedRemoteMcpAuthContext({
        authorizationHeader: null,
        authClient,
      }),
    ).resolves.toMatchObject({
      ok: false,
      status: 401,
      code: "not_authenticated",
    })
    expect(authClient.auth.getUser).not.toHaveBeenCalled()
  })

  it("rejects invalid or expired Supabase tokens", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    const authClient = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: null },
          error: { message: "JWT expired" },
        }),
      },
    }

    await expect(
      createValidatedRemoteMcpAuthContext({
        authorizationHeader: "Bearer expired-token",
        authClient,
      }),
    ).resolves.toMatchObject({
      ok: false,
      status: 401,
      code: "not_authenticated",
    })
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("auth_failure"))
    expect(warn.mock.calls[0]?.[0]).not.toContain("expired-token")
    warn.mockRestore()
  })

  it("allows the documented local smoke token only when explicitly enabled", async () => {
    const authClient = {
      auth: {
        getUser: vi.fn(),
      },
    }

    await expect(
      createValidatedRemoteMcpAuthContext({
        authorizationHeader: "Bearer local-smoke-token",
        authClient,
        allowLocalTestToken: true,
      }),
    ).resolves.toMatchObject({
      ok: true,
      auth: {
        userId: "local-mcp-smoke-user",
        email: "local-mcp-smoke@fundloop.example.com",
      },
    })
    expect(authClient.auth.getUser).not.toHaveBeenCalled()
  })

  it("does not allow the local smoke token without the explicit local flag", async () => {
    const authClient = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: null },
          error: { message: "invalid token" },
        }),
      },
    }

    await expect(
      createValidatedRemoteMcpAuthContext({
        authorizationHeader: "Bearer local-smoke-token",
        authClient,
        allowLocalTestToken: false,
      }),
    ).resolves.toMatchObject({ ok: false, status: 401 })
  })

  it("derives internal operator access from the configured allowlist", async () => {
    const authClient = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "operator-1", email: "maya@fundloop.example.com" } },
          error: null,
        }),
      },
    }

    await expect(
      createValidatedRemoteMcpAuthContext({
        authorizationHeader: "Bearer operator-token",
        authClient,
        internalAdminEmails: "maya@fundloop.example.com",
      }),
    ).resolves.toMatchObject({
      ok: true,
      auth: {
        actorRole: "internal_operator",
        isInternalOperator: true,
      },
    })
  })

  it("blocks operator tools for non-operator actors before handler execution", async () => {
    const registry = createBaseMcpToolRegistry()
    registry.register({
      definition: {
        name: "operator.cycles.list",
        description: "List operator cycles.",
        inputSchema: { type: "object", properties: {}, additionalProperties: false },
      },
      handler: vi.fn(() => {
        throw new Error("handler should not run")
      }),
    })

    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    const result = await registry.call("operator.cycles.list", {}, { auth: { ...auth, userId: "user-1" }, edge })
    expect(result).toMatchObject({ isError: true, errorCode: "forbidden" })
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("authorization_failure"))
    expect(warn.mock.calls[0]?.[0]).not.toContain("test-token")
    warn.mockRestore()
  })

  it("blocks operator Edge commands for non-operator actors even when allowlisted", async () => {
    const registry = createBaseMcpToolRegistry({ allowedFunctionNames: ["monthly-cycle-lock"] })
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    const result = await registry.call(
      "fundloop.edge_command.invoke",
      { functionName: "monthly-cycle-lock", input: { cycleKey: "2026-04" } },
      { auth: { ...auth, userId: "user-1" }, edge },
    )

    expect(result).toMatchObject({ isError: true, errorCode: "forbidden" })
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("authorization_failure"))
    expect(warn.mock.calls[0]?.[0]).not.toContain("monthly-cycle-lock")
    expect(warn.mock.calls[0]?.[0]).not.toContain("2026-04")
    warn.mockRestore()
  })
})
