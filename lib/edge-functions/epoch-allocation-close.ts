import { invokeBrowserEdgeCommand } from "./invoke"
import type { EpochAllocationCloseInput } from "./epoch-allocation-close-contract"

export type EpochAllocationCloseOutput =
  | { action: "approve"; closePackageId: number; approvalId: number; rootHash: string; status: "root_review_required" }
  | { action: "confirm_root"; closePackageId: number; approvalId: number; rootHash: string; status: "payout_readying" }
  | { action: "read"; scope: "operator" | "user" | "project"; rows: unknown[] }

export function invokeEpochAllocationCloseBrowser(input: EpochAllocationCloseInput) {
  return invokeBrowserEdgeCommand<EpochAllocationCloseInput, EpochAllocationCloseOutput>("epoch-allocation-close", input)
}
