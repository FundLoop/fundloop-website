"use client"

import { Badge } from "@/components/ui/badge"

type FundloopProfilePanelProps = {
  profile: {
    displayName: string | null
    profileHeadline: string | null
    bio: string | null
    occupationName: string | null
    locationName: string | null
    interestCount: number
    interestNames: string[]
    visibility: {
      isPublic: boolean
      isNamePublic: boolean
      isPfpPublic: boolean
      isGenderPublic: boolean
      isOccupationPublic: boolean
      isLocationPublic: boolean
    }
  }
  title: string
  description: string
  ownershipNote: string
}

function formatVisibility(visibility: FundloopProfilePanelProps["profile"]["visibility"]) {
  return [
    visibility.isPublic ? "Profile visible" : "Profile private",
    visibility.isNamePublic ? "Display name public" : "Display name private",
    visibility.isPfpPublic ? "Avatar public" : "Avatar private",
    visibility.isOccupationPublic ? "Occupation public" : "Occupation private",
    visibility.isLocationPublic ? "Location public" : "Location private",
    visibility.isGenderPublic ? "Gender public" : "Gender private",
  ]
}

export function FundloopProfilePanel({ profile, title, description, ownershipNote }: FundloopProfilePanelProps) {
  const visibilityChips = formatVisibility(profile.visibility)

  return (
    <div className="space-y-5">
      <div className="rounded-3xl border border-[color:var(--surface-border)] bg-[var(--surface-panel)] p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--interactive-primary)]">{title}</p>
        <h2 className="mt-2 text-lg font-semibold text-[var(--text-strong)]">FundLoop-managed profile preferences</h2>
        <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">{description}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-[color:var(--surface-border)] bg-[var(--surface-panel)] px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--text-muted)]">Display name</p>
          <p className="mt-1 text-sm text-[var(--text-strong)]">{profile.displayName ?? "Not set yet"}</p>
        </div>
        <div className="rounded-2xl border border-[color:var(--surface-border)] bg-[var(--surface-panel)] px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--text-muted)]">Profile headline</p>
          <p className="mt-1 text-sm text-[var(--text-strong)]">{profile.profileHeadline ?? "Not set yet"}</p>
        </div>
      </div>

      <div className="rounded-2xl border border-[color:var(--surface-border)] bg-[var(--surface-panel)] px-4 py-3">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--text-muted)]">Bio</p>
        <p className="mt-1 text-sm leading-6 text-[var(--text-strong)]">{profile.bio ?? "Not set yet"}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-[color:var(--surface-border)] bg-[var(--surface-panel)] px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--text-muted)]">Occupation</p>
          <p className="mt-1 text-sm text-[var(--text-strong)]">{profile.occupationName ?? "Not set yet"}</p>
        </div>
        <div className="rounded-2xl border border-[color:var(--surface-border)] bg-[var(--surface-panel)] px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--text-muted)]">Location</p>
          <p className="mt-1 text-sm text-[var(--text-strong)]">{profile.locationName ?? "Not set yet"}</p>
        </div>
      </div>

      <div className="rounded-2xl border border-[color:var(--surface-border)] bg-[var(--surface-panel)] px-4 py-3">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--text-muted)]">Interests</p>
        <p className="mt-1 text-sm text-[var(--text-strong)]">
          {profile.interestCount > 0 ? `${profile.interestCount} selected` : "No interests selected yet"}
        </p>
        {profile.interestNames.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {profile.interestNames.map((interest) => (
              <Badge key={interest} variant="outline">
                {interest}
              </Badge>
            ))}
          </div>
        ) : null}
      </div>

      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--text-muted)]">Visibility preferences</p>
        <div className="flex flex-wrap gap-2">
          {visibilityChips.map((item) => (
            <Badge key={item} variant="outline">
              {item}
            </Badge>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-[color:var(--surface-border)] bg-[var(--surface-panel-strong)] px-4 py-3 text-sm leading-6 text-[var(--text-muted)]">
        {ownershipNote}
      </div>
    </div>
  )
}
