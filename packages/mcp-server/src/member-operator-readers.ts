import type { McpAuthContext } from "./auth.ts"
import { MCP_WORKFLOW_READ_FUNCTION } from "../../../lib/edge-functions/mcp-workflow-read-contract.ts"
import type { EdgeCommandClient } from "./edge-client.ts"

export type ProjectMemberReportingStatus = {
  projectSlug: string
  cycleKey: string | null
  reports: {
    founderReportCount: number
    artifactCount: number
  }
  attribution: {
    approvedDatasetCount: number
    pendingDatasetCount: number
  }
}

export type OperatorCycleStatus = {
  cycleKey: string
  status: string
  lockedAt: string | null
  calculationStartedAt: string | null
  distributionStartedAt: string | null
  reportingPublishedAt: string | null
}

export type OperatorCycleEvent = {
  cycleKey: string
  eventType: string
  outcome: string
  severity: string
  attemptId: string
  message: string | null
  createdAt: string
}

export type OperatorReconciliationVisibility = {
  submitted: number
  confirming: number
  awaitingConfirmation: number
  confirmed: number
  failed: number
}

export type OperatorReportingCoverage = {
  cycleKey: string | null
  publicReports: number
  userReports: number
  founderReports: number
  operatorReports: number
  artifactCount: number
}

export type ProjectMemberWorkflowReader = {
  getProjectReportingStatus(
    input: { projectSlug: string; cycleKey?: string },
    auth: McpAuthContext,
  ): Promise<ProjectMemberReportingStatus>
}

export type OperatorWorkflowReader = {
  listCycleStatuses(auth: McpAuthContext): Promise<OperatorCycleStatus[]>
  listCycleEvents(input: { cycleKey?: string; attemptId?: string }, auth: McpAuthContext): Promise<OperatorCycleEvent[]>
  getReconciliationVisibility(auth: McpAuthContext): Promise<OperatorReconciliationVisibility>
  getReportingCoverage(input: { cycleKey?: string }, auth: McpAuthContext): Promise<OperatorReportingCoverage>
}

async function invokeRead<T>(edge: EdgeCommandClient, input: Record<string, unknown>, auth: McpAuthContext): Promise<T> {
  const result = await edge.invoke(MCP_WORKFLOW_READ_FUNCTION, input, auth)
  if (!result.ok) {
    throw new Error(result.error.message)
  }

  return result.data as T
}

export class EdgeProjectMemberWorkflowReader implements ProjectMemberWorkflowReader {
  private readonly edge: EdgeCommandClient

  constructor(edge: EdgeCommandClient) {
    this.edge = edge
  }

  async getProjectReportingStatus(
    input: { projectSlug: string; cycleKey?: string },
    auth: McpAuthContext,
  ): Promise<ProjectMemberReportingStatus> {
    return invokeRead(this.edge, { operation: "project_member.project.reporting_status", ...input }, auth)
  }
}

export class EdgeOperatorWorkflowReader implements OperatorWorkflowReader {
  private readonly edge: EdgeCommandClient

  constructor(edge: EdgeCommandClient) {
    this.edge = edge
  }

  async listCycleStatuses(auth: McpAuthContext): Promise<OperatorCycleStatus[]> {
    return invokeRead(this.edge, { operation: "operator.cycles.list" }, auth)
  }

  async listCycleEvents(input: { cycleKey?: string; attemptId?: string }, auth: McpAuthContext): Promise<OperatorCycleEvent[]> {
    return invokeRead(this.edge, { operation: "operator.cycle.observability", ...input }, auth)
  }

  async getReconciliationVisibility(auth: McpAuthContext): Promise<OperatorReconciliationVisibility> {
    return invokeRead(this.edge, { operation: "operator.payments.reconciliation_visibility" }, auth)
  }

  async getReportingCoverage(input: { cycleKey?: string }, auth: McpAuthContext): Promise<OperatorReportingCoverage> {
    return invokeRead(this.edge, { operation: "operator.reporting.coverage", ...input }, auth)
  }
}

export function createEdgeProjectMemberWorkflowReader(edge: EdgeCommandClient) {
  return new EdgeProjectMemberWorkflowReader(edge)
}

export function createEdgeOperatorWorkflowReader(edge: EdgeCommandClient) {
  return new EdgeOperatorWorkflowReader(edge)
}
