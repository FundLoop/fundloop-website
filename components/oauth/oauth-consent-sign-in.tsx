"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { FullPageAuth } from "@/components/full-page-auth"

// Sign-in for the consent screen (#266 stage 2). The existing auth flow returns to
// window.location.href, which still carries the authorization request token, so the person lands
// back on the same decision rather than on a dashboard.
export function OAuthConsentSignIn({ clientName }: { clientName: string }) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <Button onClick={() => setOpen(true)}>Sign in to continue</Button>
      <p className="mt-3 text-xs text-[var(--text-muted)]">
        {clientName} does not see your email address or your password at any point.
      </p>
      <FullPageAuth open={open} onClose={() => setOpen(false)} />
    </>
  )
}
