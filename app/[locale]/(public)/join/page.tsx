"use client"

import { useEffect, useState } from "react"
import { usePathname, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "@/components/ui/use-toast"
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase"
import { buildUrl } from "@/lib/url"
import { MarketingPage, MarketingSection, SectionBody, SectionEyebrow, SectionTitle } from "@/components/marketing/page-chrome"
import { Reveal } from "@/components/marketing/reveal"

export default function JoinPage() {
  const pathname = usePathname()
  const router = useRouter()
  const supabaseConfigured = isSupabaseConfigured()

  const [loading, setLoading] = useState(supabaseConfigured)
  const [inviterName, setInviterName] = useState<string | null>(null)
  const [inviteCode, setInviteCode] = useState<string | null>(null)
  const [inviteReady, setInviteReady] = useState(false)

  useEffect(() => {
    const nextInviteCode = new URLSearchParams(window.location.search).get("invite")
    setInviteCode(nextInviteCode)
    setInviteReady(true)
  }, [])

  useEffect(() => {
    if (!supabaseConfigured) {
      return
    }

    const validateInviteCode = async () => {
      const supabase = getSupabaseBrowserClient()

      if (!inviteCode) {
        router.push("/")
        return
      }

      setLoading(true)

      try {
        const { data, error } = await supabase
          .from("invitation_codes")
          .select("code, created_by, max_uses, usage_count, expires_at")
          .eq("code", inviteCode)
          .single()

        if (error) throw error
        if (data.expires_at && new Date(data.expires_at) < new Date()) {
          throw new Error("This invitation code has expired.")
        }
        if (data.max_uses && data.usage_count >= data.max_uses) {
          throw new Error("This invitation code has reached its maximum number of uses.")
        }

        if (data.created_by) {
          const { data: userData } = await supabase.from("users").select("full_name").eq("user_id", data.created_by).single()
          setInviterName(userData?.full_name ?? null)
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "The invitation code is invalid or has expired."
        toast({
          title: "Invalid invitation code",
          description: message,
          variant: "destructive",
        })
        router.push("/")
      } finally {
        setLoading(false)
      }
    }

    if (!inviteReady) return
    void validateInviteCode()
  }, [inviteCode, inviteReady, router, supabaseConfigured])

  const openOnboarding = () => {
    const nextParams = new URLSearchParams(window.location.search)
    nextParams.set("onboarding", "user")
    router.push(buildUrl(pathname, nextParams), { scroll: false })
  }

  return (
    <MarketingPage>
      <MarketingSection className="flex min-h-[calc(100svh-5.5rem)] items-center pb-20 pt-16">
        <div className="mx-auto max-w-4xl">
          {loading ? (
            <Reveal>
              <div className="rounded-[2rem] border border-[color:var(--marketing-line)] bg-white/58 p-8 shadow-[0_24px_70px_rgba(15,23,23,0.08)] dark:bg-white/[0.03] sm:p-10">
                <SectionEyebrow>Invitation</SectionEyebrow>
                <SectionTitle className="mt-4 text-5xl sm:text-6xl">Validating your invitation.</SectionTitle>
                <div className="mt-8 space-y-4">
                  <Skeleton className="h-5 w-40" />
                  <Skeleton className="h-5 w-72" />
                  <Skeleton className="h-12 w-full rounded-full" />
                </div>
              </div>
            </Reveal>
          ) : !supabaseConfigured ? (
            <Reveal>
              <div className="rounded-[2rem] border border-[color:var(--marketing-line)] bg-white/58 p-8 shadow-[0_24px_70px_rgba(15,23,23,0.08)] dark:bg-white/[0.03] sm:p-10">
                <SectionEyebrow>Invitation</SectionEyebrow>
                <SectionTitle className="mt-4 text-5xl sm:text-6xl">Invitations need a configured backend.</SectionTitle>
                <SectionBody className="mt-6 max-w-2xl">
                  Configure Supabase environment variables to validate invitation codes and continue onboarding locally.
                </SectionBody>
              </div>
            </Reveal>
          ) : (
            <Reveal>
              <div className="rounded-[2rem] border border-[color:var(--marketing-line)] bg-[linear-gradient(135deg,rgba(255,248,238,0.84),rgba(244,203,141,0.2))] p-8 shadow-[0_24px_70px_rgba(15,23,23,0.08)] dark:bg-[linear-gradient(135deg,rgba(18,27,25,0.94),rgba(239,139,87,0.12))] sm:p-10">
                <SectionEyebrow>Invitation accepted</SectionEyebrow>
                <SectionTitle className="mt-4 max-w-3xl text-5xl sm:text-6xl">Join FundLoop and pick up where the loop is forming.</SectionTitle>
                <SectionBody className="mt-6 max-w-2xl">
                  {inviterName
                    ? `${inviterName} invited you into FundLoop.`
                    : "You've been invited into FundLoop."} Your invitation code is preloaded, and your onboarding draft will save as you go.
                </SectionBody>
                <div className="mt-8 rounded-[1.5rem] border border-[color:var(--marketing-line)] bg-white/58 p-5 dark:bg-white/[0.04]">
                  <p className="text-[0.68rem] font-semibold uppercase tracking-[0.28em] text-[var(--marketing-muted)]">
                    Invitation code
                  </p>
                  <p className="mt-3 font-mono text-xl">{inviteCode}</p>
                </div>
                <Button
                  size="lg"
                  className="mt-8 rounded-full bg-[var(--marketing-accent)] px-7 text-white hover:bg-[color:var(--marketing-accent)]/92"
                  onClick={openOnboarding}
                >
                  Continue onboarding
                </Button>
              </div>
            </Reveal>
          )}
        </div>
      </MarketingSection>
    </MarketingPage>
  )
}
