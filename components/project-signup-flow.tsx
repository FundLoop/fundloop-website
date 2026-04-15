"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, ArrowRight, CheckCircle2, Plus, Trash2 } from "lucide-react"
import {
  getOnboardingState,
} from "@/app/actions/onboarding-actions"
import { CubidIdentityStep } from "@/components/onboarding/cubid-identity-step"
import { isResolvedCubidIdentityStatus } from "@/lib/cubid/types"
import { invokeProjectOnboardingDraftClearBrowser } from "@/lib/edge-functions/project-onboarding-draft-clear"
import { invokeProjectOnboardingPublishBrowser } from "@/lib/edge-functions/project-onboarding-publish"
import { invokeProjectOnboardingDraftUpsertBrowser } from "@/lib/edge-functions/project-onboarding-draft-upsert"
import { invokeUserCubidResolveEmailBrowser } from "@/lib/edge-functions/user-cubid-resolve-email"
import { getSupabaseBrowserClient } from "@/lib/supabase"
import {
  DEFAULT_PROJECT_ONBOARDING_PAYLOAD,
  createEmptyProjectCryptoPaymentMethod,
  type ProjectCryptoPaymentMethod,
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
  paymentPeriodicities: ComboboxOption[]
  chains: ComboboxOption[]
  chainAssets: Array<ComboboxOption & { chainId: string; isNative: boolean }>
  intakeContracts: Array<ComboboxOption & { chainId: string }>
}

