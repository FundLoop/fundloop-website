"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { toast } from "@/components/ui/use-toast"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Mail, Plus, Star, Trash2, Check, AlertCircle } from "lucide-react"
import { getUserEmails, addEmail, removeEmail, setEmailAsPrimary } from "@/app/actions/auth-actions"

interface UserEmail {
  id: number
  email: string
  is_primary: boolean
  is_verified: boolean
  is_removed: boolean
  created_at: string
}

export function EmailManagement() {
  const [emails, setEmails] = useState<UserEmail[]>([])
  const [newEmail, setNewEmail] = useState("")
  const [isAddingEmail, setIsAddingEmail] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [emailToRemove, setEmailToRemove] = useState<UserEmail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchEmails()
  }, [])

  const fetchEmails = async () => {
    try {
      setLoading(true)
      setError(null)
      const userEmails = await getUserEmails()
      setEmails(userEmails)
    } catch (err: any) {
      console.error("Error fetching emails:", err)
      setError(err.message || "Failed to load email addresses. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  const handleAddEmail = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!isValidEmail(newEmail)) {
      toast({
        title: "Invalid email format",
        description: "Please enter a valid email address.",
        variant: "destructive",
      })
      return
    }

    // Check if email already exists
    if (emails.some((email) => email.email.toLowerCase() === newEmail.toLowerCase())) {
      toast({
        title: "Email already exists",
        description: "This email is already associated with your account.",
        variant: "destructive",
      })
      return
    }

    try {
      setIsSubmitting(true)
      await addEmail(newEmail)
      toast({
        title: "Email added",
        description: "A verification email has been sent to your address.",
      })
      setNewEmail("")
      setIsAddingEmail(false)
      fetchEmails()
    } catch (err: any) {
      console.error("Error adding email:", err)
      toast({
        title: "Failed to add email",
        description: err.message || "There was an error adding your email. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleSetPrimary = async (emailId: number) => {
    try {
      await setEmailAsPrimary(emailId)
      toast({
        title: "Primary email updated",
        description: "Your primary email has been updated successfully.",
      })
      fetchEmails()
    } catch (err: any) {
      console.error("Error setting primary email:", err)
      toast({
        title: "Failed to update primary email",
        description: err.message || "There was an error updating your primary email. Please try again.",
        variant: "destructive",
      })
    }
  }

  const handleRemoveEmail = async () => {
    if (!emailToRemove) return

    try {
      await removeEmail(emailToRemove.id)
      toast({
        title: "Email removed",
        description: "The email has been removed from your account.",
      })
      setEmailToRemove(null)
      fetchEmails()
    } catch (err: any) {
      console.error("Error removing email:", err)
      toast({
        title: "Failed to remove email",
        description: err.message || "There was an error removing the email. Please try again.",
        variant: "destructive",
      })
    }
  }

  // Utility function to validate email format
  const isValidEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(email)
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex justify-center">
            <p>Loading email addresses...</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-2 text-red-500">
            <AlertCircle className="h-5 w-5" />
            <p>{error}</p>
          </div>
          <Button onClick={fetchEmails} className="mt-4">
            Retry
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Email Addresses</CardTitle>
          <CardDescription>Manage the email addresses associated with your account</CardDescription>
        </CardHeader>
        <CardContent>
          {emails.length === 0 ? (
            <div className="text-center py-4">
              <p className="text-muted-foreground">No email addresses found</p>
            </div>
          ) : (
            <div className="space-y-4">
              {emails.map((email) => (
                <div key={email.id} className="flex items-center justify-between p-3 border rounded-md">
                  <div className="flex items-center gap-3">
                    <Mail className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="font-medium">{email.email}</p>
                      <div className="flex gap-2 mt-1">
                        {email.is_primary && (
                          <Badge variant="secondary" className="text-xs">
                            <Star className="h-3 w-3 mr-1" />
                            Primary
                          </Badge>
                        )}
                        {email.is_verified ? (
                          <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">
                            <Check className="h-3 w-3 mr-1" />
                            Verified
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700 border-amber-200">
                            Unverified
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {!email.is_primary && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleSetPrimary(email.id)}
                        title="Set as primary email"
                      >
                        <Star className="h-4 w-4" />
                        <span className="sr-only">Set as primary</span>
                      </Button>
                    )}
                    {!email.is_primary && (
                      <Button variant="outline" size="sm" onClick={() => setEmailToRemove(email)} title="Remove email">
                        <Trash2 className="h-4 w-4 text-red-500" />
                        <span className="sr-only">Remove</span>
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {isAddingEmail ? (
            <form onSubmit={handleAddEmail} className="mt-6 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="new-email">New Email Address</Label>
                <Input
                  id="new-email"
                  type="email"
                  placeholder="Enter email address"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  required
                />
              </div>
              <div className="flex gap-2">
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? "Adding..." : "Add Email"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsAddingEmail(false)
                    setNewEmail("")
                  }}
                >
                  Cancel
                </Button>
              </div>
            </form>
          ) : (
            <Button onClick={() => setIsAddingEmail(true)} className="mt-6" variant="outline">
              <Plus className="h-4 w-4 mr-2" />
              Add Email Address
            </Button>
          )}
        </CardContent>
        <CardFooter className="text-sm text-muted-foreground">
          <p>Your primary email is used for account notifications and recovery.</p>
        </CardFooter>
      </Card>

      <AlertDialog open={!!emailToRemove} onOpenChange={(open) => !open && setEmailToRemove(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Email Address</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove {emailToRemove?.email}? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleRemoveEmail} className="bg-red-500 hover:bg-red-600">
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
