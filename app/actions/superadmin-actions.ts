"use server"

import { getAdminSupabaseClient } from "@/lib/supabase-admin"
import { requireInternalAdminActor } from "@/lib/zkas/auth"
import type { Json } from "@/types/supabase"

// Superadmin dashboard data. Every action re-checks the internal-admin allowlist server-side
// and uses the service-role client, so none of these tables need client grants.

type SuperadminResult<T> = { ok: true; data: T } | { ok: false; error: string }

type Page = { page: number; pageSize: number }

export type SuperadminUser = {
  id: number
  user_id: string
  full_name: string | null
  email: string
  status: string | null
  created_at: string | null
  updated_at: string | null
  deleted_at: string | null
}

export type SuperadminOrganization = {
  id: number
  name: string
  description: string | null
  status: string | null
  created_at: string | null
  members: { id: number; user_id: string; full_name: string; role: string }[]
  projects: { id: number; name: string; description: string; status: string | null }[]
}

export type SuperadminAuditLog = {
  id: number
  table_name: string
  action: string
  record_id: number | null
  user_id: string | null
  old_data: Json | null
  new_data: Json | null
  created_at: string
}

export type SuperadminInvitationCode = {
  code: string
  created_by: string
  inviter_name: string
  usage_count: number
  max_uses: number | null
  expires_at: string | null
  created_at: string
  invited_users: { user_id: string; full_name: string | null; created_at: string | null }[]
}

async function withAdmin<T>(run: (context: { actorUserId: string; supabase: ReturnType<typeof getAdminSupabaseClient> }) => Promise<T>): Promise<SuperadminResult<T>> {
  try {
    const actor = await requireInternalAdminActor()
    return { ok: true, data: await run({ actorUserId: actor.userId, supabase: getAdminSupabaseClient() }) }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Superadmin request failed" }
  }
}

function pageRange({ page, pageSize }: Page) {
  const safePageSize = Math.min(Math.max(Math.trunc(pageSize) || 10, 1), 100)
  const safePage = Math.max(Math.trunc(page) || 1, 1)
  return { from: (safePage - 1) * safePageSize, to: safePage * safePageSize - 1 }
}

function relatedRecord<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null
  return value ?? null
}

export async function listSuperadminUsers(input: Page & { status: string; search: string }) {
  return withAdmin(async ({ supabase }) => {
    const { from, to } = pageRange(input)
    let query = supabase
      .from("users")
      .select("id, user_id, full_name, status, created_at, updated_at, deleted_at", { count: "exact" })

    if (input.status === "active" || input.status === "inactive" || input.status === "deleted") {
      query = query.eq("status", input.status)
    }
    if (input.search) {
      query = query.ilike("full_name", `%${input.search}%`)
    }

    const { data, count, error } = await query.order("created_at", { ascending: false }).range(from, to)
    if (error) throw new Error(error.message)

    const userIds = (data ?? []).map((user) => user.user_id)
    const { data: identities, error: identitiesError } = userIds.length > 0
      ? await supabase.from("user_identities").select("user_id, email").in("user_id", userIds)
      : { data: [], error: null }
    if (identitiesError) throw new Error(identitiesError.message)

    const emailByUser = new Map((identities ?? []).map((identity) => [identity.user_id, identity.email]))
    const users: SuperadminUser[] = (data ?? []).map((user) => ({
      ...user,
      email: emailByUser.get(user.user_id) || "No email found",
    }))
    return { users, totalCount: count ?? 0 }
  })
}

export async function softDeleteUserAsSuperadmin(userId: string) {
  return withAdmin(async ({ actorUserId, supabase }) => {
    const { error } = await supabase
      .from("users")
      .update({ deleted_at: new Date().toISOString(), status: "deleted", updated_by: actorUserId })
      .eq("user_id", userId)
    if (error) throw new Error(error.message)
    return null
  })
}

