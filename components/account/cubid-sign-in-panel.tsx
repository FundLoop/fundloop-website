"use client"

import { useState } from "react"
import { KeyRound, Link2, Link2Off } from "lucide-react"
import { invokeCubidIdentityDisconnectBrowser } from "@/lib/edge-functions/cubid-identity"
import type { CubidSignInLinkStatus } from "@/lib/auth/cubid-link-status"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

// Sign in with Cubid, on the account page (#275, stage 2c UI).
//
// Deliberately its own card rather than a section of the existing Cubid panel. That one shows the
// Cubid Passport API integration — `cubid_id`, the score, the managed identity — and this is a
// different thing: whether a Cubid passkey can sign you in to FundLoop. Putting them together
// would invite exactly the conflation the engineering document warns against.

function formatDate(value: string | null) {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toLocaleDateString(undefined, { dateStyle: "medium" })
}

export function CubidSignInPanel({
  status,
  onNavigate = (url: string) => window.location.assign(url),
}: {
  status: CubidSignInLinkStatus
  onNavigate?: (url: string) => void
}) {
  const [linked, setLinked] = useState(status.linked)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)

  if (!status.available) return null

  async function disconnect() {
    setBusy(true)
    setError(null)
    setNotice(null)
    const result = await invokeCubidIdentityDisconnectBrowser()
    setBusy(false)
    setConfirming(false)
    if (!result.ok) {
      setError(result.error.message)
      return
    }
    setLinked(false)
    setNotice(
      result.data.revokedClients > 0
        ? `Cubid is disconnected. ${result.data.revokedClients} connected application${result.data.revokedClients === 1 ? "" : "s"} lost access.`
        : "Cubid is disconnected.",
    )
  }

  const linkedSince = formatDate(status.linkedAt)

  return (
    <Card
      className="bg-[var(--surface-panel-strong)] shadow-[var(--surface-shadow-panel)]"
      data-testid="cubid-sign-in-panel"
    >
      <CardHeader>
        <div className="flex items-center gap-3">
          <KeyRound className="h-5 w-5 text-[var(--interactive-primary)]" />
          <CardTitle>Sign in with Cubid</CardTitle>
          <Badge variant={linked ? "default" : "secondary"}>{linked ? "Connected" : "Not connected"}</Badge>
        </div>
        <CardDescription>
          Use your Cubid passkey to sign in to FundLoop, and let applications you have approved at Cubid read your own
          award and payout data on your behalf. This is separate from the Cubid identity verification below.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {linked ? (
          <p className="text-sm text-[var(--text-muted)]">
            {linkedSince ? `Connected since ${linkedSince}.` : "Connected."} Your FundLoop email sign-in keeps working
            either way.
          </p>
        ) : (
          <p className="text-sm text-[var(--text-muted)]">
            Connecting takes you to Cubid to approve it, then back here. Nothing about your FundLoop account changes
            except that your Cubid passkey can sign you in.
          </p>
        )}

        {error ? (
          <p className="rounded-2xl border border-red-300 bg-red-50 p-4 text-sm text-red-950" role="alert">
            {error}
          </p>
        ) : null}
        {notice ? (
          <p className="rounded-2xl border border-emerald-300 bg-emerald-50 p-4 text-sm text-emerald-950" role="status">
            {notice}
          </p>
        ) : null}

        {confirming ? (
          <div className="space-y-3 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
            <p>
              Disconnecting also ends the access of every application you approved at Cubid for FundLoop. They will
              need your approval again. You can still sign in with your email address.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button variant="destructive" onClick={disconnect} disabled={busy} data-testid="cubid-disconnect-confirm">
                {busy ? "Disconnecting…" : "Yes, disconnect Cubid"}
              </Button>
              <Button variant="outline" onClick={() => setConfirming(false)} disabled={busy}>
                Keep it connected
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap gap-3">
            {linked ? (
              <Button
                variant="outline"
                onClick={() => setConfirming(true)}
                disabled={busy}
                data-testid="cubid-disconnect"
              >
                <Link2Off className="mr-2 h-4 w-4" />
                Disconnect Cubid
              </Button>
            ) : (
              <Button
                onClick={() => onNavigate("/auth/cubid/start?intent=link&redirect_to=/workspace/account")}
                disabled={busy}
                data-testid="cubid-connect"
              >
                <Link2 className="mr-2 h-4 w-4" />
                Connect Cubid
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
