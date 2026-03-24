"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { ArrowLeft, ArrowRight, CheckCircle2 } from "lucide-react"
import {
  clearProjectOnboardingDraft,
  getOnboardingState,
  publishProjectOnboardingDraft,
  upsertProjectOnboardingDraft,
} from "@/app/actions/onboarding-actions"
import { getSupabaseBrowserClient } from "@/lib/supabase"
import {
  DEFAULT_PROJECT_ONBOARDING_PAYLOAD,
  sanitizeProjectSlug,
  type ProjectOnboardingPayload,
  type ProjectOnboardingScreen,
  mergeProjectOnboardingPayload,
} from "@/lib/onboarding"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "@/components/ui/use-toast"
import { OnboardingAuthStep } from "@/components/onboarding/onboarding-auth-step"
import { OnboardingShell } from "@/components/onboarding/onboarding-shell"
import { ProjectPreview } from "@/components/onboarding/project-preview"
import type { ComboboxOption } from "@/components/ui/combobox"

type ProjectSignupFlowProps = {
  onClose: () => void
}

type ReferenceData = {
  categories: ComboboxOption[]
  paymentMethods: ComboboxOption[]
  paymentPeriodicities: ComboboxOption[]
}

const PROJECT_SCREEN_ORDER: ProjectOnboardingScreen[] = ["basics", "details", "contribution", "review"]

function formatDraftTime(value: string | null | undefined) {
  if (!value) {
    return "recently"
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value))
}

