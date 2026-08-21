"use client"

import { useMemo } from "react"
import { PhoneOtpForm, ProviderConnectButton } from "@cubid/web2-react"
import { ExternalLink, RefreshCw, ShieldCheck } from "lucide-react"
import { createBrowserCubidWeb2Client } from "@/lib/cubid/browser-web2-client"
import { buildCubidProviderAllowUrl } from "@/lib/cubid/passport"
import {
  CUBID_PROVIDER_STAMPS,
  getVerifiedProviderStamps,
  hasVerifiedPhoneStamp,
  isResolvedCubidIdentityStatus,
  type CubidIdentitySnapshotSummary,
  type CubidIdentityStatus,
} from "@/lib/cubid/types"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"

type ExtendedCubidIdentityStepProps = {
  email: string | null
  cubidId: string | null
  cubidIdentityStatus: CubidIdentityStatus
  cubidSnapshot: CubidIdentitySnapshotSummary | null
  profileCompletionPercent: number
  profileCompletionMissingItems: string[]
  cubidPassportOrigin: string | null
  cubidStampPageId: string | null
  syncing: boolean
  onRefresh: () => void
  onSkip: () => void
}

const missingItemLabels: Record<string, string> = {
  display_name: "Choose a public display name",
  profile_headline: "Add a profile headline",
  bio: "Write a short bio",
  occupation: "Add your occupation",
  location: "Add your location",
  interests: "Pick at least one interest",
  cubid_link: "Link your CUBID identity",
  cubid_phone: "Verify a phone number",
  cubid_provider: "Connect at least one additional provider",
}

function labelForStamp(stamp: string) {
  return stamp === "phone" ? "Phone" : stamp.charAt(0).toUpperCase() + stamp.slice(1)
}

