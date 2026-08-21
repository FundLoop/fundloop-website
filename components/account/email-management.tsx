"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Mail, Star, Check, AlertCircle } from "lucide-react"
import { getUserEmails } from "@/app/actions/auth-actions"

interface UserEmail {
  id: number
  email: string
  is_primary: boolean
  is_verified: boolean
  is_removed: boolean
  created_at: string | null
}

export function EmailManagement() {
  const [emails, setEmails] = useState<UserEmail[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void fetchEmails()
  }, [])

  const fetchEmails = async () => {
    try {
      setLoading(true)
      setError(null)
      setEmails(await getUserEmails())
    } catch (err: any) {
      console.error("Error fetching emails:", err)
      setError(err.message || "Failed to load email addresses. Please try again.")
    } finally {
      setLoading(false)
    }
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
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Email Addresses</CardTitle>
        <CardDescription>The current schema exposes your primary account email as read-only.</CardDescription>
      </CardHeader>
      <CardContent>
        {emails.length === 0 ? (
          <div className="text-center py-4">
            <p className="text-muted-foreground">No email addresses found</p>
          </div>
        ) : (
          <div className="space-y-4">
            {emails.map((email) => (
              <div key={email.id} className="flex items-center justify-between rounded-md border p-3">
                <div className="flex items-center gap-3">
                  <Mail className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium">{email.email}</p>
                    <div className="mt-1 flex gap-2">
                      {email.is_primary && (
                        <Badge variant="secondary" className="text-xs">
                          <Star className="mr-1 h-3 w-3" />
                          Primary
                        </Badge>
                      )}
                      {email.is_verified ? (
                        <Badge variant="outline" className="border-green-200 bg-green-50 text-xs text-green-700">
                          <Check className="mr-1 h-3 w-3" />
                          Verified
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="border-amber-200 bg-amber-50 text-xs text-amber-700">
                          Unverified
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
      <CardFooter>
        <p className="text-sm text-muted-foreground">
          Additional email identities and primary-email switching are not enabled in the current Supabase schema.
        </p>
      </CardFooter>
    </Card>
  )
}
