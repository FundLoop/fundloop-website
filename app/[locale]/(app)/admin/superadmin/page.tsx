import { notFound } from "next/navigation"
import { SuperAdminDashboard } from "@/components/admin/superadmin-dashboard"
import { requireInternalAdminActor } from "@/lib/zkas/auth"

export const dynamic = "force-dynamic"

export default async function SuperAdminPage() {
  // Internal admins only; the dashboard's server actions re-check the same allowlist.
  try {
    await requireInternalAdminActor()
  } catch {
    notFound()
  }

  return <SuperAdminDashboard />
}