export function ExtendedCubidIdentityStep({
  email,
  cubidId,
  cubidIdentityStatus,
  cubidSnapshot,
  profileCompletionPercent,
  profileCompletionMissingItems,
  cubidPassportOrigin,
  cubidStampPageId,
  syncing,
  onRefresh,
  onSkip,
}: ExtendedCubidIdentityStepProps) {
  const cubidWeb2Client = useMemo(() => {
    if (!cubidPassportOrigin) {
      return null
    }

    return createBrowserCubidWeb2Client({
      passportOrigin: cubidPassportOrigin,
    })
  }, [cubidPassportOrigin])

  const verifiedProviders = getVerifiedProviderStamps(cubidSnapshot)
  const showPhoneCapture =
    Boolean(cubidId && cubidStampPageId && cubidWeb2Client && isResolvedCubidIdentityStatus(cubidIdentityStatus)) &&
    !hasVerifiedPhoneStamp(cubidSnapshot)

  return (
    <div className="space-y-6">
      <Card className="border-[color:var(--surface-border)] bg-[var(--surface-panel)]">
        <CardContent className="space-y-4 p-5">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--interactive-primary)]">
              Optional extended identity
            </p>
            <h3 className="text-lg font-semibold text-[var(--text-strong)]">Round out the credentials behind your profile</h3>
            <p className="text-sm leading-6 text-[var(--text-muted)]">
              Linking your email is enough to publish. This step is optional and helps FundLoop build a richer trust picture
              with phone verification and additional provider stamps.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-[color:var(--surface-border)] bg-[var(--surface-panel-strong)] px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--text-muted)]">Signed-in email</p>
              <p className="mt-1 text-sm text-[var(--text-strong)]">{email ?? "Not available"}</p>
            </div>
            <div className="rounded-2xl border border-[color:var(--surface-border)] bg-[var(--surface-panel-strong)] px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--text-muted)]">Profile completion</p>
              <div className="mt-2 space-y-2">
                <Progress value={profileCompletionPercent} className="h-2 bg-[var(--surface-border)]" />
                <p className="text-sm font-medium text-[var(--text-strong)]">{profileCompletionPercent}% complete</p>
              </div>
            </div>
          </div>

          {profileCompletionMissingItems.length > 0 ? (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--text-muted)]">Still missing</p>
              <div className="flex flex-wrap gap-2">
                {profileCompletionMissingItems.map((item) => (
                  <Badge key={item} variant="outline">
                    {missingItemLabels[item] ?? item}
                  </Badge>
                ))}
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50/80 px-4 py-3 text-sm text-emerald-950">
              Your current profile data and CUBID signals cover all Session 14 completion items.
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-[color:var(--surface-border)] bg-[var(--surface-panel)]">
        <CardContent className="space-y-4 p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-2">
              <h3 className="text-base font-semibold text-[var(--text-strong)]">Current CUBID snapshot</h3>
              <p className="text-sm leading-6 text-[var(--text-muted)]">
                Refresh after adding new credentials on CUBID Passport or after completing the phone step below.
              </p>
            </div>
            <Button type="button" variant="outline" onClick={onRefresh} disabled={syncing || !cubidId} className="gap-2">
              <RefreshCw className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
              {syncing ? "Refreshing..." : "Refresh CUBID data"}
            </Button>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-[color:var(--surface-border)] bg-[var(--surface-panel-strong)] px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--text-muted)]">Primary phone</p>
              <p className="mt-1 text-sm text-[var(--text-strong)]">{cubidSnapshot?.primaryPhone ?? "Not verified yet"}</p>
            </div>
            <div className="rounded-2xl border border-[color:var(--surface-border)] bg-[var(--surface-panel-strong)] px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--text-muted)]">Last sync</p>
              <p className="mt-1 text-sm text-[var(--text-strong)]">
                {cubidSnapshot?.lastSyncedAt ? new Date(cubidSnapshot.lastSyncedAt).toLocaleString() : "Not synced yet"}
              </p>
            </div>
          </div>

          {cubidSnapshot?.verifiedStampTypes.length ? (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--text-muted)]">Verified stamps</p>
              <div className="flex flex-wrap gap-2">
                {cubidSnapshot.verifiedStampTypes.map((stamp) => (
                  <Badge key={stamp}>
                    <ShieldCheck className="mr-1 h-3.5 w-3.5" />
                    {labelForStamp(stamp)}
                  </Badge>
                ))}
              </div>
            </div>
          ) : null}

          {cubidSnapshot?.lastSyncErrorMessage ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50/80 px-4 py-3 text-sm text-amber-950">
              {cubidSnapshot.lastSyncErrorMessage}
            </div>
          ) : null}
        </CardContent>
      </Card>

      {showPhoneCapture ? (
        <Card className="border-[color:var(--surface-border)] bg-[var(--surface-panel)]">
          <CardContent className="space-y-4 p-5">
            <div className="space-y-2">
              <h3 className="text-base font-semibold text-[var(--text-strong)]">Verify a phone number</h3>
              <p className="text-sm leading-6 text-[var(--text-muted)]">
                This is the first additional credential FundLoop can capture inline today using the CUBID web2 flow.
              </p>
            </div>

            <PhoneOtpForm
              client={cubidWeb2Client ?? undefined}
              className="grid gap-3"
              persistStamp={cubidId && cubidStampPageId ? { pageId: cubidStampPageId, userId: cubidId } : undefined}
              onVerified={() => {
                onRefresh()
              }}
            />
          </CardContent>
        </Card>
      ) : null}

      {cubidId && cubidPassportOrigin && cubidStampPageId ? (
        <Card className="border-[color:var(--surface-border)] bg-[var(--surface-panel)]">
          <CardContent className="space-y-4 p-5">
            <div className="space-y-2">
              <h3 className="text-base font-semibold text-[var(--text-strong)]">Connect additional providers</h3>
              <p className="text-sm leading-6 text-[var(--text-muted)]">
                These open the CUBID-hosted allow flow in a new tab. Come back here and refresh once you finish.
              </p>
            </div>

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

            {verifiedProviders.length > 0 ? (
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--text-muted)]">
                  Already connected
                </p>
                <div className="flex flex-wrap gap-2">
                  {verifiedProviders.map((provider) => (
                    <Badge key={provider} variant="outline">
                      {labelForStamp(provider)}
                    </Badge>
                  ))}
                </div>
              </div>
            ) : null}

            <Button asChild variant="ghost" className="w-fit gap-2 px-0">
              <a href={cubidPassportOrigin} target="_blank" rel="noreferrer">
                Open CUBID Passport directly
                <ExternalLink className="h-4 w-4" />
              </a>
            </Button>
          </CardContent>
        </Card>
      ) : null}

      <div className="flex justify-end">
        <Button type="button" variant="outline" onClick={onSkip}>
          Skip for now
        </Button>
      </div>
    </div>
  )
}
