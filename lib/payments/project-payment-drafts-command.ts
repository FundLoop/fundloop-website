import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "../../types/supabase.ts"
import type { NormalizedProjectPaymentDraft } from "../payments.ts"
import { mapPaymentRecordSummary, type PaymentRecordSummary, type PaymentRecordSummaryRow } from "./payment-record-summary.ts"

type ProjectAdminProjectRow = {
  id: number
  slug: string | null
  name: string
  organization_id: number | null
}

type RoleReferenceRow = {
  id: number
}

type PaymentMethodReferenceRow = {
  id: number
}

export type ProjectPaymentDraftsCommandInput = {
  actorUserId: string
  projectSlug: string
  payments: NormalizedProjectPaymentDraft[]
}

export type ProjectPaymentDraftsCommandSuccess = {
  actorUserId: string
  projectId: number
  payments: PaymentRecordSummary[]
}

export type ProjectPaymentDraftsCommandFailureCode =
  | "project_not_found"
  | "permission_denied"
  | "reference_data_unavailable"
  | "payment_insert_failed"

export type ProjectPaymentDraftsCommandResult =
  | {
      ok: true
      data: ProjectPaymentDraftsCommandSuccess
    }
  | {
      ok: false
      error: {
        code: ProjectPaymentDraftsCommandFailureCode
        message: string
        projectId: number | null
        paymentMethodId: number | null
      }
    }

type ProjectPaymentDraftsCommandFailure = Extract<ProjectPaymentDraftsCommandResult, { ok: false }>
type ProjectAdminContextResult =
  | {
      ok: true
      data: ProjectAdminProjectRow
    }
  | ProjectPaymentDraftsCommandFailure

function commandFailure(
  code: ProjectPaymentDraftsCommandFailureCode,
  message: string,
  options?: {
    projectId?: number | null
    paymentMethodId?: number | null
  },
): ProjectPaymentDraftsCommandFailure {
  return {
    ok: false,
    error: {
      code,
      message,
      projectId: options?.projectId ?? null,
      paymentMethodId: options?.paymentMethodId ?? null,
    },
  }
}

async function resolveProjectAdminContext(
  supabase: SupabaseClient<Database>,
  actorUserId: string,
  projectSlug: string,
): Promise<ProjectAdminContextResult> {
  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("id, slug, name, organization_id")
    .eq("slug", projectSlug)
    .maybeSingle()

  if (projectError || !project) {
    return commandFailure("project_not_found", projectError?.message ?? "Project not found.")
  }

  const [{ data: participant }, { data: adminRoles, error: adminRolesError }] = await Promise.all([
    supabase
      .from("participants")
      .select("id")
      .eq("project_id", project.id)
      .eq("user_id", actorUserId)
      .eq("is_admin", true)
      .maybeSingle(),
    supabase.from("ref_roles").select("id").in("name", ["Founder", "Admin"]),
  ])

  if (participant?.id) {
    return {
      ok: true as const,
      data: project as ProjectAdminProjectRow,
    }
  }

  if (adminRolesError) {
    return commandFailure("reference_data_unavailable", adminRolesError.message, { projectId: project.id })
  }

  const adminRoleIds = ((adminRoles as RoleReferenceRow[] | null) ?? []).map((role) => role.id)
  if (project.organization_id && adminRoleIds.length > 0) {
    const { data: membership, error: membershipError } = await supabase
      .from("organization_members")
      .select("id")
      .eq("organization_id", project.organization_id)
      .eq("user_id", actorUserId)
      .eq("status", "active")
      .in("role_id", adminRoleIds)
      .maybeSingle()

    if (membershipError) {
      return commandFailure("reference_data_unavailable", membershipError.message, { projectId: project.id })
    }

    if (membership?.id) {
      return {
        ok: true as const,
        data: project as ProjectAdminProjectRow,
      }
    }
  }

  return commandFailure("permission_denied", "You do not have permission to manage payments for this project.", {
    projectId: project.id,
  })
}

export async function executeProjectPaymentDraftsCommand(
  supabase: SupabaseClient<Database>,
  input: ProjectPaymentDraftsCommandInput,
): Promise<ProjectPaymentDraftsCommandResult> {
  const projectContext = await resolveProjectAdminContext(supabase, input.actorUserId, input.projectSlug)
  if (!projectContext.ok) {
    return projectContext
  }

  const project = projectContext.data
  const [{ data: draftStatus, error: draftStatusError }, { data: methods, error: methodsError }] = await Promise.all([
    supabase.from("ref_payment_statuses").select("id").eq("code", "draft").maybeSingle(),
    supabase
      .from("ref_payment_methods")
      .select("id")
      .in(
        "id",
        input.payments.map((row) => row.payment_method_id),
      ),
  ])

  if (draftStatusError) {
    return commandFailure("reference_data_unavailable", draftStatusError.message, {
      projectId: project.id,
    })
  }

  if (!draftStatus?.id) {
    return commandFailure("reference_data_unavailable", "The draft payment status is not configured.", {
      projectId: project.id,
    })
  }

  if (methodsError) {
    return commandFailure("reference_data_unavailable", methodsError.message, {
      projectId: project.id,
    })
  }

  const validMethodIds = new Set(((methods as PaymentMethodReferenceRow[] | null) ?? []).map((method) => method.id))
  const invalidRow = input.payments.find((row) => !validMethodIds.has(row.payment_method_id))
  if (invalidRow) {
    return commandFailure("reference_data_unavailable", "One or more selected payment methods are no longer available.", {
      projectId: project.id,
      paymentMethodId: invalidRow.payment_method_id,
    })
  }

  const { data, error } = await supabase
    .from("payments")
    .insert(
      input.payments.map((row) => ({
        project_id: project.id,
        period_start: row.period_start,
        period_end: row.period_end,
        revenue: row.revenue,
        payment_amount: row.payment_amount,
        payment_percentage: row.payment_percentage,
        payment_method_id: row.payment_method_id,
        status_id: draftStatus.id,
      })),
    )
    .select(`
      id,
      project_id,
      period_start,
      period_end,
      revenue,
      payment_amount,
      payment_percentage,
      payment_method_id,
      status_id,
      notes,
      created_at,
      updated_at,
      paid_at,
      confirmed_at,
      projects(name, slug),
      ref_payment_methods(name, code),
      ref_payment_statuses(name, code)
    `)
    .order("period_start", { ascending: false })

  if (error) {
    return commandFailure("payment_insert_failed", error.message, {
      projectId: project.id,
    })
  }

  return {
    ok: true,
    data: {
      actorUserId: input.actorUserId,
      projectId: project.id,
      payments: ((data ?? []) as PaymentRecordSummaryRow[]).map(mapPaymentRecordSummary),
    },
  }
}
