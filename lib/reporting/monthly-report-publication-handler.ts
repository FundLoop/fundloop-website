import { validateMonthlyReportPublicationInput, type MonthlyReportPublicationInput } from "../edge-functions/monthly-report-publication-contract.ts"
import { edgeCommandFailure, edgeCommandSuccess } from "../edge-functions/result.ts"
import { assertSafeStorageObjectPath, buildMonthlyCycleReportPublicationPath, STORAGE_BUCKETS } from "../storage/artifacts.ts"

type User = { id: string; email?: string | null }
type AuthResult = { ok: boolean; user?: User | null; adminClient?: unknown; code?: string; error?: string }
type PreparedArtifact = {
  artifactId: string | number
  cycleKey: string
  closePackageId: string | number
  audience: "public" | "user" | "founder" | "operator" | "mcp"
  version: number
  pathToken: string
  artifactBytes: string
  artifactHash: string
  artifactPath: string
}
type OperationResult<T = unknown> = { data: T | null; error: { message: string } | null }

export type MonthlyReportPublicationOperations = {
  rpc(name: string, args: Record<string, unknown>): Promise<OperationResult>
  upload(path: string, bytes: Uint8Array): Promise<OperationResult>
  download(path: string): Promise<OperationResult<Blob>>
  remove(paths: string[]): Promise<OperationResult>
  read(input: MonthlyReportPublicationInput): Promise<OperationResult<unknown[]>>
  isFounder(userId: string, projectId: string): Promise<OperationResult<boolean>>
}

type Dependencies = {
  authenticate(request: Request): Promise<AuthResult>
  environment(): string
  isInternal(email: string | null): boolean
  operations(adminClient: unknown): MonthlyReportPublicationOperations
}

function response(body: unknown) {
  return new Response(JSON.stringify(body), { headers: { "content-type": "application/json" } })
}

async function sha256Hex(value: Uint8Array) {
  const bytes = Uint8Array.from(value)
  return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes.buffer)))
    .map((byte) => byte.toString(16).padStart(2, "0")).join("")
}

function command(input: MonthlyReportPublicationInput, userId: string, environment: string) {
  return {
    contractVersion: `monthly_cycle_reports_${input.action}.v2`, deploymentEnvironment: environment,
    actorUserId: userId, closePackageId: input.closePackageId, rootHash: input.rootHash,
    expectedCurrentVersion: input.expectedCurrentVersion, regenerationKey: input.regenerationKey,
    artifactId: input.artifactId, reason: input.reason,
  }
}

async function recordFailure(operations: MonthlyReportPublicationOperations, value: Record<string, unknown>) {
  try {
    const result = await operations.rpc("record_monthly_report_publication_failure", { p_command: value })
    return !result.error
  } catch { return false }
}

async function verifiedDownload(operations: MonthlyReportPublicationOperations, artifact: PreparedArtifact, expectedBytes: Uint8Array) {
  const downloaded = await operations.download(artifact.artifactPath)
  if (downloaded.error || !downloaded.data) return false
  const observed = new Uint8Array(await downloaded.data.arrayBuffer())
  if (observed.length !== expectedBytes.length) return false
  for (let index = 0; index < observed.length; index += 1) if (observed[index] !== expectedBytes[index]) return false
  return await sha256Hex(observed) === artifact.artifactHash
}

