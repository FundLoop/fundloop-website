"use client"

import { BadgeCheck, ExternalLink, ShieldAlert, ShieldCheck } from "lucide-react"
import type { CubidIdentityStatus } from "@/lib/cubid/types"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"

type CubidIdentityStepProps = {
  email: string | null
  cubidIdentityStatus: CubidIdentityStatus
  cubidId: string | null
  cubidScore: number | null
  resolving: boolean
  onResolve: () => void
  title: string
  body: string
}

function getStatusTone(status: CubidIdentityStatus) {
  switch (status) {
    case "verified":
      return {
        icon: BadgeCheck,
        eyebrow: "Verified",
        body: "Your FundLoop account is linked to CUBID, and the current response shows the email identity as verified.",
        cardClassName: "border-emerald-200 bg-emerald-50/70 text-emerald-950",
      }
    case "linked":
      return {
        icon: ShieldCheck,
        eyebrow: "Linked",
        body: "Your FundLoop account is linked to CUBID. Additional verification can still be completed on CUBID.me later.",
        cardClassName: "border-cyan-200 bg-cyan-50/70 text-cyan-950",
      }
    default:
      return {
        icon: ShieldAlert,
        eyebrow: "Not linked yet",
        body: "Link CUBID to this email before publishing. FundLoop uses that identity connection as the first gate for payout-touching flows.",
        cardClassName: "border-amber-200 bg-amber-50/80 text-amber-950",
      }
  }
}

export function CubidIdentityStep({
  email,
  cubidIdentityStatus,
  cubidId,
  cubidScore,
  resolving,
  onResolve,
  title,
  body,
}: CubidIdentityStepProps) {
  const tone = getStatusTone(cubidIdentityStatus)
  const ToneIcon = tone.icon

  return (
    <div className="space-y-5">
      <div className={`rounded-3xl border p-5 ${tone.cardClassName}`}>
        <div className="flex items-start gap-3">
          <ToneIcon className="mt-0.5 h-5 w-5 shrink-0" />
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.24em]">{tone.eyebrow}</p>
            <p className="text-sm leading-6">{tone.body}</p>
            {cubidId ? <p className="text-xs opacity-80">CUBID user: {cubidId}</p> : null}
            {cubidScore !== null ? <p className="text-xs opacity-80">Current CUBID score: {cubidScore}</p> : null}
          </div>
        </div>
      </div>

      <Card className="border-[color:var(--surface-border)] bg-[var(--surface-panel)]">
        <CardContent className="space-y-4 p-5">
          <div className="space-y-2">
            <h3 className="text-base font-semibold text-[var(--text-strong)]">{title}</h3>
            <p className="text-sm leading-6 text-[var(--text-muted)]">{body}</p>
          </div>

          <div className="rounded-2xl border border-[color:var(--surface-border)] bg-[var(--surface-panel-strong)] px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--text-muted)]">Signed-in email</p>
            <p className="mt-1 text-sm font-medium text-[var(--text-strong)]">{email ?? "No authenticated email found"}</p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={onResolve} disabled={resolving || !email} className="gap-2">
              <ShieldCheck className="h-4 w-4" />
              {resolving ? "Linking with CUBID..." : cubidIdentityStatus === "unlinked" ? "Link CUBID now" : "Refresh CUBID link"}
            </Button>
            <Button asChild variant="outline">
              <a href="https://passport.cubid.me" target="_blank" rel="noreferrer">
                Open CUBID Passport
                <ExternalLink className="ml-2 h-4 w-4" />
              </a>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
