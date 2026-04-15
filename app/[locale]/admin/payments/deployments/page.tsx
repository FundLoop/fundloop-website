import Link from "next/link"
import { AlertTriangle, ArrowLeft } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { buildDeploymentAuditRows } from "@/lib/onchain/deployment-audit"
import { getWalletRuntimeConfig } from "@/lib/onchain/runtime-config"
import { getAdminSupabaseClient } from "@/lib/supabase-admin"
import { requireInternalAdminActor } from "@/lib/zkas/auth"

type DeploymentAuditDbRow = {
  id: number
  chain_id: number
  collection_mode: "contract" | "deposit_address"
  contract_address: string
  treasury_address: string
  abi_version: string
  is_active: boolean
  ref_chains: {
    id: number
    network_key: string
    display_name: string
  }
}

function getStatusBadge(status: "healthy" | "disabled" | "missing" | "mismatch") {
  switch (status) {
    case "healthy":
      return <Badge>Healthy</Badge>
    case "disabled":
      return <Badge variant="outline">Disabled</Badge>
    case "missing":
      return <Badge variant="secondary">Missing</Badge>
    case "mismatch":
      return <Badge variant="destructive">Mismatch</Badge>
  }
}

export default async function AdminPaymentDeploymentsPage() {
  const data = await (async () => {
    await requireInternalAdminActor()
    const supabase = getAdminSupabaseClient()
    const { data, error } = await supabase
      .from("chain_intake_contracts")
      .select(`
        id,
        chain_id,
        collection_mode,
        contract_address,
        treasury_address,
        abi_version,
        is_active,
        ref_chains!inner(id, network_key, display_name)
      `)
      .eq("collection_mode", "contract")
      .order("chain_id", { ascending: true })

    if (error) {
      throw error
    }

    return (data ?? []) as DeploymentAuditDbRow[]
  })().catch((error: unknown) => ({
    error: error instanceof Error ? error.message : "You cannot access wallet deployment audit data.",
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

  const runtimeConfig = getWalletRuntimeConfig()
  const auditRows = buildDeploymentAuditRows(runtimeConfig, data, runtimeConfig.environment)
  const blockingIssues = runtimeConfig.issues.filter((issue) => issue.severity === "error")

  return (
    <div className="container mx-auto space-y-8 px-4 py-12">
      <div className="flex items-center gap-2">
        <Button asChild variant="ghost" size="sm" className="gap-1">
          <Link href="/admin/payments">
            <ArrowLeft className="h-4 w-4" />
            <span>Back to Payments</span>
          </Link>
        </Button>
      </div>

      <div className="space-y-3">
        <h1 className="text-3xl font-bold">Wallet Deployments</h1>
        <p className="max-w-3xl text-sm text-slate-600 dark:text-slate-300">
          Audit the active wallet environment, tracked deployment manifest, and Supabase intake-contract rows before
          enabling crypto payment execution in preview or production.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Environment</CardTitle>
            <CardDescription>Deployment manifest target</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold capitalize">{runtimeConfig.environment}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Wallet Runtime</CardTitle>
            <CardDescription>Global execution readiness</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              {runtimeConfig.walletEnabled ? <Badge>Enabled</Badge> : <Badge variant="destructive">Blocked</Badge>}
              <span className="text-sm text-slate-600 dark:text-slate-300">
                {runtimeConfig.activeChains.length} active chain{runtimeConfig.activeChains.length === 1 ? "" : "s"}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Reown Project ID</CardTitle>
            <CardDescription>Wallet-connect configuration</CardDescription>
          </CardHeader>
          <CardContent>
            {runtimeConfig.reownProjectIdConfigured ? (
              <Badge>Configured</Badge>
            ) : (
              <Badge variant="destructive">Missing or placeholder</Badge>
            )}
          </CardContent>
        </Card>
      </div>

      {blockingIssues.length > 0 ? (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Blocking wallet configuration issues</AlertTitle>
          <AlertDescription>
            <ul className="list-disc pl-4">
              {blockingIssues.map((issue) => (
                <li key={issue.code}>{issue.message}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Manifest vs Supabase</CardTitle>
          <CardDescription>
            Use{" "}
            <code>{`node scripts/sync-chain-deployments.mjs --env ${runtimeConfig.environment} --apply`}</code> after
            updating the tracked manifest to align the live database rows.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Chain</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Manifest Contract</TableHead>
                <TableHead>DB Contract</TableHead>
                <TableHead>Manifest Treasury</TableHead>
                <TableHead>DB Treasury</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {auditRows.map((row) => (
                <TableRow key={row.networkKey}>
                  <TableCell>
                    <div className="font-medium">{row.displayName}</div>
                    <div className="text-xs text-slate-500">{row.networkKey}</div>
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      {getStatusBadge(row.status)}
                      <p className="text-xs text-slate-500">{row.statusReason}</p>
                    </div>
                  </TableCell>
                  <TableCell className="max-w-[14rem] break-all text-xs">{row.manifestContractAddress}</TableCell>
                  <TableCell className="max-w-[14rem] break-all text-xs">{row.dbContractAddress ?? "Missing"}</TableCell>
                  <TableCell className="max-w-[14rem] break-all text-xs">{row.manifestTreasuryAddress}</TableCell>
                  <TableCell className="max-w-[14rem] break-all text-xs">{row.dbTreasuryAddress ?? "Missing"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
