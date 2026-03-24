"use client"

import { useEffect, useState } from "react"
import { usePathname, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "@/components/ui/use-toast"
import { getSupabaseBrowserClient } from "@/lib/supabase"
import { buildUrl } from "@/lib/url"

export default function JoinPage() {
  const pathname = usePathname()
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [inviterName, setInviterName] = useState<string | null>(null)
  const [inviteCode, setInviteCode] = useState<string | null>(null)
  const [inviteReady, setInviteReady] = useState(false)

  useEffect(() => {
    const nextInviteCode = new URLSearchParams(window.location.search).get("invite")
    setInviteCode(nextInviteCode)
    setInviteReady(true)
  }, [])

  useEffect(() => {
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

        if (error) {
          throw error
        }

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

    if (!inviteReady) {
      return
    }

    void validateInviteCode()
  }, [inviteCode, inviteReady, router])

  const openOnboarding = () => {
    const nextParams = new URLSearchParams(window.location.search)
    nextParams.set("onboarding", "user")
    router.push(buildUrl(pathname, nextParams), { scroll: false })
  }

  if (loading) {
    return (
      <div className="container mx-auto flex justify-center px-4 py-24">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle>Validating invitation</CardTitle>
            <CardDescription>Please wait while FundLoop validates your invitation code.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 py-4">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-10 w-full" />
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto flex justify-center px-4 py-24">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle>Join FundLoop</CardTitle>
          <CardDescription>
            {inviterName ? `You've been invited by ${inviterName} to join FundLoop.` : "You've been invited to join FundLoop."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 py-6 text-center">
          <p>
            FundLoop helps projects and people build regenerative economic loops. Your invitation code is preloaded, and
            your onboarding draft will save as you go.
          </p>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Invitation code: <span className="font-mono font-medium">{inviteCode}</span>
          </p>
        </CardContent>
        <CardFooter>
          <Button className="w-full bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-700 hover:to-cyan-700" onClick={openOnboarding}>
            Continue onboarding
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}
