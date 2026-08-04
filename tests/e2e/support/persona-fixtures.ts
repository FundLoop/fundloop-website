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
import { DEFAULT_PROJECT_ONBOARDING_PAYLOAD, DEFAULT_USER_ONBOARDING_PAYLOAD, type RelationshipChoice } from "../../../lib/onboarding"
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

export type PersonaProjectFixture = { id: number; slug: string; name: string }
export type PersonaInvitationFixture = { code: string; email: string }

// Supabase's fluent builders do not preserve selected-row inference through a generic
// PromiseLike boundary, so this local guard narrows the checked payload at call sites.
async function mutation(result: PromiseLike<{ data: unknown; error: { message?: string } | null }>, reason: string): Promise<Record<string, never> & { id: number }> {
  const { data, error } = await result
  if (error || data === null) throw new Error(reason)
  return data as Record<string, never> & { id: number }
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

      const orderedRecords = [...ledger.records].sort((a, b) => b.cleanupPhase - a.cleanupPhase)
      for (const record of orderedRecords.filter((record) => record.table !== "users")) {
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

      // Keep the public user row until owned cycles are gone. Its auth UUID is the
      // cycle ownership marker, and deleting it first nulls created_by_user_id.
      for (const record of orderedRecords.filter((record) => record.table === "users")) {
        let query = supabase.from(record.table as keyof Database["public"]["Tables"]).delete()
        for (const [key, value] of Object.entries(record.primaryKey)) query = query.eq(key, value)
        const { error } = await query
        if (error) fail(); else deletedCount += 1
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

export async function createStoredActorWithProfile(
  supabase: SupabaseClient<Database>,
  controller: MutableFixtureController,
  alias: "returning-member" | "returning-founder",
) {
  const credentials = await createStoredActor(supabase, controller, alias, "stored")
  const displayName = alias === "returning-member" ? "Returning Member" : "Returning Founder"
  await mutation(
    supabase.from("users").upsert({
      user_id: credentials.actor.authUserId,
      email: credentials.email,
      full_name: displayName,
      display_name: displayName,
      profile_headline: alias === "returning-member" ? "Community contributor" : "Project founder",
      bio: "Run-owned local persona profile.",
      cubid_identity_status: "linked",
      cubid_id: randomUUID(),
      status: "active",
      is_public: true,
    }, { onConflict: "user_id" }).select("id").single(),
    "persona-profile-create-failed",
  ).then((row) => controller.recordDatabaseRow({ table: "users", primaryKey: { id: row.id }, cleanupPhase: 90 }))
  return credentials
}

export async function createRunInvitation(
  supabase: SupabaseClient<Database>,
  controller: MutableFixtureController,
  alias: "new-member" | "new-founder",
): Promise<PersonaInvitationFixture> {
  const inviter = await supabase.auth.admin.createUser({
    email: `fixture-inviter-${randomUUID().slice(0, 8)}@persona.local`,
    password: `${randomBytes(18).toString("base64url")}A1!`,
    email_confirm: true,
  })
  if (inviter.error || !inviter.data.user) throw new Error("persona-inviter-create-failed")
  await controller.recordAuthUser(inviter.data.user.id)
  const inviterProfile = await mutation(
    supabase.from("users").upsert({
      user_id: inviter.data.user.id,
      full_name: "Persona Fixture Inviter",
      display_name: "Persona Fixture Inviter",
      status: "active",
      cubid_identity_status: "linked",
    }, { onConflict: "user_id" }).select("id").single(),
    "persona-inviter-profile-create-failed",
  )
  await controller.recordDatabaseRow({ table: "users", primaryKey: { id: inviterProfile.id }, cleanupPhase: 80 })
  const code = `${controller.ledger.run.runId.slice(-18)}-${alias}`
  const email = `${alias}-${randomUUID().slice(0, 8)}@persona.local`
  await mutation(
    supabase.from("invitation_codes").insert({
      code,
      created_by: inviter.data.user.id,
      usage_count: 0,
      max_uses: 1,
      expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    }).select("code").single(),
    "persona-invitation-create-failed",
  )
  await controller.recordInvitation({ code, createdByUserId: inviter.data.user.id, maxUses: 1 })
  return { code, email }
}

export async function resolveLocalAuthUserId(supabase: SupabaseClient<Database>, email: string) {
  const { data, error } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1_000 })
  const user = data?.users.find((candidate) => candidate.email?.toLowerCase() === email.toLowerCase())
  if (error || !user) throw new Error("persona-auth-user-resolution-failed")
  return user.id
}

export async function arrangeReviewReadyProfile(
  supabase: SupabaseClient<Database>,
  controller: MutableFixtureController,
  input: { authUserId: string; email: string; inviteCode: string; relationshipChoice: RelationshipChoice },
) {
  const profile = await mutation(
    supabase.from("users").upsert({
      user_id: input.authUserId,
      email: input.email,
      full_name: input.relationshipChoice === "create_project" ? "New Founder" : "New Member",
      display_name: input.relationshipChoice === "create_project" ? "New Founder" : "New Member",
      cubid_identity_status: "linked",
      cubid_id: randomUUID(),
      invited_by_code: input.inviteCode,
      status: "active",
    }, { onConflict: "user_id" }).select("id").single(),
    "persona-new-profile-arrange-failed",
  )
  await controller.recordDatabaseRow({ table: "users", primaryKey: { id: profile.id }, cleanupPhase: 90 })
  await controller.recordAuthUser(input.authUserId)
  const payload = {
    ...DEFAULT_USER_ONBOARDING_PAYLOAD,
    displayName: input.relationshipChoice === "create_project" ? "New Founder" : "New Member",
    profileHeadline: input.relationshipChoice === "create_project" ? "Project founder" : "Community contributor",
    bio: "Run-owned local persona profile.",
    inviteCode: input.inviteCode,
    relationshipChoice: input.relationshipChoice,
  }
  const draft = await mutation(
    supabase.from("user_onboarding_drafts").upsert({
      user_id: input.authUserId,
      current_screen: "review",
      payload,
    }, { onConflict: "user_id" }).select("id").single(),
    "persona-profile-draft-arrange-failed",
  )
  await controller.recordDatabaseRow({ table: "user_onboarding_drafts", primaryKey: { id: draft.id }, cleanupPhase: 100 })
}

export async function arrangeFounderProject(
  supabase: SupabaseClient<Database>,
  controller: MutableFixtureController,
  actorUserId: string,
): Promise<PersonaProjectFixture> {
  const suffix = randomUUID().slice(0, 8)
  const name = `Persona Project ${suffix}`
  const slug = `persona-project-${suffix}`
  const project = await mutation(
    supabase.from("projects").insert({
      name,
      slug,
      description: "Run-owned project for local persona verification.",
      detailed_description: "This project exists only for one local persona harness run.",
      is_public: true,
      status: "active",
      payment_percentage: 1,
      default_reporting_currency_code: "USD",
    }).select("id").single(),
    "persona-project-create-failed",
  )
  await controller.recordDatabaseRow({ table: "projects", primaryKey: { id: project.id }, cleanupPhase: 40 })
  const participant = await mutation(
    supabase.from("participants").insert({ project_id: project.id, user_id: actorUserId, is_admin: true }).select("id").single(),
    "persona-founder-membership-create-failed",
  )
  await controller.recordDatabaseRow({ table: "participants", primaryKey: { id: participant.id }, cleanupPhase: 60 })
  return { id: project.id, slug, name }
}

export async function arrangeReviewReadyProjectDraft(
  supabase: SupabaseClient<Database>,
  controller: MutableFixtureController,
  actorUserId: string,
) {
  const suffix = randomUUID().slice(0, 8)
  const fixture = { name: `Persona Project ${suffix}`, slug: `persona-project-${suffix}` }
  const draft = await mutation(
    supabase.from("project_onboarding_drafts").upsert({
      user_id: actorUserId,
      current_screen: "review",
      payload: {
        ...DEFAULT_PROJECT_ONBOARDING_PAYLOAD,
        name: fixture.name,
        slug: fixture.slug,
        description: "Run-owned project published through the local browser.",
        detailedDescription: "This project exists only for one local persona harness run.",
        contactEmail: "project@persona.local",
        billingEmail: "billing@persona.local",
        pledgeAccepted: true,
        paymentPercentage: "1",
      },
    }, { onConflict: "user_id" }).select("id").single(),
    "persona-project-draft-arrange-failed",
  )
  await controller.recordDatabaseRow({ table: "project_onboarding_drafts", primaryKey: { id: draft.id }, cleanupPhase: 100 })
  return fixture
}

export async function resolvePublishedProject(
  supabase: SupabaseClient<Database>,
  controller: MutableFixtureController,
  input: { slug: string; actorUserId: string },
): Promise<PersonaProjectFixture> {
  const project = await mutation(
    supabase.from("projects").select("id, organization_id").eq("slug", input.slug).single(),
    "persona-published-project-resolution-failed",
  )
  await controller.recordDatabaseRow({ table: "projects", primaryKey: { id: project.id }, cleanupPhase: 40 })
  const participant = await supabase.from("participants").select("id").eq("project_id", project.id).eq("user_id", input.actorUserId).single()
  if (participant.error || !participant.data) throw new Error("persona-published-membership-resolution-failed")
  await controller.recordDatabaseRow({ table: "participants", primaryKey: { id: participant.data.id }, cleanupPhase: 60 })
  const organizationId = (project as unknown as { organization_id: number | null }).organization_id
  if (organizationId) {
    const memberships = await supabase.from("organization_members").select("id").eq("organization_id", organizationId).eq("user_id", input.actorUserId)
    if (memberships.error) throw new Error("persona-organization-membership-resolution-failed")
    for (const membership of memberships.data ?? []) await controller.recordDatabaseRow({ table: "organization_members", primaryKey: { id: membership.id }, cleanupPhase: 60 })
    await controller.recordDatabaseRow({ table: "organizations", primaryKey: { id: organizationId }, cleanupPhase: 30 })
  }
  return { id: project.id, slug: input.slug, name: `Persona Project ${input.slug.slice(-8)}` }
}

export async function arrangeOpenCycle(
  supabase: SupabaseClient<Database>,
  controller: MutableFixtureController,
  input: { cycleKey: string; createdByUserId: string },
) {
  const [year, month] = input.cycleKey.split("-").map(Number)
  const periodStart = `${input.cycleKey}-01`
  const periodEnd = new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10)
  const marker = `persona-harness:${controller.ledger.run.runId}`
  await controller.recordCycle({
    cycleId: null,
    cycleKey: input.cycleKey,
    operatorNoteMarker: marker,
    createdByUserId: input.createdByUserId,
    state: "planned",
  })
  const existing = await supabase.from("monthly_cycles").select("id, operator_note").eq("cycle_key", input.cycleKey).maybeSingle()
  if (existing.error) throw new Error("persona-cycle-check-failed")
  if (existing.data) throw new Error(existing.data.operator_note?.startsWith("persona-harness:") ? "persona-cycle-owned-by-another-run" : "cycle-key-not-owned")
  const cycle = await mutation(
    supabase.from("monthly_cycles").insert({
      cycle_key: input.cycleKey,
      year,
      month,
      period_start: periodStart,
      period_end: periodEnd,
      status: "open",
      operator_note: marker,
      created_by_user_id: input.createdByUserId,
    }).select("id").single(),
    "persona-cycle-create-failed",
  )
  await controller.recordCycle({
    cycleId: cycle.id,
    cycleKey: input.cycleKey,
    operatorNoteMarker: marker,
    createdByUserId: input.createdByUserId,
    state: "created",
  })
  return { id: cycle.id, cycleKey: input.cycleKey, periodStart, periodEnd }
}

