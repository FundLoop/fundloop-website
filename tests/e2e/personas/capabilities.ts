import type { CapabilityRegistry } from "./contracts"

export const CAPABILITY_REGISTRY = {
  "member-withdrawal": {
    capabilityId: "member-withdrawal",
    state: "expected-pending",
    reasonCode: "withdrawal-not-implemented",
    ownerUrl: "https://github.com/FundLoop/fundloop-website/issues/96",
    rationale: "Credited earnings do not yet have a safe local withdrawal executor.",
  },
  "project-invitation-persistence": {
    capabilityId: "project-invitation-persistence",
    state: "expected-pending",
    reasonCode: "invitation-persistence-not-implemented",
    ownerUrl: "https://github.com/FundLoop/fundloop-website/issues/96",
    rationale: "The current invitation control does not persist or deliver an invitation.",
  },
  "founder-distribution-after-operator-cadence": {
    capabilityId: "founder-distribution-after-operator-cadence",
    state: "expected-pending",
    reasonCode: "operator-cadence-owned-by-task-102",
    ownerUrl: "https://github.com/FundLoop/fundloop-website/issues/102",
    rationale: "Founder inputs can be submitted independently, but the operator cadence and resulting distribution are owned by Task #102.",
  },
} as const satisfies CapabilityRegistry
