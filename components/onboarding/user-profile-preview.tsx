"use client"

import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { getDisplayName, type UserOnboardingPayload } from "@/lib/onboarding"

type UserProfilePreviewProps = {
  payload: UserOnboardingPayload
}

export function UserProfilePreview({ payload }: UserProfilePreviewProps) {
  const displayName = getDisplayName(payload)
  const interests = payload.interestIds.length

  return (
    <Card className="border-emerald-200/80 bg-gradient-to-br from-emerald-50 via-white to-cyan-50 shadow-sm">
      <CardHeader className="pb-4">
        <CardTitle className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-700">
          Profile Preview
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="flex items-center gap-4">
          <Avatar className="h-20 w-20 border border-emerald-200 bg-white">
            <AvatarImage src={payload.avatarUrl || undefined} alt={displayName} />
            <AvatarFallback>{displayName.slice(0, 2).toUpperCase()}</AvatarFallback>
          </Avatar>
          <div className="space-y-1">
            <h3 className="text-xl font-semibold text-slate-900">{displayName}</h3>
            <p className="text-sm text-slate-600">{payload.profileHeadline || "Your role and mission will appear here."}</p>
            <Badge variant={payload.visibility.isPublic ? "default" : "secondary"}>
              {payload.visibility.isPublic ? "Visible on FundLoop" : "Private draft"}
            </Badge>
          </div>
        </div>

        <div className="space-y-3 text-sm text-slate-700">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">About</p>
            <p className="mt-1">{payload.bio || "Add a short introduction so your profile feels alive as you build it."}</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Occupation</p>
              <p className="mt-1">{payload.occupationId ? `Selected option #${payload.occupationId}` : "Not set yet"}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Location</p>
              <p className="mt-1">{payload.locationId ? `Selected option #${payload.locationId}` : "Not set yet"}</p>
            </div>
          </div>

          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Interests</p>
            <p className="mt-1">{interests > 0 ? `${interests} interest${interests === 1 ? "" : "s"} selected` : "No interests selected yet"}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
