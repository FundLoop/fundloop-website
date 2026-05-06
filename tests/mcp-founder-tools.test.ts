import { describe, expect, it } from "vitest"
import { edgeCommandFailure, edgeCommandSuccess, type EdgeCommandResult } from "@/lib/edge-functions/result"
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
    return [{ id: 7, slug: "civic-mesh", name: "Civic Mesh", setupStatus: "ready", nextActions: ["Review cycle status"] }]
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

function createFailingEdgeClient(calls: Array<{ functionName: string; input: unknown }>, code: string, message: string): EdgeCommandClient {
  return {
    async invoke<TInput, TOutput>(functionName: string, input: TInput): Promise<EdgeCommandResult<TOutput>> {
      calls.push({ functionName, input })
      return edgeCommandFailure(code, message)
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
    const tools = createRegistry().list()
    expect(tools.map((tool) => tool.name)).toEqual(
      expect.arrayContaining([
        "founder.projects.list",
        "founder.project.cycle_status",
        "founder.project.crypto_route.create",
        "founder.project.crypto_route.update",
        "founder.project.onchain_receipt.record",
      ]),
    )
    expect(tools.find((tool) => tool.name === "founder.projects.list")).toMatchObject({
      title: "List Founder Projects",
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
      outputSchema: expect.objectContaining({
        required: expect.arrayContaining(["ok", "count", "projects"]),
      }),
    })
    expect(tools.find((tool) => tool.name === "founder.project.cycle_status")).toMatchObject({
      title: "Read Founder Project Cycle Status",
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
      outputSchema: expect.objectContaining({
        required: expect.arrayContaining(["ok", "project", "cycle", "payments", "routes", "nextActions"]),
      }),
    })
    expect(tools.find((tool) => tool.name === "founder.project.crypto_route.create")).toMatchObject({
      title: "Create Founder Crypto Route",
      annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
      outputSchema: expect.objectContaining({
        required: expect.arrayContaining(["ok"]),
      }),
    })
    expect(tools.find((tool) => tool.name === "founder.project.crypto_route.update")).toMatchObject({
      title: "Update Founder Crypto Route",
      annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
      inputSchema: expect.objectContaining({
        required: expect.arrayContaining(["projectSlug", "paymentMethodId", "chainId", "chainAssetId", "intakeContractId", "isDefault"]),
      }),
      outputSchema: expect.objectContaining({
        required: expect.arrayContaining(["ok"]),
      }),
    })
  })

  it("reads managed projects and project cycle status through the founder reader boundary", async () => {
    const registry = createRegistry()
    const context = { auth, edge: createEdgeClient([]), founderReader }

    const projects = await registry.call("founder.projects.list", {}, context)
    expect(projects.content[0]?.text).toContain("civic-mesh")
    expect(projects.structuredContent).toMatchObject({
      ok: true,
      count: 1,
      projects: [
        {
          id: 7,
          slug: "civic-mesh",
          name: "Civic Mesh",
          setupStatus: "ready",
          nextActions: ["Review cycle status"],
        },
      ],
    })
    expect(projects.content[0]?.text).not.toContain("token")

    const cycle = await registry.call("founder.project.cycle_status", { projectSlug: "civic-mesh", cycleKey: "2026-04" }, context)
    expect(cycle.content[0]?.text).toContain("locked")
    expect(cycle.content[0]?.text).toContain("90")
    expect(cycle.structuredContent).toMatchObject({
      ok: true,
      project: { id: 7, slug: "civic-mesh", name: "Civic Mesh" },
      cycle: { cycleKey: "2026-04", status: "locked" },
      payments: { awaitingConfirmationCount: 1 },
      routes: { enabledCount: 1, defaultCount: 1 },
      nextActions: ["Review payments awaiting confirmation."],
    })
  })

  it("routes founder operational writes through typed Edge Function commands", async () => {
    const calls: Array<{ functionName: string; input: unknown }> = []
    const registry = createRegistry()
    const context = { auth, edge: createEdgeClient(calls), founderReader }

    const createResult = await registry.call(
      "founder.project.crypto_route.create",
      { projectSlug: "civic-mesh", chainId: 1, chainAssetId: 2, intakeContractId: 3 },
      context,
    )
    const updateResult = await registry.call(
      "founder.project.crypto_route.update",
      {
        projectSlug: "civic-mesh",
        paymentMethodId: 10,
        chainId: 1,
        chainAssetId: 2,
        intakeContractId: 3,
        label: "Main route",
        isDefault: true,
      },
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
    expect(createResult.structuredContent).toMatchObject({ ok: true, data: { accepted: true } })
    expect(updateResult.structuredContent).toMatchObject({ ok: true, data: { accepted: true } })
  })

  it("rejects malformed crypto route create input before dispatch", async () => {
    const calls: Array<{ functionName: string; input: unknown }> = []
    const registry = createRegistry()
    const context = { auth, edge: createEdgeClient(calls), founderReader }

    const invalidChain = await registry.call(
      "founder.project.crypto_route.create",
      { projectSlug: "civic-mesh", chainId: 0, chainAssetId: 2, intakeContractId: 3 },
      context,
    )
    const oversizedLabel = await registry.call(
      "founder.project.crypto_route.create",
      { projectSlug: "civic-mesh", chainId: 1, chainAssetId: 2, intakeContractId: 3, label: "x".repeat(120) },
      context,
    )

    expect(invalidChain).toMatchObject({ isError: true, errorCode: "invalid_payload" })
    expect(oversizedLabel).toMatchObject({ isError: true, errorCode: "payload_too_large" })
    expect(calls).toHaveLength(0)
  })

  it("returns stable errors when crypto route create is rejected by the Edge command", async () => {
    const calls: Array<{ functionName: string; input: unknown }> = []
    const registry = createRegistry()
    const result = await registry.call(
      "founder.project.crypto_route.create",
      { projectSlug: "civic-mesh", chainId: 1, chainAssetId: 2, intakeContractId: 3 },
      {
        auth,
        edge: createFailingEdgeClient(calls, "duplicate_route", "A route already exists for this asset."),
        founderReader,
      },
    )

    expect(calls).toHaveLength(1)
    expect(result).toMatchObject({
      isError: true,
      errorCode: "duplicate_route",
      structuredContent: { ok: false, error: { code: "duplicate_route" } },
    })
    expect(result.content[0]?.text).toContain("already exists")
  })

  it("rejects malformed crypto route update input before dispatch", async () => {
    const calls: Array<{ functionName: string; input: unknown }> = []
    const registry = createRegistry()
    const context = { auth, edge: createEdgeClient(calls), founderReader }

    const missingReference = await registry.call(
      "founder.project.crypto_route.update",
      { projectSlug: "civic-mesh", paymentMethodId: 10, chainId: 1, chainAssetId: 2, isDefault: true },
      context,
    )
    const invalidDefault = await registry.call(
      "founder.project.crypto_route.update",
      { projectSlug: "civic-mesh", paymentMethodId: 10, chainId: 1, chainAssetId: 2, intakeContractId: 3, isDefault: "yes" },
      context,
    )

    expect(missingReference).toMatchObject({ isError: true, errorCode: "invalid_payload" })
    expect(invalidDefault).toMatchObject({ isError: true, errorCode: "invalid_payload" })
    expect(calls).toHaveLength(0)
  })

  it("returns stable errors when crypto route update is rejected by the Edge command", async () => {
    const calls: Array<{ functionName: string; input: unknown }> = []
    const registry = createRegistry()
    const result = await registry.call(
      "founder.project.crypto_route.update",
      {
        projectSlug: "civic-mesh",
        paymentMethodId: 10,
        chainId: 1,
        chainAssetId: 2,
        intakeContractId: 3,
        label: "Main route",
        isDefault: false,
      },
      {
        auth,
        edge: createFailingEdgeClient(calls, "route_not_found", "Payment route was not found."),
        founderReader,
      },
    )

    expect(calls).toHaveLength(1)
    expect(result).toMatchObject({
      isError: true,
      errorCode: "route_not_found",
      structuredContent: { ok: false, error: { code: "route_not_found" } },
    })
    expect(result.content[0]?.text).toContain("not found")
  })

  it("returns a protocol-visible error when founder reads are not configured", async () => {
    const result = await createRegistry().call("founder.projects.list", {}, { auth, edge: createEdgeClient([]) })

    expect(result).toMatchObject({ isError: true, errorCode: "reader_not_configured" })
    expect(result.content[0]?.text).toContain("not configured")
  })

  it("returns a calm empty state when no managed projects are visible", async () => {
    const emptyReader: FounderWorkflowReader = {
      ...founderReader,
      async listManagedProjects() {
        return []
      },
    }
    const result = await createRegistry().call("founder.projects.list", {}, { auth, edge: createEdgeClient([]), founderReader: emptyReader })

    expect(result.structuredContent).toMatchObject({
      ok: true,
      count: 0,
      projects: [],
      emptyState: "No managed projects are available for this actor.",
    })
  })

  it("returns a safe error when the founder project reader fails", async () => {
    const failingReader: FounderWorkflowReader = {
      ...founderReader,
      async listManagedProjects() {
        throw new Error("select * from private_table with service_role_key")
      },
    }
    const result = await createRegistry().call("founder.projects.list", {}, { auth, edge: createEdgeClient([]), founderReader: failingReader })

    expect(result).toMatchObject({ isError: true, errorCode: "workflow_read_failed" })
    expect(result.content[0]?.text).toContain("temporarily unavailable")
    expect(result.content[0]?.text).not.toContain("private_table")
    expect(result.content[0]?.text).not.toContain("service_role")
  })

  it("rejects malformed founder project list input before the reader runs", async () => {
    const result = await createRegistry().call("founder.projects.list", { unexpected: true }, { auth, edge: createEdgeClient([]), founderReader })

    expect(result).toMatchObject({ isError: true, errorCode: "invalid_payload" })
    expect(result.content[0]?.text).toContain("unexpected")
  })

  it("rejects invalid founder project cycle input before the reader runs", async () => {
    const registry = createRegistry()
    const invalidCycle = await registry.call(
      "founder.project.cycle_status",
      { projectSlug: "civic-mesh", cycleKey: "2026-99" },
      { auth, edge: createEdgeClient([]), founderReader },
    )
    const invalidSlug = await registry.call(
      "founder.project.cycle_status",
      { projectSlug: "https://127.0.0.1/private" },
      { auth, edge: createEdgeClient([]), founderReader },
    )

    expect(invalidCycle).toMatchObject({ isError: true, errorCode: "invalid_payload" })
    expect(invalidSlug).toMatchObject({ isError: true, errorCode: "invalid_payload" })
  })

  it("returns safe errors for founder project cycle reader failures", async () => {
    const failingReader: FounderWorkflowReader = {
      ...founderReader,
      async getProjectCycleStatus() {
        throw new Error("private artifact path: bucket/secret/report.json")
      },
    }

    const result = await createRegistry().call(
      "founder.project.cycle_status",
      { projectSlug: "civic-mesh" },
      { auth, edge: createEdgeClient([]), founderReader: failingReader },
    )

    expect(result).toMatchObject({ isError: true, errorCode: "workflow_read_failed" })
    expect(result.content[0]?.text).toContain("temporarily unavailable")
    expect(result.content[0]?.text).not.toContain("bucket/secret")
  })

  it("returns cycle next actions for missing setup state", async () => {
    const setupReader: FounderWorkflowReader = {
      ...founderReader,
      async getProjectCycleStatus(input) {
        return {
          project: { id: 7, slug: input.projectSlug, name: "Civic Mesh" },
          cycle: { cycleKey: null, status: null },
          payments: { count: 0, confirmedCount: 0, awaitingConfirmationCount: 0, totalContributionAmount: 0 },
          routes: { enabledCount: 0, defaultCount: 0 },
        }
      },
    }

    const result = await createRegistry().call(
      "founder.project.cycle_status",
      { projectSlug: "civic-mesh" },
      { auth, edge: createEdgeClient([]), founderReader: setupReader },
    )

    expect(result.structuredContent).toMatchObject({
      nextActions: [
        "Add an enabled contribution route.",
        "Choose a default contribution route.",
        "Confirm the project is attached to an active monthly cycle.",
      ],
    })
  })
})
