import { createHash } from "node:crypto"

export type EvidenceEnvironment = "dev" | "production"
export type EvidenceGateName = "deploy" | "parity" | "hostedAcceptance" | "productionDeploy" | "cutover" | "goLive"

type MigrationItem = { version: string; name: string; fileSha256: string }
type FunctionItem = { name: string; sourceSha256: string; remoteVersion: number | null; remoteStatus: string }
type Inventory<T> = { algorithm: string; inventorySha256: string; items: T[] }
type Gate = { status: "pass" | "fail" | "pending"; evidenceSha256: string; evaluatedAt: string; blockers: string[] }

export type ProductionReadinessManifest = {
  contractVersion: "fundloop.production-readiness/v1"
  manifestId: string
  generatedAt: string
  environment: EvidenceEnvironment
  candidate: {
    repository: "FundLoop/fundloop-website"
    gitSha: string
    treeSha: string
    sourceRef: string
    pullRequest: number
    applicationDeploymentId: string
  }
  expected: {
    migrationInventory: Inventory<MigrationItem>
    functionInventory: Inventory<FunctionItem>
    schemaFingerprint: { algorithm: string; postgresMajor: number; normalizedSchemaSha256: string }
  }
  observed: {
    observedAt: string
    environment: EvidenceEnvironment
    projectRef: string
    applicationDeploymentId: string
    applicationGitSha: string
    githubRunId: number
    githubRunAttempt: number
    migrationInventory: Inventory<MigrationItem>
    functionInventory: Inventory<FunctionItem>
    schemaFingerprint: { algorithm: string; postgresMajor: number; normalizedSchemaSha256: string }
  }
  deployment: {
    githubRunId: number
    githubRunAttempt: number
    headSha: string
    workflowFileSha256: string
    supabaseCliVersion: string
    postgresClientVersion: string
    conclusion: string
    databaseStep: string
    functionStep: string
    startedAt: string
    completedAt: string
  }
  prerequisites: Array<{ prerequisiteId: string; status: string; evidenceSha256: string; observedAt: string }>
  githubControls: {
    observedAt: string
    baseBranch: "dev" | "main"
    pullRequestRequired: boolean
    requiredChecks: string[]
    productionEnvironment: "Production"
    requiredReviewerCount: number
    adminBypassAllowed: boolean
  }
  runtimeControls: {
    observedAt: string
    source: string
    sourceSha256: string
    neutralPostingEnabled: boolean
    cutoverPrepareEnabled: boolean
    cutoverActivationEnabled: boolean
    productionValueFlowEnabled: boolean
  }
  capabilities: Array<{ capabilityId: string; state: string; evidenceSha256: string; observedAt: string; environment: string; subject: string }>
  allocationV2: Record<string, unknown>
  approvals: Array<{
    approvalType: string
    status: string
    artifactSha256: string
    scopeManifestSha256: string
    approverRole: string
    recordedAt: string
    expiresAt: string
  }>
  alerts: Array<{
    code: string
    severity: string
    subject: string
    firstObservedAt: string
    owner: string
    deliveryStatus: string
    evidenceSha256: string
  }>
  gates: Record<EvidenceGateName, Gate>
}

export type EvidenceEvaluation = {
  blocking: string[]
  warnings: string[]
  informational: string[]
  approvalScopeSha256: string
}

const EXPECTED_PROJECT_REFS: Record<EvidenceEnvironment, string> = {
  dev: "kyxtqnfnksvcaugxwzuj",
  production: "tpouimiyfmvucrerfhfc",
}

const REQUIRED_CHECKS = ["CI / validate", "CI / Supabase fresh-schema replay", "Supabase dry-run"]
const CUTOVER_APPROVALS = ["legal", "accounting", "privacy-retention", "provider", "opening-balance", "cutover", "rollback"]
const GO_LIVE_APPROVALS = [...CUTOVER_APPROVALS, "go-live"]
const REQUIRED_PREREQUISITES: Record<EvidenceEnvironment, string[]> = {
  dev: ["fresh-replay", "upgrade-rehearsal", "migration-plan-review", "expected-inventory", "required-secret-presence", "provider-runtime-classification"],
  production: ["fresh-replay", "upgrade-rehearsal", "migration-plan-review", "expected-inventory", "required-secret-presence", "provider-runtime-classification", "backup-restore-rehearsal", "rollback-rehearsal", "protection-read-back", "professional-packet-status", "production-deploy-approval"],
}

function compareAscii(left: string, right: string) {
  return left < right ? -1 : left > right ? 1 : 0
}

