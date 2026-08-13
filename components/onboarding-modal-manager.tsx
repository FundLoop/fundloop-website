"use client"

import { useEffect, useMemo, useState } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase"
import { Modal } from "@/components/modal"
import { Button } from "@/components/ui/button"
import UserSignupFlow from "@/components/user-signup-flow"
import ProjectSignupFlow from "@/components/project-signup-flow"
import { buildUrl } from "@/lib/url"

export function OnboardingModalManager() {
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()
  const onboardingFlow = searchParams.get("onboarding")
  const inviteCode = searchParams.get("invite") ?? ""
  const supabaseConfigured = isSupabaseConfigured()

  const [authUserId, setAuthUserId] = useState<string | null>(null)
  const [profileStatus, setProfileStatus] = useState<string | null>(null)

  const dismissalKey = authUserId ? `fundloop-onboarding-dismissed:${authUserId}` : null

  useEffect(() => {
    if (!supabaseConfigured) {
      return
    }

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
  }, [supabaseConfigured])

  useEffect(() => {
    if (!supabaseConfigured) {
      return
    }

    const fetchStatus = async () => {
      if (!authUserId) {
        setProfileStatus(null)
        return
      }

      const supabase = getSupabaseBrowserClient()
      const { data } = await supabase.from("users").select("status").eq("user_id", authUserId).single()
      setProfileStatus(data?.status ?? null)
    }

    void fetchStatus()
  }, [authUserId, onboardingFlow, supabaseConfigured])

  useEffect(() => {
    if (!authUserId || profileStatus !== "inactive" || onboardingFlow) {
      return
    }
    if (dismissalKey && sessionStorage.getItem(dismissalKey)) {
      return
    }

    const nextParams = new URLSearchParams(searchParams.toString())
    nextParams.set("onboarding", "user")
    router.replace(buildUrl(pathname, nextParams), { scroll: false })
  }, [authUserId, dismissalKey, onboardingFlow, pathname, profileStatus, router, searchParams])

  useEffect(() => {
    if (profileStatus === "active" && dismissalKey) {
      sessionStorage.removeItem(dismissalKey)
    }
  }, [dismissalKey, profileStatus])

  const effectiveFlow = useMemo(() => {
    if (onboardingFlow === "project" && profileStatus === "active") {
      return "project"
    }
    if (onboardingFlow === "project") {
      return "user"
    }
    return onboardingFlow === "user" ? "user" : null
  }, [onboardingFlow, profileStatus])

  const closeModal = () => {
    if (dismissalKey && profileStatus === "inactive") {
      sessionStorage.setItem(dismissalKey, "1")
    }

    const nextParams = new URLSearchParams(searchParams.toString())
    nextParams.delete("onboarding")
    router.replace(buildUrl(pathname, nextParams), { scroll: false })
  }

  const requestFlowChange = (flow: "user" | "project") => {
    const nextParams = new URLSearchParams(searchParams.toString())
    nextParams.set("onboarding", flow)
    if (dismissalKey) {
      sessionStorage.removeItem(dismissalKey)
    }
    router.replace(buildUrl(pathname, nextParams), { scroll: false })
  }

  if (!effectiveFlow) {
    return null
  }

  if (!supabaseConfigured) {
    return (
      <Modal
        title="FundLoop onboarding"
        description="Open onboarding links are working, but this local environment is missing the backend configuration needed to continue."
        isOpen
        onClose={closeModal}
        size="lg"
        contentClassName="bg-slate-50 p-0"
      >
        <div className="space-y-5 p-4 sm:p-6">
          <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm sm:p-8">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-emerald-600">
              {onboardingFlow === "project" ? "Project onboarding" : "User onboarding"}
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
              Backend setup is required to continue this flow locally.
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
              FundLoop needs Supabase environment variables before authentication, draft saving, and onboarding state can
              work. The query param is being handled correctly; the local checkout just cannot continue the flow yet.
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Button onClick={closeModal}>Close</Button>
              <Button variant="outline" onClick={() => requestFlowChange(onboardingFlow === "project" ? "user" : "project")}>
                Switch to {onboardingFlow === "project" ? "user" : "project"} flow
              </Button>
            </div>
          </div>
        </div>
      </Modal>
    )
  }

  return (
    <Modal
      title="FundLoop onboarding"
      description="Create or continue your FundLoop profile and project onboarding flow."
      isOpen
      onClose={closeModal}
      size="full"
      contentClassName="bg-slate-50 p-0"
    >
      <div className="max-h-[88vh] overflow-y-auto p-4 sm:p-6">
        {effectiveFlow === "user" ? (
          <UserSignupFlow
            onClose={closeModal}
            inviteCode={inviteCode}
            initialRelationshipChoice={onboardingFlow === "project" ? "create_project" : "individual"}
            onRequestFlowChange={requestFlowChange}
          />
        ) : (
          <ProjectSignupFlow onClose={closeModal} />
        )}
      </div>
    </Modal>
  )
}