export async function listSuperadminOrganizations(input: Page & { search: string }) {
  return withAdmin(async ({ supabase }) => {
    const { from, to } = pageRange(input)
    let query = supabase.from("organizations").select("id, name, description, status, created_at", { count: "exact" })
    if (input.search) {
      query = query.ilike("name", `%${input.search}%`)
    }

    const { data: organizations, count, error } = await query.order("name").range(from, to)
    if (error) throw new Error(error.message)

    const withDetails = await Promise.all(
      (organizations ?? []).map(async (organization): Promise<SuperadminOrganization> => {
        const [{ data: members, error: membersError }, { data: projects, error: projectsError }] = await Promise.all([
          supabase
            .from("organization_members")
            .select("id, user_id, users!organization_members_user_id_fkey(full_name), ref_roles!organization_members_role_id_fkey(name)")
            .eq("organization_id", organization.id)
            .eq("status", "active"),
          supabase.from("projects").select("id, name, description, status").eq("organization_id", organization.id),
        ])
        if (membersError) throw new Error(membersError.message)
        if (projectsError) throw new Error(projectsError.message)

        return {
          ...organization,
          members: (members ?? []).map((member) => {
            const user = relatedRecord<{ full_name: string | null }>(member.users)
            const role = relatedRecord<{ name: string | null }>(member.ref_roles)
            return {
              id: member.id,
              user_id: member.user_id ?? "",
              full_name: user?.full_name ?? "Unknown User",
              role: role?.name ?? "Unknown Role",
            }
          }),
          projects: (projects ?? []).map((project) => ({ ...project, description: project.description ?? "" })),
        }
      }),
    )

    return { organizations: withDetails, totalCount: count ?? 0 }
  })
}

export async function softDeleteOrganizationAsSuperadmin(organizationId: number) {
  return withAdmin(async ({ actorUserId, supabase }) => {
    const { error } = await supabase
      .from("organizations")
      .update({ deleted_at: new Date().toISOString(), status: "deleted", updated_by: actorUserId })
      .eq("id", organizationId)
    if (error) throw new Error(error.message)
    return null
  })
}

export async function listSuperadminAuditLog(input: Page & { search: string }) {
  return withAdmin(async ({ supabase }) => {
    const { from, to } = pageRange(input)
    let query = supabase
      .from("audit_log")
      .select("id, table_name, action, record_id, user_id, old_data, new_data, created_at", { count: "exact" })
    if (input.search) {
      query = query.ilike("table_name", `%${input.search}%`)
    }

    const { data, count, error } = await query.order("created_at", { ascending: false }).range(from, to)
    if (error) throw new Error(error.message)
    return { auditLogs: (data ?? []) as SuperadminAuditLog[], totalCount: count ?? 0 }
  })
}

export async function listSuperadminInvitationAttribution() {
  return withAdmin(async ({ supabase }) => {
    const { data: codes, error } = await supabase.from("invitation_codes").select("*").order("created_at", { ascending: false })
    if (error) throw new Error(error.message)
    if (!codes || codes.length === 0) return [] as SuperadminInvitationCode[]

    const creatorIds = Array.from(new Set(codes.map((code) => code.created_by).filter((id): id is string => Boolean(id))))
    const codeValues = codes.map((code) => code.code)
    const [{ data: creators, error: creatorsError }, { data: invited, error: invitedError }] = await Promise.all([
      creatorIds.length > 0
        ? supabase.from("users").select("user_id, full_name").in("user_id", creatorIds)
        : Promise.resolve({ data: [], error: null }),
      supabase
        .from("users")
        .select("user_id, full_name, created_at, invited_by_code")
        .in("invited_by_code", codeValues)
        .order("created_at", { ascending: false }),
    ])
    if (creatorsError) throw new Error(creatorsError.message)
    if (invitedError) throw new Error(invitedError.message)

    const creatorName = new Map((creators ?? []).map((creator) => [creator.user_id, creator.full_name]))
    return codes.map((code): SuperadminInvitationCode => ({
      code: code.code,
      created_by: code.created_by ?? "",
      inviter_name: (code.created_by && creatorName.get(code.created_by)) || "Unknown",
      usage_count: code.usage_count ?? 0,
      max_uses: code.max_uses,
      expires_at: code.expires_at,
      created_at: code.created_at ?? "",
      invited_users: (invited ?? [])
        .filter((user) => user.invited_by_code === code.code)
        .map(({ user_id, full_name, created_at }) => ({ user_id, full_name, created_at })),
    }))
  })
}
