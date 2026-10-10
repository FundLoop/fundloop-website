"use client"

import { useEffect, useState } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { X } from "lucide-react"

// Says what happened after a Cubid round trip (#275, stage 2c UI).
//
// The callback redirects with `?cubid=<outcome>` rather than rendering, because a person coming
// back from an identity provider should land on a page. This turns that parameter into one notice
// and removes it from the URL, so a refresh or a shared link does not repeat it.
//
// It renders the notice itself rather than dispatching a toast. The application's toast store and
// its renderer are not wired together — a separate fix — and an outcome a person never sees is
// worse than no outcome at all. A sign-in result is also worth keeping on screen until it is
// dismissed, which a toast would not do.
//
// The vocabulary is closed and the copy lives here: the callback sends short codes precisely so the
// reason is never a free-text string from a verifier, and so nothing an issuer or an attacker can
// influence reaches the screen. An unknown code falls back to a generic refusal.
const MESSAGES: Record<string, { title: string; description: string; tone: "good" | "bad" }> = {
  "signed-in": { title: "Signed in with Cubid", description: "Welcome back.", tone: "good" },
  linked: {
    title: "Cubid connected",
    description: "Your Cubid passkey can now sign you in to FundLoop.",
    tone: "good",
  },
  "already-linked": {
    title: "Already connected",
    description: "This Cubid identity is already on your account.",
    tone: "good",
  },
  "email-taken": {
    title: "That address already has a FundLoop account",
    description:
      "Sign in with your email address, then connect Cubid from your account settings. We will not merge the two for you.",
    tone: "bad",
  },
  "no-email": {
    title: "Your Cubid account has no verified email address",
    description:
      "FundLoop needs one to create your account. Sign in with your email instead, then connect Cubid from your account settings.",
    tone: "bad",
  },
  conflict: {
    title: "That Cubid identity is connected elsewhere",
    description: "It already belongs to another FundLoop account, and one identity cannot be on two.",
    tone: "bad",
  },
  "session-changed": {
    title: "Connection not completed",
    description: "You were signed in to a different account when you came back. Start again from your settings.",
    tone: "bad",
  },
  declined: { title: "Sign-in cancelled", description: "Nothing changed on your account.", tone: "good" },
  expired: { title: "That sign-in request expired", description: "Please start again.", tone: "bad" },
  "not-signed-in": {
    title: "Sign in first",
    description: "Connecting Cubid needs you to be signed in to the account you are connecting it to.",
    tone: "bad",
  },
  unavailable: {
    title: "Sign in with Cubid is unavailable",
    description: "It is not configured on this deployment yet. Please use your email address.",
    tone: "bad",
  },
  refused: {
    title: "Sign in with Cubid did not complete",
    description: "Nothing changed on your account. Please try again, or use your email address.",
    tone: "bad",
  },
}

export function CubidOutcomeNotice() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const outcome = searchParams.get("cubid")
  // Captured on the first render rather than written from the effect, which would both trip the
  // cascading-render rule and re-raise a notice the person had dismissed whenever an effect
  // dependency changed identity — `useRouter()` returns a fresh object every render, for one.
  //
  // The callback redirects with a 303, so this component mounts on a fresh document with the
  // parameter already present. It is deliberately not written to handle the parameter appearing
  // during a soft navigation, because nothing in this flow does that.
  const [shown, setShown] = useState<string | null>(() => outcome)

  useEffect(() => {
    if (!outcome) return
    // Drop the parameter so the notice does not come back on a refresh, and so a link somebody
    // shares does not carry somebody else's sign-in outcome. The captured value above is what keeps
    // the notice on screen once the parameter is gone.
    const remaining = new URLSearchParams(searchParams)
    remaining.delete("cubid")
    const query = remaining.toString()
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
  }, [outcome, pathname, router, searchParams])

  if (!shown) return null
  const message = MESSAGES[shown] ?? MESSAGES.refused

  return (
    <div
      className="fixed inset-x-4 top-4 z-50 mx-auto max-w-xl rounded-2xl border bg-[var(--surface-panel-strong)] p-4 shadow-[var(--surface-shadow-panel)] sm:inset-x-auto sm:right-4 sm:left-auto"
      // A failure is an alert because it interrupts what the person was doing; a success is a
      // status, which a screen reader announces without taking focus.
      role={message.tone === "bad" ? "alert" : "status"}
      data-testid="cubid-outcome-notice"
      data-outcome={shown}
    >
      <div className="flex items-start gap-3">
        <div className="flex-1">
          <p className="font-semibold">{message.title}</p>
          <p className="mt-1 text-sm text-[var(--text-muted)]">{message.description}</p>
        </div>
        <button
          type="button"
          onClick={() => setShown(null)}
          aria-label="Dismiss"
          className="rounded-full p-1 text-[var(--text-muted)] hover:text-[var(--text-strong)]"
          data-testid="cubid-outcome-dismiss"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
