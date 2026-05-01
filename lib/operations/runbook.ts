export type OperationsRunbookSection = {
  id: string
  title: string
  description: string
  owner: "Operators" | "Superadmins" | "Release manager"
  status: "active" | "watch" | "manual"
  primaryActionHref: string
  primaryActionLabel: string
  secondaryActionHref?: string
  secondaryActionLabel?: string
  docsPath: string
  checks: string[]
  escalation: string
}

export const OPERATIONS_RUNBOOK_SECTIONS: OperationsRunbookSection[] = [
  {
    id: "release-health",
    title: "Release and deployment health",
    description: "Confirm app gates, Supabase migration dry-runs, function deploys, and branch-targeted environments before a release is treated as healthy.",
    owner: "Release manager",
    status: "active",
    primaryActionHref: "/admin/payments/deployments",
    primaryActionLabel: "Review deployment state",
    secondaryActionHref: "/admin/cycles/observability",
    secondaryActionLabel: "Review cycle events",
    docsPath: "docs/engineering/supabase-deployments.md",
    checks: [
      "Confirm GitHub CI is green for lint, tests, typecheck, build, and contracts.",
      "Confirm Supabase Deploy dry-run or deploy targeted the intended Preview or Production environment.",
      "Confirm Edge Function secrets already exist in the target Supabase project before relying on deployed functions.",
    ],
    escalation: "Pause release promotion if migrations, function deployment, or runtime secret checks disagree between GitHub and Supabase.",
  },
  {
    id: "monthly-cycle",
    title: "Monthly cycle operations",
    description: "Move the economic month through lock, prep, calculation, verification, payout, and reporting with one canonical cycle as the anchor.",
    owner: "Operators",
    status: "active",
    primaryActionHref: "/admin/cycles",
    primaryActionLabel: "Open monthly cycles",
    secondaryActionHref: "/admin/cycles/observability",
    secondaryActionLabel: "Review cycle events",
    docsPath: "docs/engineering/monthly-cycles.md",
    checks: [
      "Lock only open cycles and review unresolved onchain submissions before applying an override.",
      "Use prep review to resolve missing datasets, identity artifacts, and stale identity snapshots before calculation.",
      "Treat locked manifests and generated artifacts as immutable audit records.",
    ],
    escalation: "If cycle state and artifact state diverge, stop transitions and use observability events plus storage references to identify the last safe checkpoint.",
  },
  {
    id: "identity-sync",
    title: "CUBID identity sync health",
    description: "Inspect stale snapshots and sync errors before identity-sensitive onboarding, calculation, payout, or reporting work depends on them.",
    owner: "Operators",
    status: "watch",
    primaryActionHref: "/admin/identity",
    primaryActionLabel: "Open identity health",
    docsPath: "docs/engineering/cubid-identity.md",
    checks: [
      "Look for linked or verified users without snapshots.",
      "Review last sync error codes before rerunning identity-dependent operations.",
      "Remember that CUBID owns full name, email, phone, social/provider stamps, verification state, and score.",
    ],
    escalation: "If CUBID API failures are widespread, pause new identity-sensitive publishes and cycle prep until the upstream issue is understood.",
  },
  {
    id: "payment-payout-incidents",
    title: "Payments, reconciliation, and payouts",
    description: "Handle inbound receipt issues, reconciliation failures, payout intent generation, and chain/rail-specific execution from the operator control plane.",
    owner: "Operators",
    status: "active",
    primaryActionHref: "/admin/payments",
    primaryActionLabel: "Open payments",
    secondaryActionHref: "/admin/payments/reconciliation",
    secondaryActionLabel: "Open reconciliation",
    docsPath: "docs/engineering/execution-interface.md",
    checks: [
      "Confirm founder payment writes are going through typed Edge Function commands.",
      "Use reconciliation visibility before confirming or retrying submitted onchain receipts.",
      "Keep EVM, Solana, and fiat behavior behind the chain-abstracted execution interface.",
    ],
    escalation: "If receipt state, chain state, and payment status disagree, stop automatic progression and preserve the unresolved submission for audit.",
  },
  {
    id: "artifact-retention",
    title: "Storage artifacts and evidence",
    description: "Verify reports, zkAS packages, run manifests, exports, and proof attachments use the canonical private Supabase Storage buckets and paths.",
    owner: "Operators",
    status: "manual",
    primaryActionHref: "/admin/cycles",
    primaryActionLabel: "Open cycle artifacts",
    secondaryActionHref: "/admin/cycles/observability",
    secondaryActionLabel: "Open artifact events",
    docsPath: "docs/engineering/storage-artifacts.md",
    checks: [
      "Use shared storage path helpers instead of inline object-path assembly.",
      "Do not expose private storage contents directly to public pages or MCP tools.",
      "Create replacement artifacts instead of mutating published or locked artifacts.",
    ],
    escalation: "If an artifact is missing or appears overwritten, compare the database artifact reference, cycle events, and storage object path before repairing metadata.",
  },
]

export function getOperationsRunbookSection(id: string) {
  return OPERATIONS_RUNBOOK_SECTIONS.find((section) => section.id === id) ?? null
}
