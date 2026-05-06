import { describe, expect, it } from "vitest"
import { edgeCommandSuccess, type EdgeCommandResult } from "@/lib/edge-functions/result"
import { createMcpAuthContext } from "@/packages/mcp-server/src/auth"
import { createBaseMcpToolRegistry } from "@/packages/mcp-server/src/tools"
import { encodeMcpStdioMessage, handleMcpRequest, parseMcpStdioMessages } from "@/packages/mcp-server/src/server"
import type { EdgeCommandClient } from "@/packages/mcp-server/src/edge-client"

const auth = {
  actorRole: "founder" as const,
  bearerToken: "test-token",
  userId: "user-1",
  email: "founder@example.com",
  subject: "founder@example.com",
}

const edge: EdgeCommandClient = {
  async invoke<TInput, TOutput>(functionName: string, input: TInput): Promise<EdgeCommandResult<TOutput>> {
    return edgeCommandSuccess({ functionName, input }) as EdgeCommandResult<TOutput>
  },
}

describe("FundLoop MCP server skeleton", () => {
  it("requires an MCP bearer token for Edge Function calls", () => {
    expect(() => createMcpAuthContext({}, {})).toThrow("FUNDLOOP_MCP_BEARER_TOKEN")
    expect(createMcpAuthContext({}, { FUNDLOOP_MCP_BEARER_TOKEN: "token" })).toMatchObject({
      actorRole: "founder",
      bearerToken: "token",
    })
  })

  it("lists base tools and calls health", async () => {
    const registry = createBaseMcpToolRegistry()
    expect(registry.list().map((tool) => tool.name)).toEqual(["fundloop.health", "fundloop.edge_command.invoke"])

    const result = await registry.call("fundloop.health", {}, { auth, edge })
    expect(result.isError).toBeUndefined()
    expect(result.content[0]?.text).toContain("fundloop-mcp-server")
  })

  it("invokes Edge Function commands through the shared command envelope", async () => {
    const registry = createBaseMcpToolRegistry({ allowedFunctionNames: ["project-crypto-route-create"] })
    const result = await registry.call(
      "fundloop.edge_command.invoke",
      { functionName: "project-crypto-route-create", input: { projectSlug: "civic-mesh" } },
      { auth, edge },
    )

    expect(result.content[0]?.text).toContain("project-crypto-route-create")
    expect(result.content[0]?.text).toContain("civic-mesh")
  })

  it("rejects non-allowlisted generic Edge Function invocations", async () => {
    const registry = createBaseMcpToolRegistry()
    const result = await registry.call(
      "fundloop.edge_command.invoke",
      { functionName: "project-crypto-route-create", input: { projectSlug: "civic-mesh" } },
      { auth, edge },
    )

    expect(result.isError).toBe(true)
    expect(result.content[0]?.text).toContain("not allowlisted")
  })

  it("handles initialize, tools/list, and tools/call JSON-RPC requests", async () => {
    const context = {
      auth,
      edge,
      registry: createBaseMcpToolRegistry(),
    }

    await expect(handleMcpRequest({ jsonrpc: "2.0", id: 1, method: "initialize" }, context)).resolves.toMatchObject({
      result: {
        serverInfo: { name: "fundloop-mcp-server" },
      },
    })
    await expect(handleMcpRequest({ jsonrpc: "2.0", id: 2, method: "tools/list" }, context)).resolves.toMatchObject({
      result: {
        tools: expect.arrayContaining([expect.objectContaining({ name: "fundloop.health" })]),
      },
    })
    await expect(
      handleMcpRequest(
        {
          jsonrpc: "2.0",
          id: 3,
          method: "tools/call",
          params: { name: "fundloop.health", arguments: {} },
        },
        context,
      ),
    ).resolves.toMatchObject({
      result: {
        content: [expect.objectContaining({ type: "text" })],
      },
    })
  })

  it("parses and serializes MCP Content-Length stdio frames", () => {
    const first = { jsonrpc: "2.0", id: 1, method: "initialize" }
    const second = { jsonrpc: "2.0", id: 2, method: "tools/list" }
    const firstBody = JSON.stringify(first)
    const secondBody = JSON.stringify(second)
    const framed = Buffer.from(
      `Content-Length: ${Buffer.byteLength(firstBody, "utf8")}\r\n\r\n${firstBody}` +
        `Content-Length: ${Buffer.byteLength(secondBody, "utf8")}\r\n\r\n${secondBody}`,
    )

    expect(parseMcpStdioMessages(framed)).toEqual({
      messages: [first, second],
      remaining: Buffer.alloc(0),
    })

    expect(encodeMcpStdioMessage({ jsonrpc: "2.0", id: 1, result: { ok: true } })).toBe(
      'Content-Length: 45\r\n\r\n{"jsonrpc":"2.0","id":1,"result":{"ok":true}}',
    )
  })
})
