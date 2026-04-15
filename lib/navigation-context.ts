import "server-only"

import { cache } from "react"
import { getAdminSupabaseClient } from "@/lib/supabase-admin"
import { createServerSupabaseClient } from "@/lib/supabase-server"
import { isInternalAdminEmail } from "@/lib/zkas/auth"

export type NavigationUser = {
  id: string
  email: string | null
  fullName: string | null
  avatarUrl: string | null
  status: string | null
}

export type ManagedProjectSummary = {
  id: number
  slug: string | null
  name: string
}

export type NavigationContext = {
  user: NavigationUser | null
  isAuthenticated: boolean
  hasWorkspaceAccess: boolean
  hasFounderAccess: boolean
  hasAdminAccess: boolean
  managedProjects: ManagedProjectSummary[]
}

type ProjectRow = {
  id: number
  slug: string | null
  name: string
  organization_id: number | null
}

type RoleRow = {
  id: number
}

type UserProfileRow = {
  full_name: string | null
  avatar_url: string | null
  status: string | null
}

function emptyNavigationContext(): NavigationContext {
  return {
    user: null,
    isAuthenticated: false,
    hasWorkspaceAccess: false,
    hasFounderAccess: false,
    hasAdminAccess: false,
    managedProjects: [],
  }
}

export const getNavigationContext = cache(async (): Promise<NavigationContext> => {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser()

  if (!authUser) {
    return emptyNavigationContext()
  }

  const roleAwareSupabase = (() => {
    try {
      return getAdminSupabaseClient()
    } catch {
      // Local and preview environments may omit the service-role key. Fall back
      // to the authenticated SSR client so the shared shell still renders.
      return supabase
    }
  })()

  const [{ data: profile }, { data: participantRows }, { data: founderRoles }] = await Promise.all([
    roleAwareSupabase
      .from("users")
      .select("full_name, avatar_url, status")
      .eq("user_id", authUser.id)
      .maybeSingle<UserProfileRow>(),
    roleAwareSupabase.from("participants").select("project_id").eq("user_id", authUser.id).eq("is_admin", true),
    roleAwareSupabase.from("ref_roles").select("id").in("name", ["Founder", "Admin"]),
  ])

  const participantProjectIds = Array.from(new Set((participantRows ?? []).map((row) => row.project_id)))
  const founderRoleIds = ((founderRoles as RoleRow[] | null) ?? []).map((role) => role.id)

  const { data: organizationMemberships } =
    founderRoleIds.length > 0
      ? await roleAwareSupabase
          .from("organization_members")
          .select("organization_id")
          .eq("user_id", authUser.id)
          .eq("status", "active")
          .in("role_id", founderRoleIds)
      : { data: [] as { organization_id: number }[] }

  const organizationIds = Array.from(new Set((organizationMemberships ?? []).map((row) => row.organization_id)))

  const [participantProjectsResult, organizationProjectsResult] = await Promise.all([
    participantProjectIds.length > 0
      ? roleAwareSupabase.from("projects").select("id, slug, name, organization_id").in("id", participantProjectIds)
      : Promise.resolve({ data: [] as ProjectRow[] }),
    organizationIds.length > 0
      ? roleAwareSupabase.from("projects").select("id, slug, name, organization_id").in("organization_id", organizationIds)
      : Promise.resolve({ data: [] as ProjectRow[] }),
  ])

  const managedProjectsMap = new Map<number, ManagedProjectSummary>()
  for (const project of [...(participantProjectsResult.data ?? []), ...(organizationProjectsResult.data ?? [])]) {
    managedProjectsMap.set(project.id, {
      id: project.id,
      slug: project.slug,
      name: project.name,
    })
  }

  const managedProjects = Array.from(managedProjectsMap.values()).sort((left, right) => left.name.localeCompare(right.name))

  return {
    user: {
      id: authUser.id,
      email: authUser.email ?? null,
      fullName: profile?.full_name ?? null,
      avatarUrl: profile?.avatar_url ?? null,
      status: profile?.status ?? null,
    },
    isAuthenticated: true,
    hasWorkspaceAccess: true,
    hasFounderAccess: managedProjects.length > 0,
    hasAdminAccess: isInternalAdminEmail(authUser.email ?? null),
    managedProjects,
  }
})
