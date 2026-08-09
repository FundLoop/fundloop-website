"use client"

import { useEffect, useState } from "react"
import { Check, Copy, UserPlus } from "lucide-react"
import { invokeProjectInvitationCreate, invokeProjectInvitationList, invokeProjectInvitationRevoke } from "@/lib/edge-functions/project-invitation"
import { PROJECT_INVITATION_APPROVED_PROFILE_FIELDS, type ProjectInvitationListItem, type ProjectInvitationProfileField } from "@/lib/edge-functions/project-invitation-contract"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

export function ProjectInvitationPanel({ projectSlug, projectName, locale }: { projectSlug: string; projectName: string; locale: string }) {
  const [email, setEmail] = useState("")
  const [role, setRole] = useState<"member" | "admin">("member")
  const [sharedProfileFields, setSharedProfileFields] = useState<ProjectInvitationProfileField[]>(["display_name", "avatar", "profile_headline"])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [link, setLink] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [invitations, setInvitations] = useState<ProjectInvitationListItem[]>([])
  const [listState, setListState] = useState<"loading" | "ready" | "error">("loading")

  useEffect(() => {
    void invokeProjectInvitationList({ projectSlug }).then((result) => {
      if (result.ok) {
        setInvitations(result.data)
        setListState("ready")
      } else {
        setListState("error")
      }
    })
  }, [projectSlug])

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (sharedProfileFields.length === 0) {
      setError("Select at least one profile field to create an invitation.")
      return
    }
    setBusy(true)
    setError(null)
    setLink(null)
    const result = await invokeProjectInvitationCreate({
      projectSlug,
      email,
      role,
      idempotencyKey: crypto.randomUUID(),
      sharedProfileFields,
    })
    setBusy(false)
    if (!result.ok) {
      setError(result.error.message)
      return
    }
    setLink(`${window.location.origin}/${locale}/invitations/${result.data.token}`)
    setInvitations((current) => [{ invitationId: result.data.invitationId, email: result.data.email, role: result.data.role,
      status: "pending", expiresAt: result.data.expiresAt, createdAt: new Date().toISOString(),
      sharedProfileFields: result.data.sharedProfileFields, policyStatus: "review", policyDocumentId: result.data.policyDocumentId }, ...current])
  }

  async function revoke(invitationId: string) {
    const result = await invokeProjectInvitationRevoke({ projectSlug, invitationId })
    if (!result.ok) return setError(result.error.message)
    setInvitations((current) => current.map((item) => item.invitationId === invitationId ? { ...item, status: "revoked" } : item))
  }

  async function copy() {
    if (!link) return
    await navigator.clipboard.writeText(link)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1800)
  }

  return (
    <Card className="bg-[var(--surface-panel-strong)]" data-testid="project-invitation-panel">
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><UserPlus className="h-5 w-5" /> Invite a project participant</CardTitle>
        <CardDescription>Create a persisted, seven-day invitation for {projectName}. Delivery is manual for now.</CardDescription>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={submit}>
          <div className="space-y-2">
            <Label htmlFor="project-invite-email">Invitee email</Label>
            <Input id="project-invite-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
          </div>
          <fieldset className="space-y-2"><legend className="text-sm font-medium">Project-scoped profile fields shared only after acceptance</legend>
            <div className="grid gap-2 sm:grid-cols-2">{PROJECT_INVITATION_APPROVED_PROFILE_FIELDS.map((field) => <label key={field} className="flex gap-2 text-sm"><input type="checkbox" checked={sharedProfileFields.includes(field)} onChange={(event) => setSharedProfileFields((current) => event.target.checked ? Array.from(new Set([...current, field])) : current.filter((item) => item !== field))} />{field.replaceAll("_", " ")}</label>)}</div>
            {sharedProfileFields.length === 0 ? <p className="text-sm text-rose-700 dark:text-rose-200">Select at least one profile field.</p> : null}
          </fieldset>
          <div className="space-y-2">
            <Label htmlFor="project-invite-role">Project role</Label>
            <Select value={role} onValueChange={(value) => setRole(value as "member" | "admin")}>
              <SelectTrigger id="project-invite-role"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="member">Member</SelectItem><SelectItem value="admin">Admin</SelectItem></SelectContent>
            </Select>
          </div>
          <Button type="submit" disabled={busy || sharedProfileFields.length === 0}>{busy ? "Creating invitation…" : "Create invitation"}</Button>
          {error ? <p role="alert" className="text-sm text-rose-700 dark:text-rose-200">{error}</p> : null}
          {link ? (
            <div className="space-y-2 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4" data-testid="pending-project-invitation">
              <p className="font-semibold text-emerald-900 dark:text-emerald-100">Pending invitation persisted for {email}</p>
              <p className="text-sm text-[var(--text-muted)]">Share this link privately. FundLoop does not send invitation email yet.</p>
              <div className="flex gap-2"><Input aria-label="Invitation link" value={link} readOnly /><Button type="button" variant="outline" size="icon" onClick={copy}>{copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}</Button></div>
            </div>
          ) : null}
        </form>
        <div className="mt-6 space-y-3" data-testid="project-invitation-list">
          <p className="text-sm font-semibold">Persisted invitations</p>
          {listState === "loading" ? <p className="text-sm text-[var(--text-muted)]">Loading persisted invitations…</p> : null}
          {listState === "error" ? <p role="alert" className="text-sm text-rose-700 dark:text-rose-200">Persisted invitations could not be loaded. Try refreshing the page.</p> : null}
          {listState === "ready" && invitations.length === 0 ? <p className="text-sm text-[var(--text-muted)]">No project invitations yet.</p> : invitations.map((invitation) => (
            <div key={invitation.invitationId} className="flex items-center justify-between gap-4 rounded-2xl border border-[color:var(--surface-border)] p-3 text-sm">
              <div><p className="font-medium">{invitation.email}</p><p className="text-[var(--text-muted)]">{invitation.role} · expires {new Date(invitation.expiresAt).toLocaleDateString()}</p><p className="text-xs text-[var(--text-muted)]">Shares after acceptance: {invitation.sharedProfileFields?.join(", ") ?? "legacy invitation fields unavailable"}</p></div>
              <div className="flex items-center gap-2"><span className="font-semibold capitalize">{invitation.status}</span>{["pending", "accepted"].includes(invitation.status) ? <Button type="button" size="sm" variant="outline" onClick={() => revoke(invitation.invitationId)}>Revoke</Button> : null}</div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
