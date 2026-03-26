import Link from "next/link"
import { approveZkasDataset, getZkasDatasetDetail, rejectZkasDataset } from "@/app/actions/zkas-actions"
import { DatasetStatusBadge } from "@/components/zkas/dataset-status-badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

export default async function ZkasDatasetDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const data = await (async () => {
    const { id } = await params
    const detail = await getZkasDatasetDetail(Number.parseInt(id, 10))
    return { detail }
  })().catch((error: unknown) => ({
    error: error instanceof Error ? error.message : "Could not load this dataset.",
  }))

  if ("error" in data) {
    return (
      <div className="container mx-auto px-4 py-12">
        <Card>
          <CardHeader>
            <CardTitle>Dataset Not Available</CardTitle>
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
            <h1 className="text-3xl font-bold">{data.detail.dataset.file_name}</h1>
            <p className="text-slate-600 dark:text-slate-300">Validation summary for dataset #{data.detail.dataset.id}</p>
          </div>
          <Button asChild variant="outline">
            <Link href="/admin/zkas/uploads">Back to Uploads</Link>
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Dataset Summary</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2">
            <div>Month: {data.detail.dataset.month}</div>
            <div>Format: {data.detail.dataset.format}</div>
            <div>Rows: {data.detail.dataset.row_count}</div>
            <div>
              Status: <DatasetStatusBadge status={data.detail.dataset.status} />
            </div>
            <div className="md:col-span-2">Object path: {data.detail.dataset.object_path}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Validation Issues</CardTitle>
            <CardDescription>Errors block approval; warnings are advisory.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Severity</TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead>Message</TableHead>
                  <TableHead>Row</TableHead>
                  <TableHead>Field</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.detail.issues.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-slate-500">
                      No issues recorded.
                    </TableCell>
                  </TableRow>
                ) : (
                  data.detail.issues.map((issue) => (
                    <TableRow key={issue.id}>
                      <TableCell>{issue.severity}</TableCell>
                      <TableCell>{issue.code}</TableCell>
                      <TableCell>{issue.message}</TableCell>
                      <TableCell>{issue.row_number ?? "-"}</TableCell>
                      <TableCell>{issue.field_name ?? "-"}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <div className="flex gap-3">
          <form action={approveZkasDataset}>
            <input type="hidden" name="datasetId" value={data.detail.dataset.id} />
            <Button disabled={data.detail.dataset.status !== "validated"}>Approve Dataset</Button>
          </form>
          <form action={rejectZkasDataset}>
            <input type="hidden" name="datasetId" value={data.detail.dataset.id} />
            <Button variant="outline" disabled={data.detail.dataset.status === "included"}>
              Reject Dataset
            </Button>
          </form>
        </div>
      </div>
  )
}
