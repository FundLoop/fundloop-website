"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "@/components/ui/use-toast"
import { Mail, Copy, Check } from "lucide-react"

interface InviteMemberFormProps {
  organizationId: number
  organizationName: string
  onInviteSent?: () => void
}

export function InviteMemberForm({ organizationId, organizationName, onInviteSent }: InviteMemberFormProps) {
  const [email, setEmail] = useState("")
  const [role, setRole] = useState("member")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [inviteLink, setInviteLink] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      // Generate a unique token
      const token = generateToken()

      // In a real app, you would save to Supabase
      // const { data, error } = await supabase.from('organization_invitations').insert({
      //   organization_id: organizationId,
      //   email,
      //   role,
      //   token,
      //   invited_by: getCurrentUserId()
      // })

      // if (error) throw error

      // Generate invitation link
      const baseUrl = window.location.origin
      const inviteUrl = `${baseUrl}/invitations/${token}`
      setInviteLink(inviteUrl)

      // In a real app, you would send an email with the invitation link
      // await sendInvitationEmail(email, organizationName, role, inviteUrl)

      toast({
        title: "Invitation sent",
        description: `An invitation has been sent to ${email}.`,
      })

      if (onInviteSent) {
        onInviteSent()
      }
    } catch (error) {
      console.error("Error sending invitation:", error)
      toast({
        title: "Error",
        description: "Failed to send invitation. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const generateToken = () => {
    // Generate a random string for the token
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)
  }

  const handleCopyLink = () => {
    if (inviteLink) {
      navigator.clipboard.writeText(inviteLink)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <div className="space-y-6">
      {!inviteLink ? (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email address</Label>
            <Input
              id="email"
              type="email"
              placeholder="colleague@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="role">Role</Label>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger id="role">
                <SelectValue placeholder="Select a role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="member">Member</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Admins can manage organization settings, projects, and members. Members can view and contribute to
              projects.
            </p>
          </div>

          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? "Sending invitation..." : "Send invitation"}
          </Button>
        </form>
      ) : (
        <div className="space-y-4">
          <div className="rounded-md bg-slate-50 dark:bg-slate-800 p-4">
            <div className="flex items-center gap-3 mb-2">
              <Mail className="h-5 w-5 text-emerald-500" />
              <p className="font-medium">Invitation sent!</p>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-300 mb-4">
              An invitation has been sent to {email}. They will receive a notification when they sign in.
            </p>
            <p className="text-sm font-medium mb-2">Or share this invitation link:</p>
            <div className="flex items-center gap-2">
              <Input value={inviteLink} readOnly className="text-xs" />
              <Button size="icon" variant="outline" onClick={handleCopyLink}>
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          <Button onClick={() => setInviteLink(null)} variant="outline" className="w-full">
            Send another invitation
          </Button>
        </div>
      )}
    </div>
  )
}