async function publish(operations: MonthlyReportPublicationOperations, input: MonthlyReportPublicationInput, userId: string, environment: string) {
  const prepared = await operations.rpc("prepare_monthly_cycle_report_publication", { p_command: command(input, userId, environment) })
  if (prepared.error) return edgeCommandFailure("monthly_report_prepare_failed", prepared.error.message)
  const artifacts = (prepared.data as { artifacts?: PreparedArtifact[] } | null)?.artifacts
  if (!Array.isArray(artifacts) || artifacts.length === 0) return edgeCommandFailure("monthly_report_prepare_failed", "No artifacts were prepared.")
  const uploaded: string[] = []
  for (const artifact of artifacts) {
    const expectedPath = buildMonthlyCycleReportPublicationPath({
      cycleKey: artifact.cycleKey, closePackageId: artifact.closePackageId, audience: artifact.audience,
      pathToken: artifact.pathToken, version: artifact.version, artifactHash: artifact.artifactHash,
    })
    const bytes = new TextEncoder().encode(artifact.artifactBytes)
    if (expectedPath !== artifact.artifactPath || await sha256Hex(bytes) !== artifact.artifactHash) {
      const audited = await recordFailure(operations, { ...command(input, userId, environment), failureCode: "prepared_artifact_mismatch", artifactId: artifact.artifactId })
      return edgeCommandFailure(audited ? "monthly_report_artifact_mismatch" : "monthly_report_failure_audit_failed", "Prepared artifact bytes, hash, or path do not match.")
    }
    const upload = await operations.upload(artifact.artifactPath, bytes)
    if (!upload.error) uploaded.push(artifact.artifactPath)
    if (upload.error && !await verifiedDownload(operations, artifact, bytes)) {
      if (uploaded.length) await operations.remove(uploaded)
      const audited = await recordFailure(operations, { ...command(input, userId, environment), failureCode: "upload_failed", artifactId: artifact.artifactId })
      return edgeCommandFailure(audited ? "monthly_report_upload_failed" : "monthly_report_failure_audit_failed", upload.error.message)
    }
    if (!await verifiedDownload(operations, artifact, bytes)) {
      if (uploaded.length) await operations.remove(uploaded)
      const audited = await recordFailure(operations, { ...command(input, userId, environment), failureCode: "readback_mismatch", artifactId: artifact.artifactId })
      return edgeCommandFailure(audited ? "monthly_report_readback_mismatch" : "monthly_report_failure_audit_failed", "Stored report bytes or hash do not match.")
    }
  }
  const evidence = artifacts.map((artifact) => ({ artifactId: String(artifact.artifactId), artifactPath: artifact.artifactPath, artifactHash: artifact.artifactHash }))
  const finalized = await operations.rpc("finalize_monthly_cycle_report_publication", { p_command: { ...command(input, userId, environment), artifacts: evidence } })
  if (finalized.error) {
    const audited = await recordFailure(operations, { ...command(input, userId, environment), failureCode: "finalize_failed", artifacts: evidence })
    return edgeCommandFailure(audited ? "monthly_report_finalize_failed" : "monthly_report_failure_audit_failed", finalized.error.message)
  }
  return edgeCommandSuccess({ action: "publish", ...(finalized.data as Record<string, unknown>) })
}