export default function ProjectSignupFlow({ onClose }: ProjectSignupFlowProps) {
  const [loading, setLoading] = useState(true)
  const [authUserId, setAuthUserId] = useState<string | null>(null)
  const [currentScreen, setCurrentScreen] = useState<ProjectOnboardingScreen>("basics")
  const [resumeTargetScreen, setResumeTargetScreen] = useState<ProjectOnboardingScreen>("basics")
  const [payload, setPayload] = useState<ProjectOnboardingPayload>(DEFAULT_PROJECT_ONBOARDING_PAYLOAD)
  const [draftTimestamp, setDraftTimestamp] = useState<string | null>(null)
  const [references, setReferences] = useState<ReferenceData>({
    categories: [],
    paymentMethods: [],
    paymentPeriodicities: [],
  })
  const [saving, setSaving] = useState(false)
  const [publishing, setPublishing] = useState(false)

  const autosaveReady = useRef(false)
  const slugEdited = useRef(false)

  const selectedCategories = useMemo(
    () =>
      references.categories
        .filter((category) => payload.categoryIds.includes(category.value))
        .map((category) => category.label),
    [payload.categoryIds, references.categories],
  )

  useEffect(() => {
    const supabase = getSupabaseBrowserClient()

    const loadSession = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      setAuthUserId(user?.id ?? null)
    }

    void loadSession()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_, session) => {
      setAuthUserId(session?.user?.id ?? null)
    })

    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    const fetchReferences = async () => {
      const supabase = getSupabaseBrowserClient()
      const [{ data: categories }, { data: paymentMethods }, { data: periodicities }] = await Promise.all([
        supabase.from("ref_categories").select("id, name").order("name"),
        supabase.from("ref_payment_methods").select("id, name, code").order("display_order"),
        supabase.from("ref_payment_periodicities").select("id, name, code").order("display_order"),
      ])

      const paymentMethodOptions =
        paymentMethods?.map((item) => ({
          value: String(item.id),
          label: item.name,
          code: item.code,
        })) ?? []

      const periodicityOptions =
        periodicities?.map((item) => ({
          value: String(item.id),
          label: item.name,
          code: item.code,
        })) ?? []

      setReferences({
        categories: categories?.map((item) => ({ value: String(item.id), label: item.name })) ?? [],
        paymentMethods: paymentMethodOptions,
        paymentPeriodicities: periodicityOptions,
      })

      setPayload((previous) => ({
        ...previous,
        paymentMethodId:
          previous.paymentMethodId ||
          paymentMethodOptions.find((option) => option.code === "bank_transfer")?.value ||
          paymentMethodOptions[0]?.value ||
          "",
        paymentPeriodicityId:
          previous.paymentPeriodicityId ||
          periodicityOptions.find((option) => option.code === "month")?.value ||
          periodicityOptions[0]?.value ||
          "",
      }))
    }

    void fetchReferences()
  }, [])

  useEffect(() => {
    const loadState = async () => {
      setLoading(true)
      const state = await getOnboardingState()

      setAuthUserId(state.authUserId)

      if (!state.authUserId) {
        setCurrentScreen("basics")
        setPayload(DEFAULT_PROJECT_ONBOARDING_PAYLOAD)
        autosaveReady.current = false
        setLoading(false)
        return
      }

      if (state.projectDraft) {
        const draftPayload = mergeProjectOnboardingPayload(state.projectDraft.payload as Partial<ProjectOnboardingPayload>)
        setPayload(draftPayload)
        setResumeTargetScreen(
          PROJECT_SCREEN_ORDER.includes(state.projectDraft.current_screen as ProjectOnboardingScreen)
            ? (state.projectDraft.current_screen as ProjectOnboardingScreen)
            : "basics",
        )
        setCurrentScreen("resume")
        setDraftTimestamp(state.projectDraft.updated_at || state.projectDraft.started_at)
      } else {
        setPayload((previous) => mergeProjectOnboardingPayload(previous))
        setCurrentScreen("basics")
        setResumeTargetScreen("basics")
        setDraftTimestamp(null)
      }

      autosaveReady.current = true
      setLoading(false)
    }

    void loadState()
  }, [authUserId])

  useEffect(() => {
    if (!autosaveReady.current || !authUserId || currentScreen === "resume") {
      return
    }

    const timeoutId = window.setTimeout(() => {
      setSaving(true)
      void upsertProjectOnboardingDraft({
        currentScreen,
        payload,
      }).finally(() => setSaving(false))
    }, 600)

    return () => window.clearTimeout(timeoutId)
  }, [authUserId, currentScreen, payload])

  const updatePayload = (partial: Partial<ProjectOnboardingPayload>) => {
    setPayload((previous) => mergeProjectOnboardingPayload({ ...previous, ...partial }))
  }

  const toggleCategory = (categoryId: string) => {
    setPayload((previous) => {
      const categoryIds = previous.categoryIds.includes(categoryId)
        ? previous.categoryIds.filter((current) => current !== categoryId)
        : [...previous.categoryIds, categoryId]

      return {
        ...previous,
        categoryIds,
      }
    })
  }

  const getPreviousScreen = () => {
    const currentIndex = PROJECT_SCREEN_ORDER.indexOf(currentScreen)
    return currentIndex <= 0 ? "basics" : PROJECT_SCREEN_ORDER[currentIndex - 1]
  }

  const getNextScreen = () => {
    const currentIndex = PROJECT_SCREEN_ORDER.indexOf(currentScreen)
    return PROJECT_SCREEN_ORDER[Math.min(currentIndex + 1, PROJECT_SCREEN_ORDER.length - 1)]
  }

  const canContinue = () => {
    switch (currentScreen) {
      case "basics":
        return Boolean(
          payload.name.trim() &&
            payload.slug.trim() &&
            payload.website.trim() &&
            payload.description.trim() &&
            payload.contactEmail.trim(),
        )
      case "details":
        return Boolean(payload.detailedDescription.trim() && payload.categoryIds.length > 0)
      case "contribution":
        return Boolean(
          payload.pledgeAccepted &&
            payload.paymentMethodId &&
            payload.billingEmail.trim() &&
            payload.paymentPeriodicityId &&
            payload.paymentPercentage.trim(),
        )
      case "review":
        return true
      default:
        return true
    }
  }

  const handleStartOver = async () => {
    setSaving(true)
    const result = await clearProjectOnboardingDraft()
    setSaving(false)

    if (!result.ok) {
      toast({
        title: "Could not restart project onboarding",
        description: result.error,
        variant: "destructive",
      })
      return
    }

    setPayload(DEFAULT_PROJECT_ONBOARDING_PAYLOAD)
    setCurrentScreen("basics")
    setResumeTargetScreen("basics")
    setDraftTimestamp(null)
  }

  const handlePublish = async () => {
    setPublishing(true)
    const result = await publishProjectOnboardingDraft()
    setPublishing(false)

    if (!result.ok) {
      toast({
        title: "Could not publish project",
        description: result.error,
        variant: "destructive",
      })
      return
    }

    toast({
      title: "Project published",
      description: "Your new FundLoop project is now live.",
    })

    onClose()
  }

  const preview = (
    <div className="space-y-4">
      <ProjectPreview payload={payload} />
      <Card className="border-dashed">
        <CardContent className="space-y-2 p-4 text-sm text-slate-600">
          <p className="font-medium text-slate-900">Project setup summary</p>
          <p>Categories: {selectedCategories.length > 0 ? selectedCategories.join(", ") : "Not set yet"}</p>
          <p>Billing email: {payload.billingEmail || "Not set yet"}</p>
          <p>Contribution cadence: {payload.billingFrequency || "Not set yet"}</p>
        </CardContent>
      </Card>
    </div>
  )

  if (loading) {
    return <div className="p-10 text-sm text-muted-foreground">Loading your project draft...</div>
  }

  if (!authUserId) {
    return (
      <OnboardingShell
        eyebrow="Project onboarding"
        title="Sign in to create a project draft"
        description="Project drafts are saved to your account and only published when you finish the full setup."
        compact
      >
        <OnboardingAuthStep
          title="Authenticate to continue"
          description="Once you’re signed in, FundLoop will save each project screen automatically."
          onAuthenticated={() => setAuthUserId("pending")}
        />
      </OnboardingShell>
    )
  }

  if (currentScreen === "resume") {
    return (
      <OnboardingShell
        eyebrow="Resume"
        title="You already have a draft project"
        description={`It looks like you have a draft project created from ${formatDraftTime(
          draftTimestamp,
        )}. Let’s continue where you left off last.`}
        compact
        footer={
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Button variant="outline" onClick={() => void handleStartOver()} disabled={saving}>
              Start over
            </Button>
            <Button onClick={() => setCurrentScreen(resumeTargetScreen)} className="gap-2">
              Continue draft
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        }
      >
        <div className="rounded-2xl border border-cyan-200 bg-cyan-50/70 p-4 text-sm text-cyan-900">
          Your project is still private. Nothing will appear on the public projects pages until you publish.
        </div>
      </OnboardingShell>
    )
  }

  return (
    <OnboardingShell
      eyebrow={`Project setup • ${PROJECT_SCREEN_ORDER.indexOf(currentScreen) + 1}/${PROJECT_SCREEN_ORDER.length}`}
      title={
        currentScreen === "basics"
          ? "Start with the project essentials"
          : currentScreen === "details"
            ? "Describe what this project stands for"
            : currentScreen === "contribution"
              ? "Set the contribution and billing details"
              : "Review and publish your project"
      }
      description={
        currentScreen === "basics"
          ? "Capture the public-facing details that will shape the project preview."
          : currentScreen === "details"
            ? "Fill in the richer description, categories, and positioning for this project."
            : currentScreen === "contribution"
              ? "Confirm the FundLoop pledge and the practical billing fields required to go live."
              : "Check the preview and publish only when the project card is ready for others to see."
      }
      preview={preview}
      footer={
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm text-slate-500">{saving ? "Saving your project draft..." : "Every project step is saved automatically."}</div>
          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={() => setCurrentScreen(getPreviousScreen())}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
            {currentScreen === "review" ? (
              <Button onClick={() => void handlePublish()} disabled={publishing} className="gap-2">
                <CheckCircle2 className="h-4 w-4" />
                {publishing ? "Publishing..." : "Publish project"}
              </Button>
            ) : (
              <Button onClick={() => setCurrentScreen(getNextScreen())} disabled={!canContinue()} className="gap-2">
                Continue
                <ArrowRight className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      }
    >
      {currentScreen === "basics" ? (
        <div className="space-y-5">
          <div className="grid gap-5 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="project-name">Project name</Label>
              <Input
                id="project-name"
                value={payload.name}
                onChange={(event) => {
                  const name = event.target.value
                  updatePayload({
                    name,
                    slug: slugEdited.current ? payload.slug : sanitizeProjectSlug(name),
                  })
                }}
                placeholder="FundLoop Studio"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="project-slug">Project slug</Label>
              <Input
                id="project-slug"
                value={payload.slug}
                onChange={(event) => {
                  slugEdited.current = true
                  updatePayload({ slug: sanitizeProjectSlug(event.target.value) })
                }}
                placeholder="fundloop-studio"
              />
            </div>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="project-website">Website</Label>
              <Input
                id="project-website"
                value={payload.website}
                onChange={(event) => updatePayload({ website: event.target.value })}
                placeholder="https://example.org"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="project-contact-email">Contact email</Label>
              <Input
                id="project-contact-email"
                type="email"
                value={payload.contactEmail}
                onChange={(event) => updatePayload({ contactEmail: event.target.value })}
                placeholder="team@example.org"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="project-logo-url">Logo URL</Label>
            <Input
              id="project-logo-url"
              value={payload.logoUrl}
              onChange={(event) => updatePayload({ logoUrl: event.target.value })}
              placeholder="https://..."
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="project-description">Short description</Label>
            <Textarea
              id="project-description"
              rows={4}
              value={payload.description}
              onChange={(event) => updatePayload({ description: event.target.value })}
              placeholder="A short public summary of what this project does and why it matters."
            />
          </div>
        </div>
      ) : null}

      {currentScreen === "details" ? (
        <div className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="project-detailed-description">Detailed description</Label>
            <Textarea
              id="project-detailed-description"
              rows={8}
              value={payload.detailedDescription}
              onChange={(event) => updatePayload({ detailedDescription: event.target.value })}
              placeholder="Explain the mission, product, team, and why this project belongs in the FundLoop ecosystem."
            />
          </div>

          <div className="space-y-2">
            <Label>Categories</Label>
            <div className="flex max-h-48 flex-wrap gap-2 overflow-y-auto rounded-2xl border p-3">
              {references.categories.map((category) => {
                const active = payload.categoryIds.includes(category.value)
                return (
                  <Button
                    key={category.value}
                    type="button"
                    variant={active ? "default" : "outline"}
                    size="sm"
                    onClick={() => toggleCategory(category.value)}
                  >
                    {category.label}
                  </Button>
                )
              })}
            </div>
          </div>
        </div>
      ) : null}

      {currentScreen === "contribution" ? (
        <div className="space-y-6">
          <div className="flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4">
            <Checkbox
              id="pledge-accepted"
              checked={payload.pledgeAccepted}
              onCheckedChange={(checked) => updatePayload({ pledgeAccepted: checked === true })}
            />
            <div className="space-y-1 text-sm">
              <Label htmlFor="pledge-accepted" className="font-medium text-emerald-950">
                Our project agrees to the FundLoop 1% pledge
              </Label>
              <p className="text-emerald-900">
                We understand the project will contribute at least 1% of revenue on the cadence configured below.
              </p>
            </div>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Payment method</Label>
              <Select value={payload.paymentMethodId} onValueChange={(value) => updatePayload({ paymentMethodId: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a payment method" />
                </SelectTrigger>
                <SelectContent>
                  {references.paymentMethods.map((method) => (
                    <SelectItem key={method.value} value={method.value}>
                      {method.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Contribution cadence</Label>
              <Select
                value={payload.paymentPeriodicityId}
                onValueChange={(value) => updatePayload({ paymentPeriodicityId: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choose a cadence" />
                </SelectTrigger>
                <SelectContent>
                  {references.paymentPeriodicities.map((periodicity) => (
                    <SelectItem key={periodicity.value} value={periodicity.value}>
                      {periodicity.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="project-billing-email">Billing email</Label>
              <Input
                id="project-billing-email"
                type="email"
                value={payload.billingEmail}
                onChange={(event) => updatePayload({ billingEmail: event.target.value })}
                placeholder="billing@example.org"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="project-payment-percentage">Revenue contribution %</Label>
              <Input
                id="project-payment-percentage"
                type="number"
                min="1"
                step="0.1"
                value={payload.paymentPercentage}
                onChange={(event) => updatePayload({ paymentPercentage: event.target.value })}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="project-billing-frequency">Billing frequency label</Label>
            <Input
              id="project-billing-frequency"
              value={payload.billingFrequency}
              onChange={(event) => updatePayload({ billingFrequency: event.target.value })}
              placeholder="monthly"
            />
          </div>
        </div>
      ) : null}

      {currentScreen === "review" ? (
        <div className="space-y-6">
          <div className="rounded-3xl border border-cyan-200 bg-cyan-50/70 p-5">
            <h3 className="font-semibold text-cyan-950">Ready to publish</h3>
            <p className="mt-2 text-sm text-cyan-900">
              Publishing creates the organization, project, category links, and owner memberships in one flow.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardContent className="space-y-2 p-4 text-sm text-slate-600">
                <p className="font-medium text-slate-900">Project summary</p>
                <p>Name: {payload.name}</p>
                <p>Slug: {payload.slug}</p>
                <p>Contact: {payload.contactEmail}</p>
                <p>Categories: {selectedCategories.length > 0 ? selectedCategories.join(", ") : "None selected"}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="space-y-2 p-4 text-sm text-slate-600">
                <p className="font-medium text-slate-900">Contribution summary</p>
                <p>Pledge accepted: {payload.pledgeAccepted ? "Yes" : "No"}</p>
                <p>Billing email: {payload.billingEmail}</p>
                <p>Contribution: {payload.paymentPercentage}%</p>
              </CardContent>
            </Card>
          </div>
        </div>
      ) : null}
    </OnboardingShell>
  )
}
