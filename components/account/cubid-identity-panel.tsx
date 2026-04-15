"use client"

import { BadgeCheck, ExternalLink, ShieldAlert, ShieldCheck } from "lucide-react"
import type { CubidIdentityStatus } from "@/lib/cubid/types"
import { Button } from "@/components/ui/button"

type CubidIdentityPanelProps = {
  status: CubidIdentityStatus
  email: string | null
  cubidId: string | null
  cubidScore: number | null
  title: string
  description: string
  linkedLabel: string
  verifiedLabel: string
  unlinkedLabel: string
  manageCta: string
}

function getStatusMeta(status: CubidIdentityStatus) {
  switch (status) {
    case "verified":
      return {
        icon: BadgeCheck,
        toneClassName: "border-emerald-200 bg-emerald-50/70 text-emerald-950",
      }
    case "linked":
      return {
        icon: ShieldCheck,
        toneClassName: "border-cyan-200 bg-cyan-50/70 text-cyan-950",
      }
    default:
      return {
        icon: ShieldAlert,
        toneClassName: "border-amber-200 bg-amber-50/80 text-amber-950",
      }
  }
}

export function CubidIdentityPanel({
  status,
  email,
  cubidId,
  cubidScore,
  title,
  description,
  linkedLabel,
  verifiedLabel,
  unlinkedLabel,
  manageCta,
}: CubidIdentityPanelProps) {
  const meta = getStatusMeta(status)
  const Icon = meta.icon
  const statusLabel = status === "verified" ? verifiedLabel : status === "linked" ? linkedLabel : unlinkedLabel

  return (
    <div className="space-y-5">
      <div className={`rounded-3xl border p-5 ${meta.toneClassName}`}>
        <div className="flex items-start gap-3">
          <Icon className="mt-0.5 h-5 w-5 shrink-0" />
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.24em]">{statusLabel}</p>
            <h2 className="text-lg font-semibold">{title}</h2>
            <p className="text-sm leading-6">{description}</p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-[color:var(--surface-border)] bg-[var(--surface-panel)] px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--text-muted)]">Email</p>
          <p className="mt-1 text-sm text-[var(--text-strong)]">{email ?? "Not available"}</p>
        </div>
        <div className="rounded-2xl border border-[color:var(--surface-border)] bg-[var(--surface-panel)] px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--text-muted)]">CUBID user</p>
          <p className="mt-1 break-all text-sm text-[var(--text-strong)]">{cubidId ?? "Not linked yet"}</p>
        </div>
        <div className="rounded-2xl border border-[color:var(--surface-border)] bg-[var(--surface-panel)] px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--text-muted)]">CUBID score</p>
          <p className="mt-1 text-sm text-[var(--text-strong)]">{cubidScore ?? "Unavailable"}</p>
        </div>
      </div>

      <Button asChild variant="outline">
        <a href="https://passport.cubid.me" target="_blank" rel="noreferrer">
          {manageCta}
          <ExternalLink className="ml-2 h-4 w-4" />
        </a>
      </Button>
    </div>
  )
}
