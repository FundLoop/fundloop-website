"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, ArrowRight, CheckCircle2, Search, Sparkles } from "lucide-react"
import {
  getOnboardingState,
  searchProjectsForTeamMember,
} from "@/app/actions/onboarding-actions"
import { CubidIdentityStep } from "@/components/onboarding/cubid-identity-step"
import { ExtendedCubidIdentityStep } from "@/components/onboarding/extended-cubid-identity-step"
import { invokeUserOnboardingDraftClearBrowser } from "@/lib/edge-functions/user-onboarding-draft-clear"
import { invokeUserOnboardingPublishBrowser } from "@/lib/edge-functions/user-onboarding-publish"
import { invokeUserOnboardingDraftUpsertBrowser } from "@/lib/edge-functions/user-onboarding-draft-upsert"
import { invokeUserCubidResolveEmailBrowser } from "@/lib/edge-functions/user-cubid-resolve-email"
import { invokeUserCubidSyncProfileBrowser } from "@/lib/edge-functions/user-cubid-sync-profile"
import { isResolvedCubidIdentityStatus, type CubidIdentitySnapshotSummary } from "@/lib/cubid/types"
import { getSupabaseBrowserClient } from "@/lib/supabase"
import {
  buildVisibilityFromPreset,
  DEFAULT_USER_ONBOARDING_PAYLOAD,
  type PrivacyPreset,
  type TeamMemberProjectMatch,
  type UserOnboardingPayload,
  type UserOnboardingScreen,
  mergeUserOnboardingPayload,
} from "@/lib/onboarding"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { Combobox, type ComboboxOption } from "@/components/ui/combobox"
import { Card, CardContent } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { toast } from "@/components/ui/use-toast"
import { OnboardingAuthStep } from "@/components/onboarding/onboarding-auth-step"
import { OnboardingShell } from "@/components/onboarding/onboarding-shell"
import { UserProfilePreview } from "@/components/onboarding/user-profile-preview"

type UserSignupFlowProps = {
  onClose: () => void
  inviteCode?: string
  initialRelationshipChoice?: UserOnboardingPayload["relationshipChoice"]
  onRequestFlowChange?: (flow: "user" | "project") => void
}

type ReferenceData = {
  genders: ComboboxOption[]
  interests: ComboboxOption[]
  locations: ComboboxOption[]
  occupations: ComboboxOption[]
}

function formatDraftTime(value: string | null | undefined) {
  if (!value) {
    return "recently"
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value))
}

const USER_SCREEN_ORDER: UserOnboardingScreen[] = [
  "cubid",
  "extended_identity",
  "identity",
  "visibility",
  "about",
  "relationship",
  "review",
]

