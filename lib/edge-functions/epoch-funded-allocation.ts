import { invokeBrowserEdgeCommand } from "./invoke"
import type { EpochFundedAllocationInput } from "./epoch-funded-allocation-contract"

export type EpochFundedAllocationOutput =
  | { action: "read"; allocations: unknown[] }
  | { action: "preview"; previewHash: string; artifact: { resultHash: string; capMultiple: string; totals: Record<string, string> } }
  | { action: "lock"; manifestId: number; manifestHash: string; manifest: unknown }
  | { action: "calculate"; manifestId: number; runId: number; artifact: { resultHash: string } }

export function invokeEpochFundedAllocationBrowser(input: EpochFundedAllocationInput) {
  return invokeBrowserEdgeCommand<EpochFundedAllocationInput, EpochFundedAllocationOutput>("epoch-funded-allocation", input)
}