export function createMonthlyReportPublicationHandler(dependencies: Dependencies) {
  return async function handleRequest(request: Request) {
    if (request.method !== "POST") return response(edgeCommandFailure("method_not_allowed", "POST required."))
    let body: unknown
    try { body = await request.json() } catch { return response(edgeCommandFailure("invalid_payload", "Request body must be valid JSON.")) }
    const validated = validateMonthlyReportPublicationInput(body)
    if (!validated.ok) return response(validated)
    const input = validated.data
    const auth = await dependencies.authenticate(request)
    const environment = dependencies.environment().trim().toLowerCase()
    if (!["local", "dev", "development", "test", "preview"].includes(environment)) {
      return response(edgeCommandFailure("monthly_report_runtime_disabled", "Reporting commands are disabled."))
    }
    const publicAnonymousRead = input.action === "read" && input.audience === "public"
    if ((!auth.ok || !auth.user) && !publicAnonymousRead) return response(edgeCommandFailure(auth.code ?? "not_authenticated", auth.error ?? "Authentication is required."))
    if (!auth.adminClient) return response(edgeCommandFailure("monthly_report_runtime_unavailable", "Reporting backend is unavailable."))
    const operations = dependencies.operations(auth.adminClient)
    const user = auth.user ?? null
    const internal = dependencies.isInternal(user?.email ?? null)

    if (input.action === "read") {
      if (input.audience === "user" && user?.id !== input.subjectUserId) return response(edgeCommandFailure("forbidden", "Cross-user report access is forbidden."))
      if (input.audience === "founder") {
        if (!user) return response(edgeCommandFailure("not_authenticated", "Authentication is required."))
        const membership = await operations.isFounder(user.id, input.subjectProjectId!)
        if (membership.error || membership.data !== true) return response(edgeCommandFailure("forbidden", "Founder project access is required."))
      }
      if (["operator", "mcp"].includes(input.audience!) && !internal) return response(edgeCommandFailure("forbidden", "Internal operator access is required."))
      const result = await operations.read(input)
      return response(result.error ? edgeCommandFailure("monthly_report_read_failed", result.error.message) : edgeCommandSuccess({ action: "read", reports: result.data ?? [] }))
    }

    if (!user || !internal) return response(edgeCommandFailure("forbidden", "Internal operator access is required."))
    if (input.action === "publish") return response(await publish(operations, input, user.id, environment))
    if (input.action === "tombstone") {
      const prepared = await operations.rpc("prepare_monthly_cycle_report_tombstone", { p_command: command(input, user.id, environment) })
      if (prepared.error) return response(edgeCommandFailure("monthly_report_tombstone_prepare_failed", prepared.error.message))
      const path = (prepared.data as { artifactPath?: string } | null)?.artifactPath
      if (path) {
        try { assertSafeStorageObjectPath(path) } catch { return response(edgeCommandFailure("monthly_report_tombstone_path_invalid", "Stored artifact path is unsafe.")) }
        const removed = await operations.remove([path])
        if (removed.error) return response(edgeCommandFailure("monthly_report_tombstone_storage_failed", removed.error.message))
      }
      const finalized = await operations.rpc("finalize_monthly_cycle_report_tombstone", { p_command: command(input, user.id, environment) })
      if (finalized.error) {
        const audited = await recordFailure(operations, { ...command(input, user.id, environment), failureCode: "tombstone_finalize_failed" })
        return response(edgeCommandFailure(audited ? "monthly_report_tombstone_failed" : "monthly_report_failure_audit_failed", finalized.error.message))
      }
      return response(edgeCommandSuccess({ action: "tombstone", ...(finalized.data as Record<string, unknown>) }))
    }
    const rpc = input.action === "generate" ? "generate_monthly_cycle_reports" : "regenerate_monthly_cycle_reports"
    const result = await operations.rpc(rpc, { p_command: command(input, user.id, environment) })
    return response(result.error ? edgeCommandFailure("monthly_report_command_failed", result.error.message) : edgeCommandSuccess({ action: input.action, ...(result.data as Record<string, unknown>) }))
  }
}

export function createSupabaseMonthlyReportOperations(adminClient: any): MonthlyReportPublicationOperations {
  return {
    rpc: (name, args) => adminClient.rpc(name, args),
    upload: (path, bytes) => adminClient.storage.from(STORAGE_BUCKETS.monthlyCycleReports).upload(path, bytes, { contentType: "application/json", cacheControl: "31536000", upsert: false }),
    download: (path) => adminClient.storage.from(STORAGE_BUCKETS.monthlyCycleReports).download(path),
    remove: (paths) => adminClient.storage.from(STORAGE_BUCKETS.monthlyCycleReports).remove(paths),
    read: async (input) => {
      let query = adminClient.from("monthly_cycle_report_artifacts")
        .select("id,audience,subject_user_id,subject_project_id,version,artifact,artifact_hash,published_at,state,monthly_cycles!inner(cycle_key)")
        .eq("state", "published").eq("audience", input.audience)
      if (input.cycleKey) query = query.eq("monthly_cycles.cycle_key", input.cycleKey)
      if (input.subjectUserId) query = query.eq("subject_user_id", input.subjectUserId)
      if (input.subjectProjectId) query = query.eq("subject_project_id", input.subjectProjectId)
      return query.order("published_at", { ascending: false })
    },
    isFounder: async (userId, projectId) => {
      const result = await adminClient.from("participants").select("project_id").eq("project_id", projectId).eq("user_id", userId).eq("is_admin", true).maybeSingle()
      return { data: Boolean(result.data), error: result.error }
    },
  }
}