function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`
  return `{${Object.entries(value as Record<string, unknown>).sort(([left], [right]) => compareAscii(left, right)).map(([key, entry]) => `${JSON.stringify(key)}:${canonicalJson(entry)}`).join(",")}}`
}

function sha256(value: unknown) {
  return createHash("sha256").update(canonicalJson(value)).digest("hex")
}

export function migrationInventorySha256(items: MigrationItem[]) {
  return sha256(items.map(({ version, name, fileSha256 }) => ({ version, name, fileSha256 })))
}

export function functionInventorySha256(items: FunctionItem[]) {
  return sha256(items.map(({ name, sourceSha256 }) => ({ name, sourceSha256 })))
}

export function approvalScopeSha256(manifest: ProductionReadinessManifest) {
  return sha256({
    contractVersion: manifest.contractVersion,
    environment: manifest.environment,
    candidate: manifest.candidate,
    expected: manifest.expected,
    observed: manifest.observed,
    deployment: manifest.deployment,
    prerequisites: manifest.prerequisites,
    githubControls: manifest.githubControls,
    runtimeControls: manifest.runtimeControls,
    capabilities: manifest.capabilities,
    allocationV2: manifest.allocationV2,
  })
}

function timestamp(value: string) {
  const parsed = Date.parse(value)
  return Number.isFinite(parsed) ? parsed : Number.NaN
}

function orderedUnique<T>(items: T[], name: (item: T) => string) {
  const names = items.map(name)
  return {
    duplicates: names.filter((entry, index) => names.indexOf(entry) !== index),
    ordered: names.every((entry, index) => index === 0 || compareAscii(names[index - 1]!, entry) < 0),
  }
}

export function evaluateProductionReadinessManifest(manifest: ProductionReadinessManifest): EvidenceEvaluation {
  const blocking = new Set<string>()
  const warnings = new Set<string>()
  const informational = new Set<string>()
  const deployBlockers = new Set<string>()
  const parityBlockers = new Set<string>()
  const hostedBlockers = new Set<string>()
  const productionBlockers = new Set<string>()
  const cutoverBlockers = new Set<string>()
  const goLiveBlockers = new Set<string>()
  const add = (code: string, ...groups: Set<string>[]) => {
    blocking.add(code)
    for (const group of groups) group.add(code)
  }

  const generatedAt = timestamp(manifest.generatedAt)
  const deploymentStartedAt = timestamp(manifest.deployment.startedAt)
  const deploymentCompletedAt = timestamp(manifest.deployment.completedAt)
  if (!Number.isFinite(generatedAt) || !Number.isFinite(deploymentStartedAt) || !Number.isFinite(deploymentCompletedAt) || deploymentStartedAt > deploymentCompletedAt || deploymentCompletedAt > generatedAt) {
    add("deployment-time", deployBlockers, parityBlockers)
  }

  if (manifest.candidate.gitSha !== manifest.deployment.headSha) add("deployment-sha", deployBlockers, parityBlockers)
  if (manifest.candidate.sourceRef !== `refs/heads/${manifest.environment === "dev" ? "dev" : "main"}`) add("deployment-ref", deployBlockers, parityBlockers)
  if (manifest.deployment.conclusion !== "success" || manifest.deployment.databaseStep !== "success" || manifest.deployment.functionStep !== "success") add("deployment-incomplete", deployBlockers, parityBlockers)
  if (manifest.observed.environment !== manifest.environment) add("environment-binding", parityBlockers)
  if (manifest.observed.projectRef !== EXPECTED_PROJECT_REFS[manifest.environment]) add("project-binding", parityBlockers)
  if (manifest.observed.applicationDeploymentId !== manifest.candidate.applicationDeploymentId) add("application-deployment-binding", parityBlockers)
  if (manifest.observed.applicationGitSha !== manifest.candidate.gitSha) add("application-sha-binding", parityBlockers)
  if (manifest.observed.githubRunId !== manifest.deployment.githubRunId || manifest.observed.githubRunAttempt !== manifest.deployment.githubRunAttempt) add("workflow-run-binding", parityBlockers)
  if (manifest.expected.schemaFingerprint.algorithm !== "pg17-public-schema-normalized-v2" || manifest.observed.schemaFingerprint.algorithm !== "pg17-public-schema-normalized-v2") add("schema-fingerprint-algorithm", parityBlockers)

  for (const [subject, observedAt] of [
    ["backend", manifest.observed.observedAt],
    ["github-controls", manifest.githubControls.observedAt],
    ["runtime-controls", manifest.runtimeControls.observedAt],
  ] as const) {
    const observed = timestamp(observedAt)
    if (!Number.isFinite(observed) || observed < deploymentCompletedAt || observed > generatedAt) add(`observation-time:${subject}`, parityBlockers)
  }

  const compareInventory = <T extends { name: string }>(kind: "migration" | "function", expected: Inventory<T>, observed: Inventory<T>, digest: (items: T[]) => string, itemDigest: (item: T) => string) => {
    for (const [side, inventory] of [["expected", expected], ["observed", observed]] as const) {
      const order = orderedUnique(inventory.items, (item) => item.name)
      if (order.duplicates.length) add(`duplicate-${kind}:${side}`, parityBlockers)
      if (!order.ordered) add(`${kind}-order:${side}`, parityBlockers)
      if (inventory.inventorySha256 !== digest(inventory.items)) add(`${kind}-inventory-digest:${side}`, parityBlockers)
    }
    const observedByName = new Map(observed.items.map((entry) => [entry.name, entry]))
    for (const entry of expected.items) {
      const remote = observedByName.get(entry.name)
      if (!remote) add(`missing-${kind}:${entry.name}`, parityBlockers)
      else if (itemDigest(entry) !== itemDigest(remote)) add(`${kind}-digest:${entry.name}`, parityBlockers)
    }
    const expectedNames = new Set(expected.items.map((entry) => entry.name))
    for (const entry of observed.items) if (!expectedNames.has(entry.name)) add(`unexpected-${kind}:${entry.name}`, parityBlockers)
  }

  compareInventory("migration", manifest.expected.migrationInventory, manifest.observed.migrationInventory, migrationInventorySha256, (item) => (item as MigrationItem).fileSha256)
  compareInventory("function", manifest.expected.functionInventory, manifest.observed.functionInventory, functionInventorySha256, (item) => (item as FunctionItem).sourceSha256)
  for (const [side, inventory] of [["expected", manifest.expected.migrationInventory], ["observed", manifest.observed.migrationInventory]] as const) {
    for (const entry of inventory.items) if (!entry.name.startsWith(`${entry.version}_`)) add(`migration-version-name:${side}:${entry.name}`, parityBlockers)
  }
  for (const entry of manifest.observed.functionInventory.items) if (entry.remoteStatus !== "ACTIVE" || entry.remoteVersion === null) add(`function-inactive:${entry.name}`, parityBlockers)
  if (manifest.expected.schemaFingerprint.normalizedSchemaSha256 !== manifest.observed.schemaFingerprint.normalizedSchemaSha256) add("schema-fingerprint", parityBlockers)

  const prerequisiteIds = new Set(manifest.prerequisites.map((entry) => entry.prerequisiteId))
  if (prerequisiteIds.size !== manifest.prerequisites.length) add("duplicate-prerequisite", deployBlockers)
  for (const required of REQUIRED_PREREQUISITES[manifest.environment]) if (!prerequisiteIds.has(required)) add(`prerequisite-missing:${required}`, deployBlockers)
  for (const prerequisite of manifest.prerequisites) {
    if (prerequisite.status !== "pass") add(`prerequisite-not-passed:${prerequisite.prerequisiteId}`, deployBlockers)
    const observed = timestamp(prerequisite.observedAt)
    if (!Number.isFinite(observed) || observed > generatedAt) add(`prerequisite-time:${prerequisite.prerequisiteId}`, deployBlockers)
  }

  const expectedBranch = manifest.environment === "dev" ? "dev" : "main"
  if (manifest.githubControls.baseBranch !== expectedBranch) add("protection-branch", deployBlockers)
  if (!manifest.githubControls.pullRequestRequired) add("protection-missing:pull-request", deployBlockers)
  for (const check of REQUIRED_CHECKS) if (!manifest.githubControls.requiredChecks.includes(check)) add(`protection-missing:check:${check}`, deployBlockers)
  if (manifest.githubControls.requiredReviewerCount < 1) add("protection-missing:production-reviewer", deployBlockers)
  if (manifest.githubControls.adminBypassAllowed) add("protection-missing:admin-bypass", deployBlockers)

  const capabilityIds = new Set(manifest.capabilities.map((capability) => capability.capabilityId))
  if (capabilityIds.size !== manifest.capabilities.length) add("duplicate-capability", hostedBlockers)
  for (const capability of manifest.capabilities) {
    if (capability.environment !== manifest.environment) add(`capability-environment:${capability.capabilityId}`, hostedBlockers)
    const observed = timestamp(capability.observedAt)
    if (!Number.isFinite(observed) || observed < deploymentCompletedAt || observed > generatedAt) add(`capability-time:${capability.capabilityId}`, hostedBlockers)
  }

  const scopeHash = approvalScopeSha256(manifest)
  const approvals = new Map(manifest.approvals.map((approval) => [approval.approvalType, approval]))
  if (approvals.size !== manifest.approvals.length) add("duplicate-approval", deployBlockers)
  for (const approval of manifest.approvals) {
    if (approval.status === "approved" && approval.scopeManifestSha256 !== scopeHash) add(`approval-stale:${approval.approvalType}`, deployBlockers)
    if (approval.status === "approved" && (timestamp(approval.recordedAt) > generatedAt || timestamp(approval.expiresAt) <= generatedAt)) add(`approval-stale:${approval.approvalType}`, deployBlockers)
  }
  const requireApprovals = (types: string[], group: Set<string>) => {
    for (const type of types) if (approvals.get(type)?.status !== "approved") add(`approval-missing:${type}`, group)
  }
  const hasFreshScopedApprovals = (types: string[]) => types.every((type) => {
    const approval = approvals.get(type)
    return approval?.status === "approved"
      && approval.scopeManifestSha256 === scopeHash
      && timestamp(approval.recordedAt) <= generatedAt
      && timestamp(approval.expiresAt) > generatedAt
  })
  if (manifest.gates.deploy.status === "pass" || manifest.gates.parity.status === "pass") requireApprovals(["code-review"], deployBlockers)
  if (manifest.gates.productionDeploy.status === "pass") requireApprovals(["code-review", "production-deploy", "rollback"], productionBlockers)
  if (manifest.gates.cutover.status === "pass") requireApprovals(CUTOVER_APPROVALS, cutoverBlockers)
  if (manifest.gates.goLive.status === "pass") requireApprovals(GO_LIVE_APPROVALS, goLiveBlockers)

  const cutoverAuthorized = manifest.environment === "production"
    && manifest.gates.productionDeploy.status === "pass"
    && manifest.gates.productionDeploy.blockers.length === 0
    && manifest.gates.cutover.status === "pass"
    && manifest.gates.cutover.blockers.length === 0
    && hasFreshScopedApprovals(CUTOVER_APPROVALS)
  const goLiveAuthorized = cutoverAuthorized
    && manifest.gates.goLive.status === "pass"
    && manifest.gates.goLive.blockers.length === 0
    && hasFreshScopedApprovals(GO_LIVE_APPROVALS)

  if ((manifest.runtimeControls.cutoverPrepareEnabled || manifest.runtimeControls.cutoverActivationEnabled) && !cutoverAuthorized) add("cutover-control-enabled-before-approval", cutoverBlockers, goLiveBlockers)
  if (manifest.runtimeControls.productionValueFlowEnabled && !goLiveAuthorized) add("value-flow-enabled-before-go-live", goLiveBlockers)
  if (manifest.environment === "production" && manifest.runtimeControls.neutralPostingEnabled && !goLiveAuthorized) add("neutral-posting-enabled-before-go-live", goLiveBlockers)

  for (const alert of manifest.alerts) {
    if (alert.severity === "blocking" && alert.deliveryStatus !== "delivered") add(`alert-delivery-failed:${alert.code}`, deployBlockers)
  }

  for (const code of deployBlockers) parityBlockers.add(code)
  for (const code of parityBlockers) hostedBlockers.add(code)
  for (const code of parityBlockers) productionBlockers.add(code)
  for (const code of productionBlockers) cutoverBlockers.add(code)
  for (const code of cutoverBlockers) goLiveBlockers.add(code)

  if (manifest.gates.parity.status === "pass" && manifest.gates.deploy.status !== "pass") add("gate-dependency:parity")
  if (manifest.gates.hostedAcceptance.status === "pass" && manifest.gates.parity.status !== "pass") add("gate-dependency:hostedAcceptance")
  if (manifest.gates.productionDeploy.status === "pass" && (manifest.gates.parity.status !== "pass" || manifest.environment !== "production")) add("gate-dependency:productionDeploy")
  if (manifest.gates.cutover.status === "pass" && manifest.gates.productionDeploy.status !== "pass") add("gate-dependency:cutover")
  if (manifest.gates.goLive.status === "pass" && manifest.gates.cutover.status !== "pass") add("gate-dependency:goLive")

  const gateGroups: Record<EvidenceGateName, Set<string>> = { deploy: deployBlockers, parity: parityBlockers, hostedAcceptance: hostedBlockers, productionDeploy: productionBlockers, cutover: cutoverBlockers, goLive: goLiveBlockers }
  for (const [name, gate] of Object.entries(manifest.gates) as Array<[EvidenceGateName, Gate]>) {
    if (gate.status === "pass" && (gate.blockers.length > 0 || gateGroups[name].size > 0)) add(`gate-contradiction:${name}`)
    if (gate.status !== "pass" && gate.blockers.length === 0) add(`gate-contradiction:${name}`)
    const evaluated = timestamp(gate.evaluatedAt)
    if (!Number.isFinite(evaluated) || evaluated > generatedAt) add(`gate-time:${name}`)
  }

  return {
    blocking: [...blocking].sort(),
    warnings: [...warnings].sort(),
    informational: [...informational].sort(),
    approvalScopeSha256: scopeHash,
  }
}
