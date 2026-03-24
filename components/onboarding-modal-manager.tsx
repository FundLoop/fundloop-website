"use client"

import { useEffect, useMemo, useState } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { getSupabaseBrowserClient } from "@/lib/supabase"
import { Modal } from "@/components/modal"
import UserSignupFlow from "@/components/user-signup-flow"
import ProjectSignupFlow from "@/components/project-signup-flow"

function buildUrl(pathname: string, searchParams: URLSearchParams) {
  const query = searchParams.toString()
  return query ? `${pathname}?${query}` : pathname
}

export function OnboardingModalManager() {
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()
  const onboardingFlow = searchParams.get("onboarding")
  const inviteCode = searchParams.get("invite") ?? ""

  const [authUserId, setAuthUserId] = useState<string | null>(null)
  const [profileStatus, setProfileStatus] = useState<string | null>(null)

  const dismissalKey = authUserId ? `fundloop-onboarding-dismissed:${authUserId}` : null

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
  }, [authUserId])

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
