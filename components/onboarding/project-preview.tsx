"use client"

import { Globe, Mail, Percent } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { ProjectOnboardingPayload } from "@/lib/onboarding"

type ProjectPreviewProps = {
  payload: ProjectOnboardingPayload
}

export function ProjectPreview({ payload }: ProjectPreviewProps) {
  const name = payload.name.trim() || "Future FundLoop project"
  const slug = payload.slug.trim() || "your-project-slug"

  return (
    <Card className="border-cyan-200/80 bg-gradient-to-br from-cyan-50 via-white to-emerald-50 shadow-sm">
      <CardHeader className="pb-4">
        <CardTitle className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-700">
          Project Preview
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="flex items-start gap-4">
          <Avatar className="h-20 w-20 rounded-2xl border border-cyan-200 bg-white">
            <AvatarImage src={payload.logoUrl || undefined} alt={name} />
            <AvatarFallback className="rounded-2xl">{name.slice(0, 2).toUpperCase()}</AvatarFallback>
          </Avatar>
          <div className="space-y-1">
            <h3 className="text-xl font-semibold text-slate-900">{name}</h3>
            <p className="font-mono text-xs text-slate-500">fundloop/{slug}</p>
            <Badge variant="secondary">{payload.pledgeAccepted ? "1% pledge accepted" : "Draft project"}</Badge>
          </div>
        </div>

        <div className="space-y-3 text-sm text-slate-700">
          <p>{payload.description || "Add a short public description to see your project card come together."}</p>

          <div className="grid gap-2">
            <div className="flex items-center gap-2 text-slate-600">
              <Globe className="h-4 w-4" />
              <span>{payload.website || "No website yet"}</span>
            </div>
            <div className="flex items-center gap-2 text-slate-600">
              <Mail className="h-4 w-4" />
              <span>{payload.contactEmail || "No contact email yet"}</span>
            </div>
            <div className="flex items-center gap-2 text-slate-600">
              <Percent className="h-4 w-4" />
              <span>{payload.paymentPercentage || "1.0"}% revenue contribution</span>
            </div>
          </div>

          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Categories</p>
            <p className="mt-1">
              {payload.categoryIds.length > 0
                ? `${payload.categoryIds.length} categor${payload.categoryIds.length === 1 ? "y" : "ies"} selected`
                : "No categories selected yet"}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