const PROJECT_SCREEN_ORDER: ProjectOnboardingScreen[] = ["cubid", "basics", "details", "contribution", "review"]

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
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [authUserId, setAuthUserId] = useState<string | null>(null)
  const [authEmail, setAuthEmail] = useState<string | null>(null)
  const [currentScreen, setCurrentScreen] = useState<ProjectOnboardingScreen>("cubid")
  const [resumeTargetScreen, setResumeTargetScreen] = useState<ProjectOnboardingScreen>("cubid")
  const [cubidIdentityStatus, setCubidIdentityStatus] = useState<"unlinked" | "linked" | "verified">("unlinked")
  const [cubidId, setCubidId] = useState<string | null>(null)
  const [cubidScore, setCubidScore] = useState<number | null>(null)
  const [payload, setPayload] = useState<ProjectOnboardingPayload>(DEFAULT_PROJECT_ONBOARDING_PAYLOAD)
  const [draftTimestamp, setDraftTimestamp] = useState<string | null>(null)
  const [references, setReferences] = useState<ReferenceData>({
    categories: [],
    paymentPeriodicities: [],
    chains: [],
    chainAssets: [],
    intakeContracts: [],
  })
  const [saving, setSaving] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [resolvingCubid, setResolvingCubid] = useState(false)

  const autosaveReady = useRef(false)
  const slugEdited = useRef(false)

  const selectedCategories = useMemo(
    () =>
      references.categories
        .filter((category) => payload.categoryIds.includes(category.value))
        .map((category) => category.label),
    [payload.categoryIds, references.categories],
  )

  const paymentMethodSummaries = useMemo(
    () =>
      payload.cryptoPaymentMethods.map((method) => {
        const chain = references.chains.find((item) => item.value === method.chainId)?.label ?? "Choose a chain"
        const asset = references.chainAssets.find((item) => item.value === method.chainAssetId)?.label ?? "Choose a token"
        return `${chain} • ${asset}${method.isDefault ? " • Default" : ""}`
      }),
    [payload.cryptoPaymentMethods, references.chainAssets, references.chains],
  )

  useEffect(() => {
    const supabase = getSupabaseBrowserClient()

    const loadSession = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      setAuthUserId(user?.id ?? null)
      setAuthEmail(user?.email ?? null)
    }

    void loadSession()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_, session) => {
      setAuthUserId(session?.user?.id ?? null)
      setAuthEmail(session?.user?.email ?? null)
    })

    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    const fetchReferences = async () => {
      const supabase = getSupabaseBrowserClient()
      const [{ data: categories }, { data: periodicities }, { data: chains }, { data: chainAssets }, { data: intakeContracts }] = await Promise.all([
        supabase.from("ref_categories").select("id, name").order("name"),
        supabase.from("ref_payment_periodicities").select("id, name, code").order("display_order"),
        supabase.from("ref_chains").select("id, display_name, network_key").eq("is_active", true).order("display_name"),
        supabase
          .from("ref_chain_assets")
          .select("id, chain_id, symbol, name, is_native")
          .eq("is_active", true)
          .order("sort_order"),
        supabase
          .from("chain_intake_contracts")
          .select("id, chain_id, contract_address")
          .eq("collection_mode", "contract")
          .eq("is_active", true),
      ])

      const periodicityOptions =
        periodicities?.map((item) => ({
          value: String(item.id),
          label: item.name,
          code: item.code,
        })) ?? []

      setReferences({
        categories: categories?.map((item) => ({ value: String(item.id), label: item.name })) ?? [],
        paymentPeriodicities: periodicityOptions,
        chains:
          chains?.map((item) => ({
            value: String(item.id),
            label: item.display_name ?? item.network_key ?? `Chain ${item.id}`,
          })) ?? [],
        chainAssets:
          chainAssets?.map((item) => ({
            value: String(item.id),
            label: `${item.symbol} · ${item.name}`,
            chainId: String(item.chain_id),
            isNative: item.is_native ?? false,
          })) ?? [],
        intakeContracts:
          intakeContracts?.map((item) => ({
            value: String(item.id),
            label: item.contract_address,
            chainId: String(item.chain_id),
          })) ?? [],
      })

      setPayload((previous) => ({
        ...previous,
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
      setAuthEmail(state.authEmail)
      setCubidIdentityStatus(state.profile?.cubid_identity_status ?? "unlinked")
      setCubidId(state.profile?.cubid_id ?? null)
      setCubidScore(state.profile?.cubid_score ?? null)

      if (!state.authUserId) {
        setCurrentScreen("cubid")
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
            : "cubid",
        )
        setCurrentScreen("resume")
        setDraftTimestamp(state.projectDraft.updated_at || state.projectDraft.started_at)
      } else {
        setPayload((previous) => mergeProjectOnboardingPayload(previous))
        setCurrentScreen("cubid")
        setResumeTargetScreen("cubid")
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
      void invokeProjectOnboardingDraftUpsertBrowser({
        currentScreen,
        payload,
      })
        .then((result) => {
          if (!result.ok) {
            toast({
              title: "Could not save project draft",
              description: result.error.message,
              variant: "destructive",
            })
          }
        })
        .finally(() => setSaving(false))
    }, 600)

    return () => window.clearTimeout(timeoutId)
  }, [authUserId, currentScreen, payload])

  const updatePayload = (partial: Partial<ProjectOnboardingPayload>) => {
    setPayload((previous) => mergeProjectOnboardingPayload({ ...previous, ...partial }))
  }

  const handleResolveCubid = async () => {
    setResolvingCubid(true)
    const result = await invokeUserCubidResolveEmailBrowser()
    setResolvingCubid(false)

    if (!result.ok) {
      toast({
        title: "Could not link CUBID identity",
        description: result.error.message,
        variant: "destructive",
      })
      return
    }

    setCubidIdentityStatus(result.data.cubidIdentityStatus)
    setCubidId(result.data.cubidId)
    setCubidScore(result.data.cubidScore)

    toast({
      title: result.data.cubidIdentityStatus === "verified" ? "CUBID verified" : "CUBID linked",
      description:
        result.data.cubidIdentityStatus === "verified"
          ? "Your founder identity is verified with CUBID and ready for project publishing."
          : "Your founder email is now linked with CUBID. You can continue project onboarding.",
    })
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

  const upsertCryptoPaymentMethod = (methodId: string, next: Partial<ProjectCryptoPaymentMethod>) => {
    setPayload((previous) => {
      const methods = previous.cryptoPaymentMethods.map((method) => {
        if (method.id !== methodId) {
          return next.isDefault ? { ...method, isDefault: false } : method
        }

        return {
          ...method,
          ...next,
        }
      })

      return {
        ...previous,
        cryptoPaymentMethods: methods,
      }
    })
  }

  const addCryptoPaymentMethod = () => {
    setPayload((previous) => ({
      ...previous,
      cryptoPaymentMethods: [
        ...previous.cryptoPaymentMethods,
        {
          ...createEmptyProjectCryptoPaymentMethod(),
          isDefault: previous.cryptoPaymentMethods.length === 0,
        },
      ],
    }))
  }

  const removeCryptoPaymentMethod = (methodId: string) => {
    setPayload((previous) => {
      const nextMethods = previous.cryptoPaymentMethods.filter((method) => method.id !== methodId)
      return {
        ...previous,
        cryptoPaymentMethods: nextMethods.map((method, index) =>
          nextMethods.some((current) => current.isDefault) ? method : { ...method, isDefault: index === 0 },
        ),
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
      case "cubid":
        return isResolvedCubidIdentityStatus(cubidIdentityStatus)
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
            payload.billingEmail.trim() &&
            payload.paymentPeriodicityId &&
            payload.paymentPercentage.trim() &&
            payload.cryptoPaymentMethods.every(
              (method) => method.chainId && method.chainAssetId && method.intakeContractId,
            ) &&
            (payload.cryptoPaymentMethods.length === 0 || payload.cryptoPaymentMethods.some((method) => method.isDefault)),
        )
      case "review":
        return true
      default:
        return true
    }
  }

  const handleStartOver = async () => {
    setSaving(true)
    const result = await invokeProjectOnboardingDraftClearBrowser()
    setSaving(false)

    if (!result.ok) {
      toast({
        title: "Could not restart project onboarding",
        description: result.error.message,
        variant: "destructive",
      })
      return
    }

    setPayload(DEFAULT_PROJECT_ONBOARDING_PAYLOAD)
    setCurrentScreen("cubid")
    setResumeTargetScreen("cubid")
    setDraftTimestamp(null)
  }

  const handlePublish = async () => {
    if (!isResolvedCubidIdentityStatus(cubidIdentityStatus)) {
      toast({
        title: "Link CUBID before publishing",
        description: "Resolve your CUBID identity from the signed-in email before publishing a project.",
        variant: "destructive",
      })
      return
    }

    setPublishing(true)
    const result = await invokeProjectOnboardingPublishBrowser()
    setPublishing(false)

    if (!result.ok) {
      toast({
        title: "Could not publish project",
        description: result.error.message,
        variant: "destructive",
      })
      return
    }

    router.refresh()

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
          <p>
            Crypto methods: {paymentMethodSummaries.length > 0 ? paymentMethodSummaries.join(", ") : "No preferred crypto methods yet"}
          </p>
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
        currentScreen === "cubid"
          ? "Link your founder identity with CUBID"
          : currentScreen === "basics"
          ? "Start with the project essentials"
          : currentScreen === "details"
            ? "Describe what this project stands for"
            : currentScreen === "contribution"
              ? "Set the contribution and billing details"
              : "Review and publish your project"
      }
      description={
        currentScreen === "cubid"
          ? "Project publishing is tied to a real accountable person. Link the signed-in founder email to CUBID before the project can go live."
          : currentScreen === "basics"
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
      {currentScreen === "cubid" ? (
        <CubidIdentityStep
          email={authEmail}
          cubidIdentityStatus={cubidIdentityStatus}
          cubidId={cubidId}
          cubidScore={cubidScore}
          resolving={resolvingCubid}
          onResolve={() => void handleResolveCubid()}
          title="Founders need a linked CUBID identity before project publish"
          body="FundLoop treats project publishing as a payout-touching operation. We therefore require the authenticated founder or project member to resolve the signed-in email against CUBID before continuing into the project setup screens."
        />
      ) : null}

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
            <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4 text-sm text-slate-600">
              Projects can optionally configure one or more preferred crypto routes now, or skip and add them later before the first collection cycle.
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

          <div className="space-y-4 rounded-3xl border p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-medium text-slate-900">Preferred crypto payment methods</p>
                <p className="text-sm text-slate-600">
                  Supported routes are curated per chain and tagged to your project ID through the FundLoop intake contract.
                </p>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={addCryptoPaymentMethod}>
                <Plus className="mr-2 h-4 w-4" />
                Add crypto method
              </Button>
            </div>

            {payload.cryptoPaymentMethods.length === 0 ? (
              <div className="rounded-2xl border border-dashed p-4 text-sm text-slate-500">
                No crypto methods configured yet. This step is optional during onboarding.
              </div>
            ) : (
              <div className="space-y-4">
                {payload.cryptoPaymentMethods.map((method, index) => {
                  const availableAssets = references.chainAssets.filter((asset) => asset.chainId === method.chainId)
                  const defaultContract = references.intakeContracts.find((contract) => contract.chainId === method.chainId)

                  return (
                    <div key={method.id} className="space-y-4 rounded-2xl border p-4">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-medium text-slate-900">Crypto method {index + 1}</p>
                        <Button type="button" variant="ghost" size="icon" onClick={() => removeCryptoPaymentMethod(method.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>

                      <div className="grid gap-5 md:grid-cols-2">
                        <div className="space-y-2">
                          <Label>Chain</Label>
                          <Select
                            value={method.chainId}
                            onValueChange={(value) =>
                              upsertCryptoPaymentMethod(method.id, {
                                chainId: value,
                                chainAssetId: "",
                                intakeContractId:
                                  references.intakeContracts.find((contract) => contract.chainId === value)?.value ?? "",
                              })
                            }
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Choose a chain" />
                            </SelectTrigger>
                            <SelectContent>
                              {references.chains.map((chain) => (
                                <SelectItem key={chain.value} value={chain.value}>
                                  {chain.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-2">
                          <Label>Token</Label>
                          <Select
                            value={method.chainAssetId}
                            onValueChange={(value) =>
                              upsertCryptoPaymentMethod(method.id, {
                                chainAssetId: value,
                                intakeContractId: defaultContract?.value ?? method.intakeContractId,
                              })
                            }
                            disabled={!method.chainId}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Choose a token" />
                            </SelectTrigger>
                            <SelectContent>
                              {availableAssets.map((asset) => (
                                <SelectItem key={asset.value} value={asset.value}>
                                  {asset.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div className="grid gap-5 md:grid-cols-2">
                        <div className="space-y-2">
                          <Label htmlFor={`project-crypto-label-${method.id}`}>Label</Label>
                          <Input
                            id={`project-crypto-label-${method.id}`}
                            value={method.label}
                            onChange={(event) => upsertCryptoPaymentMethod(method.id, { label: event.target.value })}
                            placeholder="Base USDC default route"
                          />
                        </div>

                        <div className="space-y-2">
                          <Label>Default route</Label>
                          <Button
                            type="button"
                            variant={method.isDefault ? "default" : "outline"}
                            onClick={() => upsertCryptoPaymentMethod(method.id, { isDefault: true })}
                          >
                            {method.isDefault ? "Default route" : "Mark as default"}
                          </Button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
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
                <p>
                  Crypto methods: {paymentMethodSummaries.length > 0 ? paymentMethodSummaries.join(", ") : "None configured yet"}
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      ) : null}
    </OnboardingShell>
  )
}
