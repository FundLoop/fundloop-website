import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ArrowLeft } from "lucide-react"
import { createServerSupabaseClient } from "@/lib/supabase-server"
import {
  ProjectDetailPage,
  type ProjectDetail,
  type ProjectFinancials,
  type ProjectOrganization,
  type ProjectParticipant,
} from "@/components/project-detail-page"

async function getProjectDetail(slug: string): Promise<{
  project: ProjectDetail | null
  participants: ProjectParticipant[]
  financials: ProjectFinancials | null
  hasAccess: boolean
  userRole: "admin" | "member" | null
}> {
  const supabase = await createServerSupabaseClient()
  const { data: projectRow, error: projectError } = await supabase
    .from("projects")
    .select(
      "id, slug, name, logo_url, description, detailed_description, website, created_at, category_id, is_public, organization_id"
    )
    .eq("slug", slug)
    .is("deleted_at", null)
    .maybeSingle()

  if (projectError) {
    throw new Error(projectError.message)
  }

  if (!projectRow) {
    return {
      project: null,
      participants: [],
      financials: null,
      hasAccess: false,
      userRole: null,
    }
  }

  const [
    { data: categoryRow, error: categoryError },
    { data: participantRows, error: participantError },
    { data: paymentRows, error: paymentError },
    { data: salaryRow, error: salaryError },
    { data: authData, error: authError },
    organizationResult,
  ] = await Promise.all([
    projectRow.category_id
      ? supabase.from("ref_categories").select("name").eq("id", projectRow.category_id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    supabase.from("participants").select("is_admin, user_id, users(full_name, avatar_url, status)").eq("project_id", projectRow.id),
    supabase.from("payments").select("payment_amount").eq("project_id", projectRow.id).order("period_start", { ascending: false }),
    supabase
      .from("monthly_network_stats")
      .select("avg_salary")
      .order("year", { ascending: false })
      .order("month", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase.auth.getUser(),
    projectRow.organization_id
      ? supabase.from("organizations").select("id, name, logo_url").eq("id", projectRow.organization_id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ])

  if (categoryError) {
    throw new Error(categoryError.message)
  }
  if (participantError) {
    throw new Error(participantError.message)
  }
  if (paymentError) {
    throw new Error(paymentError.message)
  }
  if (salaryError) {
    throw new Error(salaryError.message)
  }
  if (authError && authError.message !== "Auth session missing!") {
    throw new Error(authError.message)
  }
  if (organizationResult.error) {
    throw new Error(organizationResult.error.message)
  }

  const activeParticipants = (participantRows ?? []).filter((participant) => {
    const participantUser = participant.users as { status?: string } | null
    return participantUser?.status === "active"
  })

  const participants: ProjectParticipant[] = activeParticipants.map((participant) => {
    const participantUser = participant.users as { full_name?: string | null; avatar_url?: string | null } | null
    return {
      id: participant.user_id,
      name: participantUser?.full_name ?? "Unnamed User",
      avatar: participantUser?.avatar_url ?? "/placeholder.svg?height=40&width=40",
      role: participant.is_admin ? "Admin" : "Member",
    }
  })

  const currentUserId = authData.user?.id ?? null
  const membership = currentUserId
    ? activeParticipants.find((participant) => participant.user_id === currentUserId) ?? null
    : null

  const organization: ProjectOrganization | undefined = organizationResult.data
    ? {
        id: organizationResult.data.id,
        name: organizationResult.data.name,
        logo: organizationResult.data.logo_url ?? "/placeholder.svg?height=40&width=40",
      }
    : undefined

  const epochCount = paymentRows?.length ?? 0
  const latestContributed = epochCount > 0 ? paymentRows?.[0]?.payment_amount ?? 0 : 0
  const totalContributed = paymentRows?.reduce((sum, payment) => sum + (payment.payment_amount ?? 0), 0) ?? 0
  const avgContributed = epochCount > 0 ? totalContributed / epochCount : 0
  const participantCount = activeParticipants.length || 1

  const financials: ProjectFinancials = {
    epochCount,
    latestContributed,
    avgContributed,
    avgContributedPerParticipant: epochCount > 0 ? avgContributed / participantCount : 0,
    avgSalary: salaryRow?.avg_salary ?? null,
  }

  return {
    project: {
      id: projectRow.id,
      slug: projectRow.slug ?? slug,
      name: projectRow.name,
      logo: projectRow.logo_url ?? "/placeholder.svg?height=80&width=80",
      description: projectRow.description ?? "",
      category: categoryRow?.name ?? "Uncategorized",
      joined: projectRow.created_at ? new Date(projectRow.created_at).toLocaleDateString() : "Recently",
      website: projectRow.website ?? "",
      detailed_description: projectRow.detailed_description ?? "",
      is_public: projectRow.is_public ?? true,
      organization,
    },
    participants,
    financials,
    hasAccess: Boolean(membership?.is_admin),
    userRole: membership ? (membership.is_admin ? "admin" : "member") : null,
  }
}

export default async function ProjectPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const { project, participants, financials, hasAccess, userRole } = await getProjectDetail(slug)

  if (!project) {
    return (
      <div className="container mx-auto px-4 py-12">
        <div className="mb-8 flex items-center gap-2">
          <Button asChild variant="ghost" size="sm" className="gap-1">
            <Link href="/projects">
              <ArrowLeft className="h-4 w-4" />
              <span>Back to Projects</span>
            </Link>
          </Button>
        </div>
        <div className="py-12 text-center">
          <h1 className="mb-4 text-2xl font-bold">Project Not Found</h1>
          <p className="mb-6 text-slate-600 dark:text-slate-300">
            The project you&apos;re looking for doesn&apos;t exist or you don&apos;t have access to view it.
          </p>
          <Button asChild>
            <Link href="/projects">Browse Projects</Link>
          </Button>
        </div>
      </div>
    )
  }

  return (
    <ProjectDetailPage
      project={project}
      participants={participants}
      financials={financials}
      hasAccess={hasAccess}
      userRole={userRole}
    />
  )
}
