"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { PhoneOtpForm, ProviderConnectButton } from "@cubid/web2-react"
import { BadgeCheck, ExternalLink, RefreshCw, ShieldAlert, ShieldCheck } from "lucide-react"
import { createBrowserCubidWeb2Client } from "@/lib/cubid/browser-web2-client"
import { invokeUserCubidSyncProfileBrowser } from "@/lib/edge-functions/user-cubid-sync-profile"
import { buildCubidProviderAllowUrl } from "@/lib/cubid/passport"
import type { CubidIdentityOwnership, ManagedIdentityField } from "@/lib/cubid/read-model"
import {
  CUBID_PROVIDER_STAMPS,
  getVerifiedProviderStamps,
  hasVerifiedPhoneStamp,
  type CubidIdentitySnapshotSummary,
  type CubidIdentityStatus,
} from "@/lib/cubid/types"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"

type CubidIdentityPanelProps = {
  status: CubidIdentityStatus
  signedInEmail: string | null
  cubidId: string | null
  cubidScore: number | null
  cubidSnapshot: CubidIdentitySnapshotSummary | null
  managedIdentity: {
    fullName: ManagedIdentityField
    primaryEmail: ManagedIdentityField
    primaryPhone: ManagedIdentityField
  }
  identityOwnership: CubidIdentityOwnership
  profileCompletionPercent: number
  profileCompletionMissingItems: string[]
  cubidPassportOrigin: string | null
  cubidStampPageId: string | null
  title: string
  description: string
  linkedLabel: string
  verifiedLabel: string
  unlinkedLabel: string
  manageCta: string
  refreshCta: string
  completionTitle: string
}

const missingItemLabels: Record<string, string> = {
  profile_headline: "Add a profile headline",
  display_name: "Choose a display name",
  bio: "Write a bio",
  occupation: "Add your occupation",
  location: "Add your location",
  interests: "Pick at least one interest",
  cubid_link: "Link CUBID",
  cubid_phone: "Verify a phone number",
  cubid_provider: "Connect an additional provider",
}

const ownershipLabels: Record<string, string> = {
  full_name: "Full name",
  email: "Email",
  phone: "Phone",
  provider_stamps: "Provider and social stamps",
  verification_state: "Verification state",
  cubid_score: "CUBID score",
  display_name: "Display name",
  profile_headline: "Profile headline",
  bio: "Bio",
  occupation: "Occupation",
  location: "Location",
  interests: "Interests",
  visibility: "Visibility preferences",
  wallets: "Wallets",
}

