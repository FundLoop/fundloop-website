import Link from "next/link"
import { approveZkasDataset, rejectZkasDataset, uploadZkasIdentityArtifact } from "@/app/actions/zkas-actions"
import { DatasetStatusBadge } from "@/components/zkas/dataset-status-badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"
import { getAdminSupabaseClient } from "@/lib/supabase-admin"
import { requireInternalAdminActor } from "@/lib/zkas/auth"

export default async function ZkasUploadsPage() {
  const data = await (async () => {
    await requireInternalAdminActor()
    const supabase = getAdminSupabaseClient()
    const [{ data: datasets }, { data: artifacts }, { data: projects }] = await Promise.all([
      supabase.from("zkas_datasets").select("id, project_id, month, file_name, row_count, status, created_at").order("created_at", { ascending: false }),
      supabase.from("zkas_identity_artifacts").select("id, month, file_name, provider, created_at").order("created_at", { ascending: false }),
      supabase.from("projects").select("id, name"),
    ])

    return {
      datasets: datasets ?? [],
      artifacts: artifacts ?? [],
      projectNameById: new Map((projects ?? []).map((project) => [project.id, project.name])),
    }
  })().catch((error: unknown) => ({
    error: error instanceof Error ? error.message : "You cannot access this page.",
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
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">zkAS Uploads</h1>
            <p className="text-slate-600 dark:text-slate-300">Review datasets and manage confidential identity artifacts.</p>
          </div>
          <Button asChild variant="outline">
            <Link href="/admin/zkas">Back to zkAS</Link>
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Upload Identity Artifact</CardTitle>
            <CardDescription>
              One approved mapping artifact per month. JSON only. Include `fundloop_user_id` when available so superadmins
              can publish verified results in-app.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form action={uploadZkasIdentityArtifact} className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="month">
                  Month
                </label>
                <Input id="month" name="month" type="month" required />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="provider">
                  Provider
                </label>
                <Input id="provider" name="provider" defaultValue="cubid" />
              </div>
              <div className="space-y-2 md:col-span-2">
                <label className="text-sm font-medium" htmlFor="file">
                  Artifact file
                </label>
                <Input id="file" name="file" type="file" required />
              </div>
              <div className="space-y-2 md:col-span-2">
                <label className="text-sm font-medium" htmlFor="note">
                  Note
                </label>
                <Textarea id="note" name="note" />
              </div>
              <div className="md:col-span-2">
                <Button type="submit">Upload Identity Artifact</Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Identity Artifacts</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Month</TableHead>
                  <TableHead>File</TableHead>
                  <TableHead>Provider</TableHead>
                  <TableHead>Uploaded</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.artifacts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-slate-500">
                      No identity artifacts uploaded yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  data.artifacts.map((artifact) => (
                    <TableRow key={artifact.id}>
                      <TableCell>{artifact.month}</TableCell>
                      <TableCell>{artifact.file_name}</TableCell>
                      <TableCell>{artifact.provider}</TableCell>
                      <TableCell>{new Date(artifact.created_at).toLocaleString()}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Datasets</CardTitle>
            <CardDescription>Review project uploads before they enter a monthly run.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Project</TableHead>
                  <TableHead>Month</TableHead>
                  <TableHead>File</TableHead>
                  <TableHead>Rows</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.datasets.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-slate-500">
                      No datasets uploaded yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  data.datasets.map((dataset) => (
                    <TableRow key={dataset.id}>
                      <TableCell>{data.projectNameById.get(dataset.project_id) ?? `Project ${dataset.project_id}`}</TableCell>
                      <TableCell>{dataset.month}</TableCell>
                      <TableCell>
                        <Link href={`/admin/zkas/uploads/${dataset.id}`} className="text-emerald-600 hover:underline">
                          {dataset.file_name}
                        </Link>
                      </TableCell>
                      <TableCell>{dataset.row_count}</TableCell>
                      <TableCell>
                        <DatasetStatusBadge status={dataset.status} />
                      </TableCell>
                      <TableCell>{new Date(dataset.created_at).toLocaleString()}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <form action={approveZkasDataset}>
                            <input type="hidden" name="datasetId" value={dataset.id} />
                            <Button size="sm" disabled={dataset.status !== "validated"}>
                              Approve
                            </Button>
                          </form>
                          <form action={rejectZkasDataset}>
                            <input type="hidden" name="datasetId" value={dataset.id} />
                            <Button size="sm" variant="outline" disabled={dataset.status === "included"}>
                              Reject
                            </Button>
                          </form>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
  )
}
