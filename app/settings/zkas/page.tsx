import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { getAdminSupabaseClient } from "@/lib/supabase-admin"
import { getAuthenticatedActor } from "@/lib/zkas/auth"

export default async function SettingsZkasPage() {
  const data = await (async () => {
    const actor = await getAuthenticatedActor()
    const supabase = getAdminSupabaseClient()
    const { data: publishedResults, error } = await supabase
      .from("zkas_published_user_results")
      .select("run_id, allocation_usd, aggregate_score, published_at")
      .eq("user_id", actor.userId)
      .order("published_at", { ascending: false })

    if (error) {
      throw new Error(error.message)
    }

    const runIds = (publishedResults ?? []).map((row) => row.run_id)
    let runs: Array<{ id: number; month: string }> = []
    if (runIds.length > 0) {
      const { data: runRows, error: runError } = await supabase.from("zkas_runs").select("id, month").in("id", runIds)
      if (runError) {
        throw new Error(runError.message)
      }
      runs = runRows ?? []
    }

    return {
      results: publishedResults ?? [],
      runById: new Map(runs.map((run) => [run.id, run])),
    }
  })().catch((error: unknown) => ({
    error: error instanceof Error ? error.message : "Could not load your zkAS history.",
  }))

  if ("error" in data) {
    return (
      <div className="container mx-auto px-4 py-12">
        <Card>
          <CardHeader>
            <CardTitle>zkAS Results Unavailable</CardTitle>
            <CardDescription>{data.error}</CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto space-y-8 px-4 py-12">
      <div className="flex items-center gap-2">
        <Button asChild variant="ghost" size="sm" className="gap-1">
          <Link href="/settings">
            <span>Back to Settings</span>
          </Link>
        </Button>
      </div>

      <div>
        <h1 className="text-3xl font-bold">zkAS Results</h1>
        <p className="mt-2 text-slate-600 dark:text-slate-300">
          Verified zkActivitySum allocations published to your FundLoop account appear here.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Published History</CardTitle>
          <CardDescription>Only verified and published runs are shown.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Month</TableHead>
                <TableHead>Allocation</TableHead>
                <TableHead>Aggregate Score</TableHead>
                <TableHead>Published</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.results.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-slate-500">
                    No published zkAS results are available for your account yet.
                  </TableCell>
                </TableRow>
              ) : (
                data.results.map((result) => (
                  <TableRow key={`${result.run_id}-${result.published_at}`}>
                    <TableCell>{data.runById.get(result.run_id)?.month ?? `Run ${result.run_id}`}</TableCell>
                    <TableCell>${Number(result.allocation_usd).toLocaleString()}</TableCell>
                    <TableCell>{Number(result.aggregate_score).toLocaleString()}</TableCell>
                    <TableCell>{new Date(result.published_at).toLocaleString()}</TableCell>
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