function labelForStamp(stamp: string) {
  return stamp === "phone" ? "Phone" : stamp.charAt(0).toUpperCase() + stamp.slice(1)
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

function getManagedFieldBadge(field: ManagedIdentityField) {
  switch (field.state) {
    case "synced":
      return {
        label: "Synced from CUBID",
        className: "border-emerald-200 bg-emerald-50 text-emerald-950",
      }
    case "legacy_local_fallback":
      return {
        label: "Legacy FundLoop fallback",
        className: "border-amber-200 bg-amber-50 text-amber-950",
      }
    default:
      return {
        label: "Pending from CUBID",
        className: "border-slate-200 bg-slate-50 text-slate-900",
      }
  }
}

export function CubidIdentityPanel({
  status,
  signedInEmail,
  cubidId,
  cubidScore,
  cubidSnapshot,
  managedIdentity,
  identityOwnership,
  profileCompletionPercent,
  profileCompletionMissingItems,
  cubidPassportOrigin,
  cubidStampPageId,
  title,
  description,
  linkedLabel,
  verifiedLabel,
  unlinkedLabel,
  manageCta,
  refreshCta,
  completionTitle,
}: CubidIdentityPanelProps) {
  const router = useRouter()
  const [refreshing, setRefreshing] = useState(false)
  const meta = getStatusMeta(status)
  const Icon = meta.icon
  const statusLabel = status === "verified" ? verifiedLabel : status === "linked" ? linkedLabel : unlinkedLabel
  const cubidWeb2Client = useMemo(() => {
    if (!cubidPassportOrigin) {
      return null
    }

    return createBrowserCubidWeb2Client({
      passportOrigin: cubidPassportOrigin,
    })
  }, [cubidPassportOrigin])
  const verifiedProviders = getVerifiedProviderStamps(cubidSnapshot)

  const handleRefresh = async () => {
    setRefreshing(true)
    const result = await invokeUserCubidSyncProfileBrowser()
    setRefreshing(false)

    if (result.ok) {
      router.refresh()
    }
  }

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
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--text-muted)]">Signed-in email</p>
          <p className="mt-1 text-sm text-[var(--text-strong)]">{signedInEmail ?? "Not available"}</p>
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

      <div className="rounded-3xl border border-[color:var(--surface-border)] bg-[var(--surface-panel-strong)] p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--text-muted)]">CUBID-managed identity</p>
            <p className="mt-1 text-sm leading-6 text-[var(--text-muted)]">
              These values are sourced from CUBID and treated as the identity authority inside FundLoop. Missing values remain
              read-only and pending until CUBID provides them.
            </p>
          </div>
          <Button type="button" variant="outline" onClick={() => void handleRefresh()} disabled={refreshing || !cubidId}>
            <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
            {refreshing ? "Refreshing..." : refreshCta}
          </Button>
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-3">
          {([
            ["Full name", managedIdentity.fullName],
            ["Primary email", managedIdentity.primaryEmail],
            ["Primary phone", managedIdentity.primaryPhone],
          ] as const).map(([label, field]) => {
            const badge = getManagedFieldBadge(field as ManagedIdentityField)
            return (
              <div
                key={label}
                className="rounded-2xl border border-[color:var(--surface-border)] bg-[var(--surface-panel)] px-4 py-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--text-muted)]">{label}</p>
                  <Badge variant="outline" className={badge.className}>
                    {badge.label}
                  </Badge>
                </div>
                <p className="mt-3 text-sm text-[var(--text-strong)]">{field.value ?? "Pending from CUBID"}</p>
              </div>
            )
          })}
        </div>
      </div>

      <div className="rounded-3xl border border-[color:var(--surface-border)] bg-[var(--surface-panel-strong)] p-5">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--text-muted)]">{completionTitle}</p>
              <p className="mt-1 text-sm leading-6 text-[var(--text-muted)]">
                FundLoop now separates identity trust from local preferences. Completion rewards synced CUBID identity plus
                local profile context that still belongs inside the product.
              </p>
            </div>
          </div>
          <Progress value={profileCompletionPercent} className="h-2 bg-[var(--surface-border)]" />
          <p className="text-sm font-semibold text-[var(--text-strong)]">{profileCompletionPercent}% complete</p>
          <div className="flex flex-wrap gap-2">
            {profileCompletionMissingItems.length > 0 ? (
              profileCompletionMissingItems.map((item) => (
                <Badge key={item} variant="outline">
                  {missingItemLabels[item] ?? item}
                </Badge>
              ))
            ) : (
              <Badge>All current completion items covered</Badge>
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-[color:var(--surface-border)] bg-[var(--surface-panel)] px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--text-muted)]">Ownership split</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {identityOwnership.cubidManaged.map((item) => (
              <Badge key={item} className="bg-cyan-100 text-cyan-950 hover:bg-cyan-100">
                {ownershipLabels[item] ?? item}
              </Badge>
            ))}
          </div>
        </div>
        <div className="rounded-2xl border border-[color:var(--surface-border)] bg-[var(--surface-panel)] px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--text-muted)]">Still local to FundLoop</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {identityOwnership.fundloopManaged.map((item) => (
              <Badge key={item} variant="outline">
                {ownershipLabels[item] ?? item}
              </Badge>
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-[color:var(--surface-border)] bg-[var(--surface-panel)] px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--text-muted)]">Verified stamps</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {cubidSnapshot?.verifiedStampTypes.length ? (
              cubidSnapshot.verifiedStampTypes.map((stamp) => (
                <Badge key={stamp}>
                  <ShieldCheck className="mr-1 h-3.5 w-3.5" />
                  {labelForStamp(stamp)}
                </Badge>
              ))
            ) : (
              <p className="text-sm text-[var(--text-muted)]">No verified stamps recorded yet.</p>
            )}
          </div>
        </div>
        <div className="rounded-2xl border border-[color:var(--surface-border)] bg-[var(--surface-panel)] px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--text-muted)]">Last sync</p>
          <p className="mt-1 text-sm text-[var(--text-strong)]">
            {cubidSnapshot?.lastSyncedAt ? new Date(cubidSnapshot.lastSyncedAt).toLocaleString() : "Not synced yet"}
          </p>
          {cubidSnapshot?.lastSyncErrorMessage ? (
            <p className="mt-2 text-sm text-amber-900">{cubidSnapshot.lastSyncErrorMessage}</p>
          ) : null}
        </div>
      </div>

      {cubidId && cubidStampPageId && cubidWeb2Client && !hasVerifiedPhoneStamp(cubidSnapshot) ? (
        <div className="rounded-3xl border border-[color:var(--surface-border)] bg-[var(--surface-panel)] p-5">
          <div className="space-y-3">
            <h3 className="text-base font-semibold text-[var(--text-strong)]">Verify your phone</h3>
            <p className="text-sm leading-6 text-[var(--text-muted)]">
              Phone remains optional for publish, but it is one of the clearest additional trust signals the current CUBID bridge
              can collect inline.
            </p>
            <PhoneOtpForm
              client={cubidWeb2Client}
              className="grid gap-3"
              persistStamp={{ pageId: cubidStampPageId, userId: cubidId }}
              onVerified={() => {
                void handleRefresh()
              }}
            />
          </div>
        </div>
      ) : null}

      {cubidId && cubidPassportOrigin && cubidStampPageId ? (
        <div className="rounded-3xl border border-[color:var(--surface-border)] bg-[var(--surface-panel)] p-5">
          <div className="space-y-3">
            <h3 className="text-base font-semibold text-[var(--text-strong)]">Connect another provider</h3>
            <p className="text-sm leading-6 text-[var(--text-muted)]">
              Missing providers open in CUBID Passport. Once you finish there, return here and refresh the snapshot.
            </p>
            <div className="flex flex-wrap gap-3">
              {CUBID_PROVIDER_STAMPS.filter((provider) => !verifiedProviders.includes(provider)).map((provider) => (
                <ProviderConnectButton
                  key={provider}
                  provider={provider}
                  authorizationUrl={buildCubidProviderAllowUrl({
                    passportOrigin: cubidPassportOrigin,
                    cubidUserId: cubidId,
                    stampPageId: cubidStampPageId,
                    provider,
                  })}
                  onConnect={({ url }) => {
                    if (url) {
                      window.open(url, "_blank", "noopener,noreferrer")
                    }
                  }}
                  className="inline-flex items-center rounded-full border border-[color:var(--surface-border-strong)] px-4 py-2 text-sm font-semibold text-[var(--text-strong)]"
                >
                  Connect {labelForStamp(provider)}
                </ProviderConnectButton>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      <Button asChild variant="outline">
        <a href={cubidPassportOrigin ?? "https://passport.cubid.me"} target="_blank" rel="noreferrer">
          {manageCta}
          <ExternalLink className="ml-2 h-4 w-4" />
        </a>
      </Button>
    </div>
  )
}
