import type { BrowserContext, Page } from "@playwright/test"

export const PERSONA_IDS = [
  "new-member",
  "returning-member",
  "new-founder",
  "returning-founder",
  "returning-operator",
] as const

export type PersonaId = (typeof PERSONA_IDS)[number]
export type CheckpointMode = "required" | "expected-pending"
export type CheckpointStatus = "pass" | "expected-pending" | "fail"
export type RunStatus = "passed" | "incomplete" | "failed"
export type EvidenceValue = string | number | boolean | null
export type SanitizedEvidence = Readonly<Record<string, EvidenceValue>>
export type PendingCapabilityId = "member-withdrawal" | "project-invitation-persistence"
export type ActorAlias =
  | "fixture-inviter"
  | "new-member"
  | "returning-member"
  | "new-founder"
  | "returning-founder"
  | "returning-operator"

export type CapabilityRegistryEntry = {
  capabilityId: PendingCapabilityId
  state: "expected-pending"
  reasonCode: string
  ownerUrl: string
  rationale: string
}
export type CapabilityRegistry = Readonly<Record<PendingCapabilityId, CapabilityRegistryEntry>>

export type RunIdentity = {
  runId: string
  selectedPersonas: readonly PersonaId[]
  startedAt: string
}

export type CycleClock = {
  baseCycleKey: string
  cycleKeyFor: (personaId: PersonaId, offset?: number) => string
  boundsFor: (cycleKey: string) => { periodStart: string; periodEnd: string }
}

/** New actors remain provisional until the public OTP flow returns an Auth user. */
export type ProvisionalActorHandle = {
  alias: "new-member" | "new-founder"
  authUserId: null
  kind: "new"
}

export type ActorHandle = {
  alias: ActorAlias
  authUserId: string
  kind: "new" | "stored" | "operator" | "fixture"
}

export type OwnedDatabaseRecord = {
  table: string
  primaryKey: Readonly<Record<string, string | number>>
  cleanupPhase: number
}

export type OwnedInvitation = {
  code: string
  createdByUserId: string
  maxUses: 1
}

export type OwnedCycle = {
  cycleId: number | null
  cycleKey: string
  operatorNoteMarker: string
  createdByUserId: string
  state: "planned" | "created" | "clean"
}

export type OwnershipLedger = {
  schemaVersion: 1
  run: RunIdentity
  state: "arranging" | "running" | "cleaning" | "clean"
  records: readonly OwnedDatabaseRecord[]
  authUserIds: readonly string[]
  storagePaths: readonly string[]
  invitations: readonly OwnedInvitation[]
  cycles: readonly OwnedCycle[]
}

export type CleanupResult = {
  status: "clean" | "residual"
  deletedCount: number
  residualCount: number
  reasonCode: string | null
}

export type FixtureController = {
  ledger: OwnershipLedger
  checkpoint: () => Promise<void>
  cleanup: () => Promise<CleanupResult>
}

export type ControlledCadenceDriver = {
  advanceThroughApproval: (cycleKey: string) => Promise<SanitizedEvidence>
  createBookkeepingCredits: (cycleKey: string) => Promise<SanitizedEvidence>
}

export type SanitizedEvidenceSink = {
  add: (checkpointId: string, evidence: SanitizedEvidence) => void
}

export type ServiceOwnership = {
  supabase: "caller"
  mailpit: "caller"
  next: "runner"
  nextPid: number | null
}

export type PersonaContext = {
  run: RunIdentity
  personaId: PersonaId
  actor: ActorHandle
  browserContext: BrowserContext
  page: Page
  clock: CycleClock
  fixtures: FixtureController
  cadence: ControlledCadenceDriver
  evidence: SanitizedEvidenceSink
  services: ServiceOwnership
}

export type CheckpointBase = {
  id: string
  title: string
  actorAlias: ActorAlias
  surface: "browser" | "controlled-command" | "fixture-observation"
  execute: (context: PersonaContext) => Promise<CheckpointObservation>
}

export type PersonaCheckpoint = CheckpointBase &
  (
    | { mode: "required"; capabilityId: string }
    | { mode: "expected-pending"; capabilityId: PendingCapabilityId }
  )

export type PersonaJourney = {
  id: PersonaId
  title: string
  actorKind: "new" | "returning" | "operator"
  checkpoints: readonly PersonaCheckpoint[]
}

export type CheckpointObservation = {
  outcome: "observed" | "capability-unavailable"
  evidence: SanitizedEvidence
  reasonCode?: string
}

export type CheckpointResult = {
  checkpointId: string
  capabilityId: string
  status: CheckpointStatus
  durationMs: number
  reasonCode: string | null
  evidence: SanitizedEvidence
}

export type PersonaResult = {
  personaId: PersonaId
  status: RunStatus
  durationMs: number
  checkpoints: readonly CheckpointResult[]
  cleanup: CleanupResult
}

export type HarnessRunSummary = {
  schemaVersion: 1
  runId: string
  selectedPersonas: readonly PersonaId[]
  unselectedPersonas: readonly PersonaId[]
  status: RunStatus
  exitCode: 0 | 1 | 2
  startedAt: string
  durationMs: number
  cycleKeys: Readonly<Partial<Record<PersonaId, string>>>
  services: Omit<ServiceOwnership, "nextPid">
  personas: readonly PersonaResult[]
  cleanup: CleanupResult
}