export async function arrangeMemberEarnings(
  supabase: SupabaseClient<Database>,
  controller: MutableFixtureController,
  input: { actorUserId: string; projectId: number; cycleId: number; cycleKey: string },
) {
  const run = await mutation(
    supabase.from("zkas_runs").insert({
      month: input.cycleKey,
      monthly_cycle_id: input.cycleId,
      status: "completed",
      verification_status: "verified",
      usd_pool: 125,
      total_allocated_usd: 125,
      total_score: 10,
      user_count: 1,
      published_at: new Date().toISOString(),
    }).select("id").single(),
    "persona-earnings-run-create-failed",
  )
  await controller.recordDatabaseRow({ table: "zkas_runs", primaryKey: { id: run.id }, cleanupPhase: 70 })
  const result = await mutation(
    supabase.from("zkas_run_results").insert({
      run_id: run.id,
      monthly_cycle_id: input.cycleId,
      zkas_user_id: `persona-${controller.ledger.run.runId.slice(-8)}`,
      aggregate_score: 10,
      allocation_usd: 125,
      eligibility: true,
      project_count: 1,
      app_count: 1,
      output_row_hash: randomBytes(32).toString("hex"),
    }).select("id").single(),
    "persona-earnings-result-create-failed",
  )
  await controller.recordDatabaseRow({ table: "zkas_run_results", primaryKey: { id: result.id }, cleanupPhase: 80 })
  const published = await mutation(
    supabase.from("zkas_published_user_results").insert({
      run_id: run.id,
      monthly_cycle_id: input.cycleId,
      user_id: input.actorUserId,
      zkas_user_id: `persona-${controller.ledger.run.runId.slice(-8)}`,
      aggregate_score: 10,
      allocation_usd: 125,
    }).select("id").single(),
    "persona-published-result-create-failed",
  )
  await controller.recordDatabaseRow({ table: "zkas_published_user_results", primaryKey: { id: published.id }, cleanupPhase: 85 })
  const credit = await mutation(
    supabase.from("monthly_cycle_bookkeeping_credits").insert({
      idempotency_key: `${controller.ledger.run.runId}-credit`,
      monthly_cycle_id: input.cycleId,
      run_id: run.id,
      source_result_id: result.id,
      user_id: input.actorUserId,
      usd_equivalent_amount: 125,
      currency_code: "USD",
      status: "credited",
      payment_status: "not_paid",
      source_breakdown: [{
        projectId: input.projectId,
        scopedCubidId: "persona-scoped-user",
        attributionPoints: 10,
        totalProjectPoints: 10,
        projectPoolUsd: 125,
        rawEntitlementUsd: 125,
      }],
      allocation_breakdown: { rawEntitlementUsd: 125, baselineUsd: 125, equalizationTopUpUsd: 0, capMultiple: 3, capApplied: false },
      asset_fills: [{ assetType: "fiat", assetCode: "USD", sourceAmount: 125, usdValue: 125, preferenceRank: 1, partial: false, projectId: input.projectId }],
    }).select("id").single(),
    "persona-bookkeeping-credit-create-failed",
  )
  await controller.recordDatabaseRow({ table: "monthly_cycle_bookkeeping_credits", primaryKey: { id: credit.id }, cleanupPhase: 90 })
}
