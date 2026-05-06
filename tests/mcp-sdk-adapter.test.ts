import { describe, expect, it, vi } from "vitest"
import { createRemoteMcpAuthContext } from "@/packages/mcp-server/src/http-auth"
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
        description: expect.stringContaining("health"),
        inputSchema: expect.any(Object),
      }),
      expect.any(Function),
    )

    const healthHandler = registerTool.mock.calls.find(([name]) => name === "fundloop.health")?.[2]
    await expect(healthHandler({})).resolves.toMatchObject({
      content: [expect.objectContaining({ text: expect.stringContaining("fundloop-mcp-server") })],
    })
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
})
