import type { McpAuthContext } from "./auth.ts"
import { MCP_WORKFLOW_READ_FUNCTION } from "../../../lib/edge-functions/mcp-workflow-read-contract.ts"
import type { EdgeCommandClient } from "./edge-client.ts"

export type FounderManagedProjectSummary = {
  id: number
  slug: string | null
  name: string
}

export type FounderProjectCycleStatus = {
  project: FounderManagedProjectSummary
  cycle: {
    cycleKey: string | null
    status: string | null
  }
  payments: {
    count: number
    confirmedCount: number
    awaitingConfirmationCount: number
    totalContributionAmount: number
  }
  routes: {
    enabledCount: number
    defaultCount: number
  }
}

export type FounderWorkflowReader = {
  listManagedProjects(auth: McpAuthContext): Promise<FounderManagedProjectSummary[]>
  getProjectCycleStatus(input: { projectSlug: string; cycleKey?: string }, auth: McpAuthContext): Promise<FounderProjectCycleStatus>
}

function requireEdgeData<T>(result: Awaited<ReturnType<EdgeCommandClient["invoke"]>>): T {
  if (!result.ok) {
    throw new Error(result.error.message)
  }

  return result.data as T
}

export class EdgeFounderWorkflowReader implements FounderWorkflowReader {
  private readonly edge: EdgeCommandClient

  constructor(edge: EdgeCommandClient) {
    this.edge = edge
  }

  async listManagedProjects(auth: McpAuthContext): Promise<FounderManagedProjectSummary[]> {
    return requireEdgeData(
      await this.edge.invoke(
        MCP_WORKFLOW_READ_FUNCTION,
        {
          operation: "founder.projects.list",
        },
        auth,
      ),
    )
  }

  async getProjectCycleStatus(
    input: { projectSlug: string; cycleKey?: string },
    auth: McpAuthContext,
  ): Promise<FounderProjectCycleStatus> {
    return requireEdgeData(
      await this.edge.invoke(
        MCP_WORKFLOW_READ_FUNCTION,
        {
          operation: "founder.project.cycle_status",
          projectSlug: input.projectSlug,
          cycleKey: input.cycleKey,
        },
        auth,
      ),
    )
  }
}

export function createEdgeFounderWorkflowReader(edge: EdgeCommandClient) {
  return new EdgeFounderWorkflowReader(edge)
}
