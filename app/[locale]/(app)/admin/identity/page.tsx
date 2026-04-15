import { formatDistanceToNow } from "date-fns"
import { ArrowLeft } from "lucide-react"
import { Link } from "@/i18n/navigation"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { getAdminSupabaseClient } from "@/lib/supabase-admin"
import { requireInternalAdminActor } from "@/lib/zkas/auth"

type IdentityUserRow = {
  user_id: string
  display_name: string | null
  full_name: string | null
  cubid_id: string | null
  cubid_identity_status: "unlinked" | "linked" | "verified"
  cubid_score: number | null
  status: string | null
}

type IdentitySnapshotRow = {
  user_id: string
  cubid_user_id: string
  primary_name: string | null
  last_synced_at: string | null
  last_sync_error_code: string | null
  last_sync_error_message: string | null
}

const STALE_DAYS = 7
const STALE_MS = STALE_DAYS * 24 * 60 * 60 * 1000

function isSnapshotStale(value: string | null) {
  if (!value) {
    return true
  }

  return Date.now() - new Date(value).getTime() > STALE_MS
}

function getDisplayName(user: IdentityUserRow, snapshot: IdentitySnapshotRow | undefined) {
  return user.display_name ?? snapshot?.primary_name ?? user.full_name ?? user.user_id
}

export const dynamic = "force-dynamic"

export default async function AdminIdentityPage() {
  const adminSupabase = await (async () => {
    try {
      await requireInternalAdminActor()
      return getAdminSupabaseClient()
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : "You cannot access internal identity operations.",
      }
    }
  })()

  if ("error" in adminSupabase) {
    return (
      <div className="container mx-auto space-y-8 px-4 py-12">
        <Button asChild variant="ghost" size="sm" className="gap-1">
          <Link href="/admin">
            <ArrowLeft className="h-4 w-4" />
            <span>Back to Admin</span>
          </Link>
        </Button>
        <Card>
          <CardHeader>
            <CardTitle>Access Denied</CardTitle>
            <CardDescription>{adminSupabase.error}</CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-slate-600 dark:text-slate-300">This page is restricted to internal operators.</CardContent>
        </Card>
      </div>
    )
  }
  const [{ data: userRows }, { data: snapshotRows }] = await Promise.all([
    adminSupabase
      .from("users")
      .select("user_id, display_name, full_name, cubid_id, cubid_identity_status, cubid_score, status")
      .in("cubid_identity_status", ["unlinked", "linked", "verified"])
      .order("updated_at", { ascending: false }),
    adminSupabase
      .from("cubid_identity_snapshots")
      .select("user_id, cubid_user_id, primary_name, last_synced_at, last_sync_error_code, last_sync_error_message")
      .order("last_synced_at", { ascending: false }),
  ])

  const snapshotsByUserId = new Map((snapshotRows ?? []).map((row) => [row.user_id, row as IdentitySnapshotRow]))
  const rows = ((userRows ?? []) as IdentityUserRow[])
    .filter((user) => user.status !== "deleted")
    .map((user) => {
      const snapshot = snapshotsByUserId.get(user.user_id)
      const stale = isSnapshotStale(snapshot?.last_synced_at ?? null)
      const hasSyncError = Boolean(snapshot?.last_sync_error_code || snapshot?.last_sync_error_message)
      const missingSnapshot = (user.cubid_identity_status === "linked" || user.cubid_identity_status === "verified") && !snapshot

      return {
        user,
        snapshot,
        stale,
        hasSyncError,
        missingSnapshot,
      }
    })
    .filter((row) => row.stale || row.hasSyncError || row.missingSnapshot)

  const summary = {
    stale: rows.filter((row) => row.stale).length,
    syncErrors: rows.filter((row) => row.hasSyncError).length,
    missingSnapshots: rows.filter((row) => row.missingSnapshot).length,
    verifiedUsers: ((userRows ?? []) as IdentityUserRow[]).filter((user) => user.cubid_identity_status === "verified").length,
  }

  return (
    <div className="container mx-auto space-y-8 px-4 py-12">
      <Button asChild variant="ghost" size="sm" className="gap-1">
        <Link href="/admin">
          <ArrowLeft className="h-4 w-4" />
          <span>Back to Admin</span>
        </Link>
      </Button>

      <div className="space-y-3">
        <h1 className="text-3xl font-bold">Identity Health</h1>
        <p className="max-w-3xl text-sm text-slate-600 dark:text-slate-300">
          Read-only operator view of stale CUBID snapshots and recent sync failures. This page helps verify whether identity data
          is trustworthy enough for later payout and monthly-cycle work.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Stale snapshots</CardTitle>
            <CardDescription>No sync in the last {STALE_DAYS} days or never synced</CardDescription>
          </CardHeader>
          <CardContent className="text-3xl font-bold">{summary.stale}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Sync issues</CardTitle>
            <CardDescription>Rows with a stored sync error message</CardDescription>
          </CardHeader>
          <CardContent className="text-3xl font-bold">{summary.syncErrors}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Missing snapshots</CardTitle>
            <CardDescription>Linked users without a synced snapshot row</CardDescription>
          </CardHeader>
          <CardContent className="text-3xl font-bold">{summary.missingSnapshots}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Verified users</CardTitle>
            <CardDescription>Current FundLoop profiles in verified state</CardDescription>
          </CardHeader>
          <CardContent className="text-3xl font-bold">{summary.verifiedUsers}</CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Problem rows</CardTitle>
          <CardDescription>Identity rows that currently look stale, missing, or failed.</CardDescription>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <p className="text-sm text-slate-500">No stale or failed identity rows found.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Identity state</TableHead>
                  <TableHead>Snapshot</TableHead>
                  <TableHead>Issue</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map(({ user, snapshot, stale, hasSyncError, missingSnapshot }) => (
                  <TableRow key={user.user_id}>
                    <TableCell>
                      <div className="space-y-1">
                        <div className="font-medium">{getDisplayName(user, snapshot)}</div>
                        <div className="text-xs text-slate-500">{user.user_id}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-2">
                        <Badge variant={user.cubid_identity_status === "verified" ? "default" : "outline"}>
                          {user.cubid_identity_status}
                        </Badge>
                        {user.cubid_score !== null ? <div className="text-xs text-slate-500">CUBID score {user.cubid_score}</div> : null}
                      </div>
                    </TableCell>
                    <TableCell>
                      {snapshot ? (
                        <div className="space-y-1 text-sm">
                          <div>{snapshot.primary_name ?? "No primary name"}</div>
                          <div className="text-xs text-slate-500">
                            {snapshot.last_synced_at
                              ? formatDistanceToNow(new Date(snapshot.last_synced_at), { addSuffix: true })
                              : "Never synced"}
                          </div>
                        </div>
                      ) : (
                        <span className="text-sm text-slate-500">No snapshot row</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-2">
                        {missingSnapshot ? <Badge variant="destructive">Missing snapshot</Badge> : null}
                        {stale ? <Badge variant="secondary">Stale</Badge> : null}
                        {hasSyncError ? <Badge variant="destructive">Sync error</Badge> : null}
                      </div>
                      {snapshot?.last_sync_error_message ? (
                        <p className="mt-2 max-w-md text-xs text-slate-500">{snapshot.last_sync_error_message}</p>
                      ) : null}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
