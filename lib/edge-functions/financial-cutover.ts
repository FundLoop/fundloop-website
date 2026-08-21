import { invokeBrowserEdgeCommand } from "./invoke"
import type { FinancialCutoverInput } from "./financial-cutover-contract"

export type FinancialCutoverOutput = {
  action: FinancialCutoverInput["action"]
  result?: unknown
  report?: unknown[]
  sources?: unknown[]
  noValueTransferred: true
}

export function invokeFinancialCutoverBrowser(input: FinancialCutoverInput) {
  return invokeBrowserEdgeCommand<FinancialCutoverInput, FinancialCutoverOutput>("financial-cutover", input)
}
