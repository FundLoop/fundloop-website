"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { approveOAuthConsent, denyOAuthConsent } from "@/app/actions/oauth-consent-actions"
import { OAUTH_SCOPE_CONSENT, type OAuthScope } from "@/lib/oauth/scopes"

type Props = {
  requestToken: string
  locale: string
  clientName: string
  clientUri: string | null
  scopes: OAuthScope[]
  accountLabel: string
}

export function OAuthConsentForm({ requestToken, locale, clientName, clientUri, scopes, accountLabel }: Props) {
  // Every requested scope starts granted; unticking one narrows what the application receives.
  const [granted, setGranted] = useState<OAuthScope[]>(scopes)
  const [submitting, setSubmitting] = useState<"approve" | "deny" | null>(null)

  return (
    <form className="space-y-6">
      <input type="hidden" name="request" value={requestToken} />
      <input type="hidden" name="locale" value={locale} />

      <ul className="space-y-4">
        {scopes.map((scope) => {
          const checked = granted.includes(scope)
          return (
            <li key={scope} className="flex gap-3 rounded-xl border border-[color:var(--marketing-line)] p-4">
              <Checkbox
                id={`scope-${scope}`}
                name="scope"
                value={scope}
                checked={checked}
                onCheckedChange={(next) =>
                  setGranted((current) => (next === true ? [...new Set([...current, scope])] : current.filter((entry) => entry !== scope)))
                }
                aria-describedby={`scope-detail-${scope}`}
              />
              <div className="space-y-1">
                <label htmlFor={`scope-${scope}`} className="text-sm font-medium">
                  {OAUTH_SCOPE_CONSENT[scope].title}
                </label>
                <p id={`scope-detail-${scope}`} className="text-sm text-[var(--text-muted)]">
                  {OAUTH_SCOPE_CONSENT[scope].detail}
                </p>
              </div>
            </li>
          )
        })}
      </ul>

      <p className="text-sm text-[var(--text-muted)]">
        {clientName} will act for {accountLabel} until you disconnect it. It can read only what you tick above, and it can never
        act on your behalf to move money or change your project.
      </p>

      <div className="flex flex-wrap gap-3">
        <Button
          type="submit"
          formAction={approveOAuthConsent}
          disabled={granted.length === 0 || submitting !== null}
          onClick={() => setSubmitting("approve")}
        >
          {submitting === "approve" ? "Connecting…" : `Allow ${clientName}`}
        </Button>
        <Button
          type="submit"
          variant="outline"
          formAction={denyOAuthConsent}
          disabled={submitting !== null}
          onClick={() => setSubmitting("deny")}
        >
          {submitting === "deny" ? "Cancelling…" : "Cancel"}
        </Button>
      </div>

      {granted.length === 0 ? (
        <p className="text-sm text-[var(--text-muted)]">Tick at least one item, or cancel to send the application away empty-handed.</p>
      ) : null}

      {clientUri ? (
        <p className="text-xs text-[var(--text-muted)]">
          Application website: <span className="font-mono">{clientUri}</span>
        </p>
      ) : null}
    </form>
  )
}
