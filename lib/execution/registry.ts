import { evmExecutionAdapter } from "./adapters/evm.ts"
import { fiatStubExecutionAdapter } from "./adapters/fiat-stub.ts"
import { solanaExecutionAdapter } from "./adapters/solana.ts"
import { executionFailure, isExecutionRail, type FundLoopExecutionAdapter, type FundLoopExecutionRail } from "./types.ts"

const adapters = {
  evm: evmExecutionAdapter,
  solana: solanaExecutionAdapter,
  fiat_stub: fiatStubExecutionAdapter,
} satisfies Record<FundLoopExecutionRail, FundLoopExecutionAdapter>

export function getExecutionAdapter(rail: FundLoopExecutionRail) {
  return adapters[rail]
}

export function resolveExecutionAdapter(rail: string) {
  if (!isExecutionRail(rail)) {
    return executionFailure("unsupported_rail", `Unsupported execution rail: ${rail}`, { rail: null })
  }

  return { ok: true as const, data: getExecutionAdapter(rail) }
}

export function listExecutionAdapterCapabilities() {
  return Object.values(adapters).map((adapter) => ({
    rail: adapter.rail,
    capabilities: adapter.capabilities,
  }))
}
