// This module is the Node-only service-role boundary for persona fixture setup and cleanup.
import { randomBytes, randomUUID } from "node:crypto"
import { chmod, mkdir, readFile } from "node:fs/promises"
import path from "node:path"
import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "../../../types/supabase"
import type {
  ActorAlias,
  ActorHandle,
  CleanupResult,
  FixtureController,
  OwnedCycle,
  OwnedDatabaseRecord,
  OwnedInvitation,
  OwnershipLedger,
  ProvisionalActorHandle,
  RunIdentity,
} from "../personas/contracts"
import { writeJsonAtomic } from "./persona-reporting"

export type MutableFixtureController = FixtureController & {
  recordDatabaseRow: (record: OwnedDatabaseRecord) => Promise<void>
  recordAuthUser: (authUserId: string) => Promise<void>
  recordStoragePath: (bucketAndPath: string) => Promise<void>
  recordInvitation: (invitation: OwnedInvitation) => Promise<void>
  recordCycle: (cycle: OwnedCycle) => Promise<void>
  markRunning: () => Promise<void>
}

export type StoredActorCredentials = {
  actor: ActorHandle
  email: string
  password: string
}

type CreateControllerInput = {
  run: RunIdentity
  outputRoot?: string
  supabase?: SupabaseClient<Database>
  ledger?: OwnershipLedger
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}

