import { describe, expect, it } from "vitest"
import { validateMcpWorkflowReadInput } from "@/lib/edge-functions/mcp-workflow-read-contract"

describe("mcp workflow read contract", () => {
  it("accepts the authenticated user workspace summary operation without extra inputs", () => {
    expect(validateMcpWorkflowReadInput({ operation: "user.workspace.summary" })).toMatchObject({
      ok: true,
      data: { operation: "user.workspace.summary" },
    })
  })

  it("accepts the authenticated user payout route list operation without extra inputs", () => {
    expect(validateMcpWorkflowReadInput({ operation: "user.payout.routes.list" })).toMatchObject({
      ok: true,
      data: { operation: "user.payout.routes.list" },
    })
  })

  it("rejects unsupported user workspace operations", () => {
    expect(validateMcpWorkflowReadInput({ operation: "user.workspace.raw_profile" })).toMatchObject({
      ok: false,
      error: { code: "invalid_payload" },
    })
  })
})