export default function UserSignupFlow({
  onClose,
  inviteCode = "",
  initialRelationshipChoice = "individual",
  onRequestFlowChange,
}: UserSignupFlowProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [authUserId, setAuthUserId] = useState<string | null>(null)
  const [authEmail, setAuthEmail] = useState<string | null>(null)
  const [userStatus, setUserStatus] = useState<string | null>(null)
  const [currentScreen, setCurrentScreen] = useState<UserOnboardingScreen>("welcome")
  const [resumeTargetScreen, setResumeTargetScreen] = useState<UserOnboardingScreen>("cubid")
  const [cubidIdentityStatus, setCubidIdentityStatus] = useState<"unlinked" | "linked" | "verified">("unlinked")
  const [cubidId, setCubidId] = useState<string | null>(null)
  const [cubidScore, setCubidScore] = useState<number | null>(null)
  const [cubidSnapshot, setCubidSnapshot] = useState<CubidIdentitySnapshotSummary | null>(null)
  const [profileCompletionPercent, setProfileCompletionPercent] = useState(0)
  const [profileCompletionMissingItems, setProfileCompletionMissingItems] = useState<string[]>([])
  const [cubidPassportOrigin, setCubidPassportOrigin] = useState<string | null>(null)
  const [cubidStampPageId, setCubidStampPageId] = useState<string | null>(null)
  const [resolvingCubid, setResolvingCubid] = useState(false)
  const [syncingCubidProfile, setSyncingCubidProfile] = useState(false)
  const [payload, setPayload] = useState<UserOnboardingPayload>({
    ...DEFAULT_USER_ONBOARDING_PAYLOAD,
    inviteCode,
    relationshipChoice: initialRelationshipChoice,
  })
  const [draftTimestamp, setDraftTimestamp] = useState<string | null>(null)
  const [references, setReferences] = useState<ReferenceData>({
    genders: [],
    interests: [],
    locations: [],
    occupations: [],
  })
  const [saving, setSaving] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [projectMatches, setProjectMatches] = useState<TeamMemberProjectMatch[]>([])
  const [searchingProjects, setSearchingProjects] = useState(false)

  const autosaveReady = useRef(false)

  const selectedProject = projectMatches.find((project) => project.id === payload.selectedProjectId) ?? null

  const selectedOccupation = useMemo(
    () => references.occupations.find((option) => option.value === payload.occupationId)?.label ?? "Not set yet",
    [payload.occupationId, references.occupations],
  )
  const selectedLocation = useMemo(
    () => references.locations.find((option) => option.value === payload.locationId)?.label ?? "Not set yet",
    [payload.locationId, references.locations],
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
    } = supabase.auth.onAuthStateChange((event, session) => {
      setAuthUserId(session?.user?.id ?? null)
      setAuthEmail(session?.user?.email ?? null)
      if (event === "SIGNED_OUT") {
        setCurrentScreen("welcome")
        autosaveReady.current = false
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    const fetchReferences = async () => {
      const supabase = getSupabaseBrowserClient()

      const [{ data: genders }, { data: interests }, { data: locations }, { data: occupations }] = await Promise.all([
        supabase.from("ref_genders").select("id, name").order("display_order"),
        supabase.from("ref_interests").select("id, name").order("name"),
        supabase.from("ref_locations").select("id, name").order("name"),
        supabase.from("ref_occupations").select("id, name").order("name"),
      ])

      setReferences({
        genders: genders?.map((item) => ({ value: String(item.id), label: item.name })) ?? [],
        interests: interests?.map((item) => ({ value: String(item.id), label: item.name })) ?? [],
        locations: locations?.map((item) => ({ value: String(item.id), label: item.name })) ?? [],
        occupations: occupations?.map((item) => ({ value: String(item.id), label: item.name })) ?? [],
      })
    }

    void fetchReferences()
  }, [])

  useEffect(() => {
    const loadState = async () => {
      setLoading(true)
      const state = await getOnboardingState()

      setAuthUserId(state.authUserId)
      setAuthEmail(state.authEmail)
      setUserStatus(state.profile?.status ?? null)
      setCubidIdentityStatus(state.profile?.cubid_identity_status ?? "unlinked")
      setCubidId(state.profile?.cubid_id ?? null)
      setCubidScore(state.profile?.cubid_score ?? null)
      setCubidSnapshot(state.cubidSnapshot)
      setProfileCompletionPercent(state.profileCompletionPercent)
      setProfileCompletionMissingItems(state.profileCompletionMissingItems)
      setCubidPassportOrigin(state.cubidPassportOrigin)
      setCubidStampPageId(state.cubidStampPageId)

      if (!state.authUserId) {
        setCurrentScreen("welcome")
        setPayload({
          ...DEFAULT_USER_ONBOARDING_PAYLOAD,
          inviteCode,
          relationshipChoice: initialRelationshipChoice,
        })
        setCubidSnapshot(null)
        setProfileCompletionPercent(0)
        setProfileCompletionMissingItems([])
        autosaveReady.current = false
        setLoading(false)
        return
      }

      if (state.userDraft) {
        const draftPayload = mergeUserOnboardingPayload(state.userDraft.payload as Partial<UserOnboardingPayload>)
        setPayload({
          ...draftPayload,
          inviteCode: draftPayload.inviteCode || inviteCode,
        })
        setResumeTargetScreen(
          USER_SCREEN_ORDER.includes(state.userDraft.current_screen as UserOnboardingScreen)
            ? (state.userDraft.current_screen as UserOnboardingScreen)
            : "cubid",
        )
        setCurrentScreen("resume")
        setDraftTimestamp(state.userDraft.updated_at || state.userDraft.started_at)
      } else {
        setPayload((previous) =>
          mergeUserOnboardingPayload({
            ...previous,
            inviteCode: previous.inviteCode || inviteCode,
            relationshipChoice: previous.relationshipChoice || initialRelationshipChoice,
          }),
        )
        setCurrentScreen("welcome")
        setDraftTimestamp(null)
      }

      autosaveReady.current = true
      setLoading(false)
    }

    void loadState()
  }, [authUserId, initialRelationshipChoice, inviteCode])

  useEffect(() => {
    if (!autosaveReady.current || !authUserId) {
      return
    }
    if (currentScreen === "welcome" || currentScreen === "resume") {
      return
    }

    const timeoutId = window.setTimeout(() => {
      setSaving(true)
      void invokeUserOnboardingDraftUpsertBrowser({
        currentScreen,
        payload,
      })
        .then((result) => {
          if (!result.ok) {
            toast({
              title: "Could not save draft",
              description: result.error.message,
              variant: "destructive",
            })
          }
        })
        .finally(() => setSaving(false))
    }, 600)

    return () => window.clearTimeout(timeoutId)
  }, [authUserId, currentScreen, payload])

  useEffect(() => {
    if (payload.relationshipChoice !== "team_member" || searchQuery.trim().length < 2) {
      return
    }

    const timeoutId = window.setTimeout(() => {
      setSearchingProjects(true)
      void searchProjectsForTeamMember(searchQuery)
        .then((result) => {
          if (!result.ok) {
            toast({
              title: "Unable to search projects",
              description: result.error,
              variant: "destructive",
            })
            setProjectMatches([])
            return
          }

          setProjectMatches(result.data)
        })
        .finally(() => setSearchingProjects(false))
    }, 350)

    return () => window.clearTimeout(timeoutId)
  }, [payload.relationshipChoice, searchQuery])

  const moveToScreen = (screen: UserOnboardingScreen) => {
    setCurrentScreen(screen)
  }

  const getPreviousScreen = () => {
    const currentIndex = USER_SCREEN_ORDER.indexOf(currentScreen)
    if (currentIndex <= 0) {
      return "welcome"
    }

    return USER_SCREEN_ORDER[currentIndex - 1]
  }

  const getNextScreen = () => {
    const currentIndex = USER_SCREEN_ORDER.indexOf(currentScreen)
    return USER_SCREEN_ORDER[Math.min(currentIndex + 1, USER_SCREEN_ORDER.length - 1)]
  }

  const handleContinueFromWelcome = async () => {
    moveToScreen("cubid")
    if (!authUserId) {
      return
    }
    setSaving(true)
    const result = await invokeUserOnboardingDraftUpsertBrowser({
      currentScreen: "cubid",
      payload,
    })
    setSaving(false)

    if (!result.ok) {
      toast({
        title: "Could not start onboarding",
        description: result.error.message,
        variant: "destructive",
      })
    }
  }

  const handleResume = () => {
    moveToScreen(resumeTargetScreen)
  }

  const handleStartOver = async () => {
    setSaving(true)
    const result = await invokeUserOnboardingDraftClearBrowser()
    setSaving(false)

    if (!result.ok) {
      toast({
        title: "Could not restart onboarding",
        description: result.error.message,
        variant: "destructive",
      })
      return
    }

    setPayload({
      ...DEFAULT_USER_ONBOARDING_PAYLOAD,
      inviteCode,
      relationshipChoice: initialRelationshipChoice,
    })
    setProjectMatches([])
    setSearchQuery("")
    setCurrentScreen("welcome")
    setResumeTargetScreen("cubid")
    setDraftTimestamp(null)
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
          ? "Your email identity is verified with CUBID and ready for FundLoop publishing."
          : "Your email is now linked to CUBID. You can continue through onboarding.",
    })

    await handleSyncCubidProfile()
  }

  const handleSyncCubidProfile = async () => {
    setSyncingCubidProfile(true)
    const result = await invokeUserCubidSyncProfileBrowser()

    if (!result.ok) {
      setSyncingCubidProfile(false)
      toast({
        title: "Could not refresh CUBID data",
        description: result.error.message,
        variant: "destructive",
      })
      return
    }

    const state = await getOnboardingState()
    setSyncingCubidProfile(false)
    setCubidId(result.data.cubidId)
    setCubidScore(result.data.cubidScore)
    setCubidIdentityStatus(result.data.cubidIdentityStatus)
    setCubidSnapshot(state.cubidSnapshot)
    setProfileCompletionPercent(state.profileCompletionPercent)
    setProfileCompletionMissingItems(state.profileCompletionMissingItems)

    toast({
      title: "CUBID data refreshed",
      description: "Your latest identity snapshot is now reflected in this onboarding flow.",
    })
  }

  const updatePayload = (partial: Partial<UserOnboardingPayload>) => {
    if (partial.relationshipChoice && partial.relationshipChoice !== "team_member") {
      setProjectMatches([])
      setSearchQuery("")
    }
    setPayload((previous) => mergeUserOnboardingPayload({ ...previous, ...partial }))
  }

  const toggleInterest = (interestId: string) => {
    setPayload((previous) => {
      const interestIds = previous.interestIds.includes(interestId)
        ? previous.interestIds.filter((current) => current !== interestId)
        : [...previous.interestIds, interestId]

      return {
        ...previous,
        interestIds,
      }
    })
  }

  const setPrivacyPreset = (preset: PrivacyPreset) => {
    updatePayload({
      privacyPreset: preset,
      visibility: buildVisibilityFromPreset(preset),
    })
  }

  const setVisibilitySetting = (key: keyof UserOnboardingPayload["visibility"], value: boolean) => {
    setPayload((previous) => ({
      ...previous,
      privacyPreset: previous.privacyPreset,
      visibility: {
        ...previous.visibility,
        [key]: value,
      },
    }))
  }

  const handlePublish = async () => {
    if (!isResolvedCubidIdentityStatus(cubidIdentityStatus)) {
      toast({
        title: "Link CUBID before publishing",
        description: "Resolve your CUBID identity from the signed-in email before publishing your profile.",
        variant: "destructive",
      })
      return
    }

    setPublishing(true)
    const result = await invokeUserOnboardingPublishBrowser()
    setPublishing(false)

    if (!result.ok) {
      toast({
        title: "Could not publish profile",
        description: result.error.message,
        variant: "destructive",
      })
      return
    }

    router.refresh()

    toast({
      title: "Profile published",
      description:
        result.data.nextFlow === "project"
          ? "Your personal profile is live. Next up: your project draft."
          : "Your FundLoop profile is now live.",
    })

    if (result.data.nextFlow === "project") {
      onRequestFlowChange?.("project")
      return
    }

    onClose()
  }

  const canContinue = () => {
    switch (currentScreen) {
      case "cubid":
        return isResolvedCubidIdentityStatus(cubidIdentityStatus)
      case "extended_identity":
        return true
      case "identity":
        return Boolean(payload.fullName.trim() && payload.profileHeadline.trim())
      case "visibility":
        return true
      case "about":
        return Boolean(payload.bio.trim() && payload.locationId && payload.occupationId)
      case "relationship":
        if (payload.relationshipChoice === "team_member") {
          return Boolean(payload.selectedProjectId)
        }
        return true
      case "review":
        return true
      default:
        return true
    }
  }

  const preview = (
    <div className="space-y-4">
      <UserProfilePreview payload={payload} />
      <Card className="border-dashed">
        <CardContent className="space-y-2 p-4 text-sm text-slate-600">
          <p className="font-medium text-slate-900">Current visibility</p>
          <div className="flex flex-wrap gap-2">
            <Badge variant={payload.visibility.isNamePublic ? "default" : "outline"}>Name</Badge>
            <Badge variant={payload.visibility.isPfpPublic ? "default" : "outline"}>Photo</Badge>
            <Badge variant={payload.visibility.isOccupationPublic ? "default" : "outline"}>Occupation</Badge>
            <Badge variant={payload.visibility.isLocationPublic ? "default" : "outline"}>Location</Badge>
            <Badge variant={payload.visibility.isGenderPublic ? "default" : "outline"}>Gender</Badge>
          </div>
          <Separator />
          <p>Occupation: {selectedOccupation}</p>
          <p>Location: {selectedLocation}</p>
        </CardContent>
      </Card>
    </div>
  )

  if (loading) {
    return <div className="p-10 text-sm text-muted-foreground">Loading your onboarding flow...</div>
  }

  if (!authUserId) {
    return (
      <OnboardingShell
        eyebrow="Step 1"
        title="Get started with FundLoop"
        description="Create an account or sign in to save your onboarding draft and continue from any device."
        compact
      >
        <OnboardingAuthStep
          title="Welcome to FundLoop"
          description="We’ll guide you through a short profile flow, save every step, and pick up exactly where you left off."
          onAuthenticated={() => setAuthUserId("pending")}
        />
      </OnboardingShell>
    )
  }

  if (currentScreen === "welcome") {
    return (
      <OnboardingShell
        eyebrow="Welcome"
        title="A better start for new FundLoop members"
        description="This onboarding builds your profile screen by screen, saves your draft as you go, and keeps it hidden until you publish."
        compact
        footer={
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-500">{saving ? "Saving draft..." : "Your draft will save automatically."}</p>
            <Button onClick={() => void handleContinueFromWelcome()} className="gap-2">
              Continue
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        }
      >
        <div className="grid gap-4 md:grid-cols-3">
          {[
            "Learn what FundLoop is about",
            "Build your profile with a live preview",
            "Choose whether to join a team or create a project",
          ].map((item) => (
            <Card key={item} className="border-slate-200/80">
              <CardContent className="flex items-start gap-3 p-4 text-sm text-slate-600">
                <Sparkles className="mt-0.5 h-4 w-4 text-emerald-600" />
                <span>{item}</span>
              </CardContent>
            </Card>
          ))}
        </div>
      </OnboardingShell>
    )
  }

  if (currentScreen === "resume") {
    return (
      <OnboardingShell
        eyebrow="Resume"
        title="You already have a draft profile"
        description={`It looks like you have a draft profile created from ${formatDraftTime(
          draftTimestamp,
        )}. Let’s continue where you left off last.`}
        compact
        footer={
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Button variant="outline" onClick={() => void handleStartOver()} disabled={saving}>
              Start over
            </Button>
            <Button onClick={handleResume} className="gap-2">
              Continue draft
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        }
      >
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4 text-sm text-emerald-900">
          Your profile is still hidden from the rest of FundLoop until you publish it.
        </div>
      </OnboardingShell>
    )
  }

  return (
    <OnboardingShell
      eyebrow={`Profile setup • ${USER_SCREEN_ORDER.indexOf(currentScreen) + 1}/${USER_SCREEN_ORDER.length}`}
      title={
        currentScreen === "cubid"
          ? "Link your identity with CUBID"
          : currentScreen === "extended_identity"
            ? "Optionally strengthen your profile signals"
          : currentScreen === "identity"
          ? "Start with who you are"
          : currentScreen === "visibility"
            ? "Choose how public you want to be"
            : currentScreen === "about"
              ? "Tell FundLoop about yourself"
              : currentScreen === "relationship"
                ? "How are you joining the ecosystem?"
                : "Review and publish your profile"
      }
      description={
        currentScreen === "cubid"
          ? "Before your profile can go live, FundLoop needs to resolve the signed-in email against CUBID and keep that identity link on file."
          : currentScreen === "extended_identity"
            ? "This step is optional. Add a phone number or provider stamps now, or skip ahead and come back from your workspace later."
          : currentScreen === "identity"
          ? "Add your name, role, and profile picture so the preview starts feeling real."
          : currentScreen === "visibility"
            ? "Set a simple privacy preset, then fine-tune the fields that should stay public."
            : currentScreen === "about"
              ? "These details help FundLoop match you to the right projects and context."
              : currentScreen === "relationship"
                ? "Choose whether you’re joining as an individual, looking for an existing team, or planning to create your own project."
                : "Check your live preview, then publish your profile when it feels right."
      }
      preview={preview}
      footer={
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm text-slate-500">{saving ? "Saving your draft..." : "Every step is saved automatically."}</div>
          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={() => moveToScreen(getPreviousScreen())}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
            {currentScreen === "review" ? (
              <Button onClick={() => void handlePublish()} disabled={publishing} className="gap-2">
                <CheckCircle2 className="h-4 w-4" />
                {publishing ? "Publishing..." : "Publish profile"}
              </Button>
            ) : (
              <Button onClick={() => moveToScreen(getNextScreen())} disabled={!canContinue()} className="gap-2">
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
          title="CUBID becomes the identity bridge for FundLoop publishing"
          body="We use your signed-in email to resolve or create the matching CUBID user. Publishing is blocked until that link exists, because later payout and accountability flows depend on it."
        />
      ) : null}

      {currentScreen === "extended_identity" ? (
        <ExtendedCubidIdentityStep
          email={authEmail}
          cubidId={cubidId}
          cubidIdentityStatus={cubidIdentityStatus}
          cubidSnapshot={cubidSnapshot}
          profileCompletionPercent={profileCompletionPercent}
          profileCompletionMissingItems={profileCompletionMissingItems}
          cubidPassportOrigin={cubidPassportOrigin}
          cubidStampPageId={cubidStampPageId}
          syncing={syncingCubidProfile}
          onRefresh={() => void handleSyncCubidProfile()}
          onSkip={() => moveToScreen("identity")}
        />
      ) : null}

      {currentScreen === "identity" ? (
        <div className="grid gap-5">
          {inviteCode ? (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 px-4 py-3 text-sm text-emerald-900">
              You were invited to join FundLoop with code <span className="font-mono font-semibold">{inviteCode}</span>.
            </div>
          ) : null}

          <div className="grid gap-5 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="onboarding-full-name">Full name</Label>
              <Input
                id="onboarding-full-name"
                value={payload.fullName}
                onChange={(event) => updatePayload({ fullName: event.target.value, displayName: event.target.value })}
                placeholder="Your name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="onboarding-role">Profile headline</Label>
              <Input
                id="onboarding-role"
                value={payload.profileHeadline}
                onChange={(event) => updatePayload({ profileHeadline: event.target.value })}
                placeholder="Builder, founder, designer, researcher..."
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="onboarding-avatar">Profile picture URL</Label>
            <Input
              id="onboarding-avatar"
              value={payload.avatarUrl}
              onChange={(event) => updatePayload({ avatarUrl: event.target.value })}
              placeholder="https://..."
            />
          </div>
        </div>
      ) : null}

      {currentScreen === "visibility" ? (
        <div className="space-y-6">
          <div className="space-y-3">
            <Label>Privacy preset</Label>
            <RadioGroup
              value={payload.privacyPreset}
              onValueChange={(value) => setPrivacyPreset(value as PrivacyPreset)}
              className="grid gap-3"
            >
              {[
                {
                  value: "public",
                  label: "Public profile",
                  description: "Show your profile and key details broadly across FundLoop.",
                },
                {
                  value: "limited",
                  label: "Limited profile",
                  description: "Stay discoverable, but keep sensitive fields private by default.",
                },
                {
                  value: "private",
                  label: "Private draft",
                  description: "Hide your profile and all fields until you decide otherwise.",
                },
              ].map((option) => (
                <label key={option.value} className="flex items-start gap-3 rounded-2xl border p-4">
                  <RadioGroupItem value={option.value} id={`privacy-${option.value}`} />
                  <div className="space-y-1">
                    <p className="font-medium text-slate-900">{option.label}</p>
                    <p className="text-sm text-slate-600">{option.description}</p>
                  </div>
                </label>
              ))}
            </RadioGroup>
          </div>

          <Separator />

          <div className="grid gap-3 md:grid-cols-2">
            {[
              ["isNamePublic", "Show my name"],
              ["isPfpPublic", "Show my profile picture"],
              ["isOccupationPublic", "Show my occupation"],
              ["isLocationPublic", "Show my location"],
              ["isGenderPublic", "Show my gender"],
            ].map(([key, label]) => (
              <div key={key} className="flex items-center justify-between rounded-2xl border px-4 py-3">
                <span className="text-sm font-medium text-slate-900">{label}</span>
                <Switch
                  checked={payload.visibility[key as keyof UserOnboardingPayload["visibility"]]}
                  onCheckedChange={(checked) =>
                    setVisibilitySetting(key as keyof UserOnboardingPayload["visibility"], checked)
                  }
                />
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {currentScreen === "about" ? (
        <div className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="onboarding-bio">Short bio</Label>
            <Textarea
              id="onboarding-bio"
              rows={5}
              value={payload.bio}
              onChange={(event) => updatePayload({ bio: event.target.value })}
              placeholder="What do you care about, and what kind of work or contribution defines you?"
            />
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Location</Label>
              <Combobox
                options={references.locations}
                value={payload.locationId}
                onChange={(value) => updatePayload({ locationId: value })}
                placeholder="Choose your location"
                emptyMessage="No matching locations"
              />
            </div>
            <div className="space-y-2">
              <Label>Occupation</Label>
              <Combobox
                options={references.occupations}
                value={payload.occupationId}
                onChange={(value) => updatePayload({ occupationId: value })}
                placeholder="Choose your occupation"
                emptyMessage="No matching occupations"
              />
            </div>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Gender</Label>
              <Combobox
                options={references.genders}
                value={payload.genderId}
                onChange={(value) => updatePayload({ genderId: value })}
                placeholder="Choose a gender"
                emptyMessage="No matching options"
              />
            </div>
            <div className="space-y-2">
              <Label>Interests</Label>
              <div className="flex max-h-48 flex-wrap gap-2 overflow-y-auto rounded-2xl border p-3">
                {references.interests.map((interest) => {
                  const active = payload.interestIds.includes(interest.value)
                  return (
                    <Button
                      key={interest.value}
                      type="button"
                      variant={active ? "default" : "outline"}
                      size="sm"
                      onClick={() => toggleInterest(interest.value)}
                    >
                      {interest.label}
                    </Button>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {currentScreen === "relationship" ? (
        <div className="space-y-6">
          <RadioGroup
            value={payload.relationshipChoice}
            onValueChange={(value) =>
              updatePayload({
                relationshipChoice: value as UserOnboardingPayload["relationshipChoice"],
                selectedProjectId: null,
              })
            }
            className="grid gap-3"
          >
            {[
              {
                value: "individual",
                title: "I’m joining as an individual",
                description: "I want a FundLoop profile first and can decide on projects later.",
              },
              {
                value: "team_member",
                title: "I’m already on a project team",
                description: "Help me find the project and tell me who to ask for an invite.",
              },
              {
                value: "create_project",
                title: "I want to create a new project",
                description: "Publish my personal profile, then continue straight into project onboarding.",
              },
            ].map((option) => (
              <label key={option.value} className="flex items-start gap-3 rounded-2xl border p-4">
                <RadioGroupItem value={option.value} id={`relationship-${option.value}`} />
                <div className="space-y-1">
                  <p className="font-medium text-slate-900">{option.title}</p>
                  <p className="text-sm text-slate-600">{option.description}</p>
                </div>
              </label>
            ))}
          </RadioGroup>

          {payload.relationshipChoice === "team_member" ? (
            <div className="space-y-4 rounded-3xl border border-slate-200 p-5">
              <div className="space-y-2">
                <Label htmlFor="project-search">Search for your project</Label>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
                  <Input
                    id="project-search"
                    className="pl-9"
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    placeholder="Search by project name or slug"
                  />
                </div>
              </div>

              {searchingProjects ? <p className="text-sm text-slate-500">Searching active projects...</p> : null}

              <div className="space-y-3">
                {projectMatches.map((project) => {
                  const active = payload.selectedProjectId === project.id
                  return (
                    <button
                      key={project.id}
                      type="button"
                      className={`w-full rounded-2xl border p-4 text-left transition ${
                        active ? "border-emerald-500 bg-emerald-50" : "border-slate-200 hover:border-slate-300"
                      }`}
                      onClick={() => updatePayload({ selectedProjectId: project.id })}
                    >
                      <div className="space-y-1">
                        <div className="flex items-center justify-between gap-3">
                          <p className="font-medium text-slate-900">{project.name}</p>
                          {active ? <Badge>Selected</Badge> : null}
                        </div>
                        <p className="text-sm text-slate-600">{project.description}</p>
                        {project.contacts.length > 0 ? (
                          <div className="pt-2 text-sm text-slate-700">
                            <p className="font-medium">Who to ask for an invite</p>
                            <ul className="mt-1 space-y-1">
                              {project.contacts.map((contact) => (
                                <li key={`${project.id}-${contact.name}-${contact.role}`}>
                                  {contact.name} · {contact.role}
                                  {contact.email ? ` · ${contact.email}` : ""}
                                </li>
                              ))}
                            </ul>
                          </div>
                        ) : (
                          <p className="pt-2 text-sm text-slate-700">{project.fallbackMessage}</p>
                        )}
                      </div>
                    </button>
                  )
                })}
              </div>

              <Button type="button" variant="outline" onClick={() => updatePayload({ relationshipChoice: "create_project" })}>
                I can’t find it. Help me create my own project instead.
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}

      {currentScreen === "review" ? (
        <div className="space-y-6">
          <div className="rounded-3xl border border-emerald-200 bg-emerald-50/70 p-5">
            <h3 className="font-semibold text-emerald-950">Ready to publish</h3>
            <p className="mt-2 text-sm text-emerald-900">
              Your draft is still private. Publishing will make your profile active inside FundLoop with the visibility settings shown in the preview.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardContent className="space-y-2 p-4 text-sm text-slate-600">
                <p className="font-medium text-slate-900">Profile summary</p>
                <p>Name: {payload.fullName || "Not set"}</p>
                <p>Headline: {payload.profileHeadline || "Not set"}</p>
                <p>Location: {selectedLocation}</p>
                <p>Occupation: {selectedOccupation}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="space-y-2 p-4 text-sm text-slate-600">
                <p className="font-medium text-slate-900">Next step after publish</p>
                <p>
                  {payload.relationshipChoice === "create_project"
                    ? "You’ll continue directly into the project onboarding flow."
                    : payload.relationshipChoice === "team_member"
                      ? "You’ll be able to use the project contact guidance you selected."
                      : "Your personal profile will be live and ready to use."}
                </p>
                {selectedProject ? <p>Selected project: {selectedProject.name}</p> : null}
              </CardContent>
            </Card>
            <Card>
              <CardContent className="space-y-2 p-4 text-sm text-slate-600">
                <p className="font-medium text-slate-900">Profile completion today</p>
                <p>{profileCompletionPercent}% complete across local profile data and CUBID-backed trust items.</p>
                {profileCompletionMissingItems.length > 0 ? (
                  <p>Still missing: {profileCompletionMissingItems.join(", ")}</p>
                ) : (
                  <p>All Session 14 completion items are already covered.</p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      ) : null}
    </OnboardingShell>
  )
}
