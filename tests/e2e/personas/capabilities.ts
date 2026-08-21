import type { CapabilityRegistry } from "./contracts"

export const CAPABILITY_REGISTRY = {
  "founder-distribution-after-operator-cadence": {
    capabilityId: "founder-distribution-after-operator-cadence",
    state: "expected-pending",
    reasonCode: "operator-cadence-owned-by-task-102",
    ownerUrl: "https://github.com/FundLoop/fundloop-website/issues/102",
    rationale: "Founder inputs can be submitted independently, but the operator cadence and resulting distribution are owned by Task #102.",
  },
} as const satisfies CapabilityRegistry