export function createPersonaServiceClient(input: { supabaseUrl: string; serviceRoleKey: string }) {
  return createClient<Database>(input.supabaseUrl, input.serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

export function createRunIdentity(selectedPersonas: RunIdentity["selectedPersonas"], now = new Date()): RunIdentity {
  const timestamp = now.toISOString().replace(/[-:.]/g, "").replace("Z", "Z")
  return {
    runId: `persona-${timestamp}-${randomBytes(4).toString("hex")}`,
    selectedPersonas: [...selectedPersonas],
    startedAt: now.toISOString(),
  }
}

export function provisionalNewActor(alias: "new-member" | "new-founder"): ProvisionalActorHandle {
  return { alias, authUserId: null, kind: "new" }
}

export function establishNewActor(actor: ProvisionalActorHandle, authUserId: string): ActorHandle {
  if (!isUuid(authUserId)) throw new Error("persona-auth-user-id-invalid")
  return { ...actor, authUserId }
}

export async function loadOwnershipLedger(outputRoot: string, runId: string) {
  if (!/^persona-[A-Za-z0-9-]+$/.test(runId)) throw new Error("cleanup-run-id-invalid")
  const filePath = path.join(outputRoot, runId, "ownership-ledger.json")
  const ledger = JSON.parse(await readFile(filePath, "utf8")) as OwnershipLedger
  if (ledger.schemaVersion !== 1 || ledger.run.runId !== runId) throw new Error("ownership-ledger-invalid")
  return ledger
}

export function createPersonaFixtureController(input: CreateControllerInput): MutableFixtureController {
  const outputRoot = input.outputRoot ?? path.join(process.cwd(), "output", "persona-harness")
  const runDirectory = path.join(outputRoot, input.run.runId)
  const ledgerPath = path.join(runDirectory, "ownership-ledger.json")
  let ledger: OwnershipLedger = input.ledger ?? {
    schemaVersion: 1,
    run: input.run,
    state: "arranging",
    records: [],
    authUserIds: [],
    storagePaths: [],
    invitations: [],
    cycles: [],
  }

  const checkpoint = async () => {
    await mkdir(runDirectory, { recursive: true, mode: 0o700 })
    await chmod(runDirectory, 0o700)
    await writeJsonAtomic(ledgerPath, ledger)
    await chmod(ledgerPath, 0o600)
  }

  const mutate = async (next: OwnershipLedger) => {
    ledger = next
    await checkpoint()
  }

  const cleanup = async (): Promise<CleanupResult> => {
    if (ledger.state === "clean") return { status: "clean", deletedCount: 0, residualCount: 0, reasonCode: null }
    await mutate({ ...ledger, state: "cleaning" })
    let deletedCount = 0
    let residualCount = 0

    if (!input.supabase) {
      const ownedCount = ledger.records.length + ledger.authUserIds.length + ledger.storagePaths.length +
        ledger.invitations.length + ledger.cycles.filter((cycle) => cycle.state !== "clean").length
      if (ownedCount > 0) {
        return { status: "residual", deletedCount: 0, residualCount: ownedCount, reasonCode: "cleanup-client-unavailable" }
      }
    } else {
      const supabase = input.supabase
      const fail = () => { residualCount += 1 }

      for (const bucketAndPath of [...ledger.storagePaths].reverse()) {
        const separator = bucketAndPath.indexOf("/")
        if (separator <= 0) { fail(); continue }
        const bucket = bucketAndPath.slice(0, separator)
        const objectPath = bucketAndPath.slice(separator + 1)
        const { error } = await supabase.storage.from(bucket).remove([objectPath])
        if (error) fail(); else deletedCount += 1
      }

      for (const record of [...ledger.records].sort((a, b) => b.cleanupPhase - a.cleanupPhase)) {
        let query = supabase.from(record.table as keyof Database["public"]["Tables"]).delete()
        for (const [key, value] of Object.entries(record.primaryKey)) query = query.eq(key, value)
        const { error } = await query
        if (error) fail(); else deletedCount += 1
      }

      const cleanCycles: OwnedCycle[] = []
      for (const cycle of [...ledger.cycles].reverse()) {
        if (cycle.state === "clean") { cleanCycles.unshift(cycle); continue }
        const { data, error } = await supabase
          .from("monthly_cycles")
          .select("id, cycle_key, operator_note, created_by_user_id")
          .eq("cycle_key", cycle.cycleKey)
          .maybeSingle()
        const ownershipMatches = !data || (
          (cycle.cycleId === null || data.id === cycle.cycleId) &&
          data.operator_note === cycle.operatorNoteMarker &&
          data.created_by_user_id === cycle.createdByUserId
        )
        if (error || !ownershipMatches) { fail(); cleanCycles.unshift(cycle); continue }
        if (data) {
          const deletion = await supabase.from("monthly_cycles").delete().eq("id", data.id)
          if (deletion.error) { fail(); cleanCycles.unshift(cycle); continue }
          deletedCount += 1
        }
        cleanCycles.unshift({ ...cycle, cycleId: data?.id ?? cycle.cycleId, state: "clean" })
      }

      const inviterIds = new Set(ledger.invitations.map((invitation) => invitation.createdByUserId))
      for (const authUserId of [...ledger.authUserIds].reverse().filter((id) => !inviterIds.has(id))) {
        const { error } = await supabase.auth.admin.deleteUser(authUserId)
        if (error) fail(); else deletedCount += 1
      }

      for (const invitation of [...ledger.invitations].reverse()) {
        const { error } = await supabase.from("invitation_codes").delete().eq("code", invitation.code).eq("created_by", invitation.createdByUserId)
        if (error) fail(); else deletedCount += 1
      }

      for (const authUserId of [...ledger.authUserIds].reverse().filter((id) => inviterIds.has(id))) {
        const { error } = await supabase.auth.admin.deleteUser(authUserId)
        if (error) fail(); else deletedCount += 1
      }

      ledger = { ...ledger, cycles: cleanCycles }
    }

    if (residualCount > 0) {
      await checkpoint()
      return { status: "residual", deletedCount, residualCount, reasonCode: "cleanup-residual" }
    }

    await mutate({
      ...ledger,
      state: "clean",
      records: [],
      authUserIds: [],
      storagePaths: [],
      invitations: [],
    })
    return { status: "clean", deletedCount, residualCount: 0, reasonCode: null }
  }

  return {
    get ledger() { return ledger },
    checkpoint,
    cleanup,
    recordDatabaseRow: (record) => mutate({ ...ledger, records: [...ledger.records, record] }),
    recordAuthUser: (authUserId) => {
      if (!isUuid(authUserId)) throw new Error("persona-auth-user-id-invalid")
      return mutate({ ...ledger, authUserIds: [...ledger.authUserIds, authUserId] })
    },
    recordStoragePath: (storagePath) => mutate({ ...ledger, storagePaths: [...ledger.storagePaths, storagePath] }),
    recordInvitation: (invitation) => mutate({ ...ledger, invitations: [...ledger.invitations, invitation] }),
    recordCycle: (cycle) => mutate({ ...ledger, cycles: [...ledger.cycles, cycle] }),
    markRunning: () => mutate({ ...ledger, state: "running" }),
  }
}

export async function createStoredActor(
  supabase: SupabaseClient<Database>,
  controller: MutableFixtureController,
  alias: Exclude<ActorAlias, "new-member" | "new-founder" | "fixture-inviter">,
  kind: "stored" | "operator",
): Promise<StoredActorCredentials> {
  const suffix = randomUUID().slice(0, 8)
  const email = `${alias}-${suffix}@persona.local`
  const password = `${randomBytes(18).toString("base64url")}A1!`
  const { data, error } = await supabase.auth.admin.createUser({ email, password, email_confirm: true })
  if (error || !data.user) throw new Error("stored-actor-create-failed")
  await controller.recordAuthUser(data.user.id)
  return { actor: { alias, authUserId: data.user.id, kind }, email, password }
}
