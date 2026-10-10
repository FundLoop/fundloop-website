"use client"

import { useEffect, useRef } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { toast } from "@/components/ui/use-toast"

// Says what happened after a Cubid round trip (#275, stage 2c UI).
//
// The callback redirects with `?cubid=<outcome>` rather than rendering, because a person coming
// back from an identity provider should land on a page. This turns that parameter into one message
// and then removes it from the URL, so a refresh or a shared link does not repeat it.
//
// The vocabulary is closed and the copy lives here: the callback sends short codes precisely so the
// reason is never a free-text string from a verifier, and so nothing an issuer or an attacker can
// influence reaches the screen.
const MESSAGES: Record<string, { title: string; description: string; variant?: "destructive" }> = {
  "signed-in": { title: "Signed in with Cubid", description: "Welcome back." },
  linked: { title: "Cubid connected", description: "Your Cubid passkey can now sign you in to FundLoop." },
  "already-linked": { title: "Already connected", description: "This Cubid identity is already on your account." },
  "email-taken": {
    title: "That address already has a FundLoop account",
    description:
      "Sign in with your email address, then connect Cubid from your account settings. We will not merge the two for you.",
    variant: "destructive",
  },
  "no-email": {
    title: "Your Cubid account has no verified email address",
    description:
      "FundLoop needs one to create your account. Sign in with your email instead, then connect Cubid from your account settings.",
    variant: "destructive",
  },
  conflict: {
    title: "That Cubid identity is connected elsewhere",
    description: "It already belongs to another FundLoop account, and one identity cannot be on two.",
    variant: "destructive",
  },
  "session-changed": {
    title: "Connection not completed",
    description: "You were signed in to a different account when you came back. Start again from your settings.",
    variant: "destructive",
  },
  declined: { title: "Sign-in cancelled", description: "Nothing changed on your account." },
  expired: { title: "That sign-in request expired", description: "Please start again.", variant: "destructive" },
  "not-signed-in": {
    title: "Sign in first",
    description: "Connecting Cubid needs you to be signed in to the account you are connecting it to.",
    variant: "destructive",
  },
  unavailable: {
    title: "Sign in with Cubid is unavailable",
    description: "It is not configured on this deployment yet. Please use your email address.",
    variant: "destructive",
  },
  refused: {
    title: "Sign in with Cubid did not complete",
    description: "Nothing changed on your account. Please try again, or use your email address.",
    variant: "destructive",
  },
}

export function CubidOutcomeNotice() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const shown = useRef<string | null>(null)
  const outcome = searchParams.get("cubid")

  useEffect(() => {
    if (!outcome || shown.current === outcome) return
    shown.current = outcome
    const message = MESSAGES[outcome] ?? MESSAGES.refused
    toast({ title: message.title, description: message.description, variant: message.variant })

    // Drop the parameter so the message does not come back on a refresh, and so a link somebody
    // shares does not carry somebody else's sign-in outcome.
    const remaining = new URLSearchParams(searchParams)
    remaining.delete("cubid")
    const query = remaining.toString()
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
  }, [outcome, pathname, router, searchParams])

  return null
}
