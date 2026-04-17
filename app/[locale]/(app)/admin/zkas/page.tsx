import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { getAdminSupabaseClient } from "@/lib/supabase-admin"
import { requireInternalAdminActor } from "@/lib/zkas/auth"

export default async function ZkasAdminPage() {
  const data = await (async () => {
    await requireInternalAdminActor()
    const supabase = getAdminSupabaseClient()
    const [
      { count: datasetCount },
      { count: runCount },
      { count: completedRunCount },
      { count: identityArtifactCount },
    ] = await Promise.all([
      supabase.from("zkas_datasets").select("*", { count: "exact", head: true }),
      supabase.from("zkas_runs").select("*", { count: "exact", head: true }),
      supabase.from("zkas_runs").select("*", { count: "exact", head: true }).eq("status", "completed"),
      supabase.from("zkas_identity_artifacts").select("*", { count: "exact", head: true }),
    ])

    return {
      datasetCount,
      runCount,
      completedRunCount,
      identityArtifactCount,
    }
  })().catch((error: unknown) => ({
    error: error instanceof Error ? error.message : "You cannot access zkAS admin.",
  }))

  if ("error" in data) {
    return (
      <div className="container mx-auto px-4 py-12">
        <Card>
          <CardHeader>
            <CardTitle>Access Denied</CardTitle>
            <CardDescription>{data.error}</CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-12 space-y-8">
      <div>
        <h1 className="text-3xl font-bold">zkActivitySum Admin</h1>
        <p className="text-slate-600 dark:text-slate-300">Operator control plane for datasets, runs, and artifacts.</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Datasets</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.datasetCount ?? 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Runs</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.runCount ?? 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Completed Runs</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.completedRunCount ?? 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Identity Artifacts</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.identityArtifactCount ?? 0}</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Dataset Review</CardTitle>
            <CardDescription>Approve project-submitted datasets and upload confidential mapping artifacts.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="w-full">
              <Link href="/admin/zkas/uploads">Open Uploads</Link>
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Run Management</CardTitle>
            <CardDescription>Create, lock, and execute monthly zkAS runs.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="w-full">
              <Link href="/admin/zkas/runs">Open Runs</Link>
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Superadmin Review</CardTitle>
            <CardDescription>Verification, TEE artifact review, and publication now live in the superadmin area.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="w-full" variant="outline">
              <Link href="/admin/superadmin/zkas">Open Superadmin Queue</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
