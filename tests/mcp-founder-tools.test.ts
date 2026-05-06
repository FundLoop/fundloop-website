import { describe, expect, it } from "vitest"
import { edgeCommandSuccess, type EdgeCommandResult } from "@/lib/edge-functions/result"
import {
  PROJECT_CRYPTO_ROUTE_CREATE_FUNCTION,
  PROJECT_CRYPTO_ROUTE_UPDATE_FUNCTION,
  PROJECT_ONCHAIN_PAYMENT_SUBMISSION_RECORD_FUNCTION,
} from "@/lib/edge-functions/project-payment-operations-contract"
import { registerFounderMcpTools } from "@/packages/mcp-server/src/founder-tools"
import { createBaseMcpToolRegistry } from "@/packages/mcp-server/src/tools"
import type { EdgeCommandClient } from "@/packages/mcp-server/src/edge-client"
import type { FounderWorkflowReader } from "@/packages/mcp-server/src/founder-reader"

const auth = {
  actorRole: "founder" as const,
  bearerToken: "token",
  userId: "founder-1",
  email: "founder@example.com",
  subject: "founder@example.com",
}

const founderReader: FounderWorkflowReader = {
  async listManagedProjects() {
    return [{ id: 7, slug: "civic-mesh", name: "Civic Mesh" }]
  },
  async getProjectCycleStatus(input) {
    return {
      project: { id: 7, slug: input.projectSlug, name: "Civic Mesh" },
      cycle: { cycleKey: input.cycleKey ?? "2026-04", status: "locked" },
      payments: { count: 2, confirmedCount: 1, awaitingConfirmationCount: 1, totalContributionAmount: 90 },
      routes: { enabledCount: 1, defaultCount: 1 },
    }
  },
}

function createEdgeClient(calls: Array<{ functionName: string; input: unknown }>): EdgeCommandClient {
  return {
    async invoke<TInput, TOutput>(functionName: string, input: TInput): Promise<EdgeCommandResult<TOutput>> {
      calls.push({ functionName, input })
      return edgeCommandSuccess({ accepted: true }) as EdgeCommandResult<TOutput>
    },
  }
}

function createRegistry() {
  const registry = createBaseMcpToolRegistry()
  registerFounderMcpTools(registry)
  return registry
}

describe("founder MCP tools", () => {
  it("registers founder workflow tools", () => {
    expect(createRegistry().list().map((tool) => tool.name)).toEqual(
      expect.arrayContaining([
        "founder.projects.list",
        "founder.project.cycle_status",
        "founder.project.crypto_route.create",
        "founder.project.crypto_route.update",
        "founder.project.onchain_receipt.record",
      ]),
    )
  })

  it("reads managed projects and project cycle status through the founder reader boundary", async () => {
    const registry = createRegistry()
    const context = { auth, edge: createEdgeClient([]), founderReader }

    const projects = await registry.call("founder.projects.list", {}, context)
    expect(projects.content[0]?.text).toContain("civic-mesh")

    const cycle = await registry.call("founder.project.cycle_status", { projectSlug: "civic-mesh", cycleKey: "2026-04" }, context)
    expect(cycle.content[0]?.text).toContain("locked")
    expect(cycle.content[0]?.text).toContain("90")
  })

  it("routes founder operational writes through typed Edge Function commands", async () => {
    const calls: Array<{ functionName: string; input: unknown }> = []
    const registry = createRegistry()
    const context = { auth, edge: createEdgeClient(calls), founderReader }

    await registry.call(
      "founder.project.crypto_route.create",
      { projectSlug: "civic-mesh", chainId: 1, chainAssetId: 2, intakeContractId: 3 },
      context,
    )
    await registry.call(
      "founder.project.crypto_route.update",
      { projectSlug: "civic-mesh", paymentMethodId: 10, label: "Main route" },
      context,
    )
    await registry.call(
      "founder.project.onchain_receipt.record",
      { projectSlug: "civic-mesh", paymentId: 11, paymentMethodId: 10, txHash: `0x${"a".repeat(64)}` },
      context,
    )

    expect(calls.map((call) => call.functionName)).toEqual([
      PROJECT_CRYPTO_ROUTE_CREATE_FUNCTION,
      PROJECT_CRYPTO_ROUTE_UPDATE_FUNCTION,
      PROJECT_ONCHAIN_PAYMENT_SUBMISSION_RECORD_FUNCTION,
    ])
  })

  it("returns a protocol-visible error when founder reads are not configured", async () => {
    const result = await createRegistry().call("founder.projects.list", {}, { auth, edge: createEdgeClient([]) })

    expect(result.isError).toBe(true)
    expect(result.content[0]?.text).toContain("not configured")
  })
})
