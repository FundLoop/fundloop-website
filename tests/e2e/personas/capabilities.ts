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
} as const satisfies CapabilityRegistry
