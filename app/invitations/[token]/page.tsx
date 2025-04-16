"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { toast } from "@/components/ui/use-toast"
import { Building2, CheckCircle2, XCircle } from "lucide-react"

interface Invitation {
  id: number
  organization_id: number
  organization_name: string
  email: string
  role: string
  invited_by: string
  status: string
  expires_at: string
}

export default function InvitationPage() {
  const params = useParams()
  const router = useRouter()
  const token = params.token as string

  const [invitation, setInvitation] = useState<Invitation | null>(null)
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [isAuthenticated, setIsAuthenticated] = useState(false)

  useEffect(() => {
    const checkAuth = async () => {
      // In a real app, you would check if the user is authenticated
      // const { data: { session } } = await supabase.auth.getSession()
      // setIsAuthenticated(!!session)

      // For demo purposes, we'll assume the user is authenticated
      setIsAuthenticated(true)
    }

    const fetchInvitation = async () => {
      try {
        // In a real app, you would fetch from Supabase
        // const { data, error } = await supabase
        //   .from('organization_invitations')
        //   .select('*, organizations(name)')
        //   .eq('token', token)
        //   .single()

        // if (error) throw error

        // For demo purposes, we'll use mock data
        const mockInvitation: Invitation = {
          id: 101,
          organization_id: 2,
          organization_name: "Digital Nomads Collective",
          email: "alex@example.com",
          role: "member",
          invited_by: "Jamie Chen",
          status: "pending",
          expires_at: new Date(Date.now() + 86400000).toISOString(), // 1 day from now
        }

        // Check if invitation has expired
        const expiresAt = new Date(mockInvitation.expires_at)
        if (expiresAt < new Date()) {
          setError("This invitation has expired.")
          return
        }

        // Check if invitation has already been accepted or declined
        if (mockInvitation.status !== "pending") {
          setError(`This invitation has already been ${mockInvitation.status}.`)
          return
        }

        setInvitation(mockInvitation)
      } catch (error) {
        console.error("Error fetching invitation:", error)
        setError("Invalid or expired invitation link.")
      } finally {
        setLoading(false)
      }
    }

    checkAuth()
    fetchInvitation()
  }, [token])

  const handleAcceptInvitation = async () => {
    setProcessing(true)

    try {
      // In a real app, you would update in Supabase
      // 1. Accept the invitation
      // const { error: invitationError } = await supabase
      //   .from('organization_invitations')
      //   .update({ status: 'accepted' })
      //   .eq('id', invitation.id)

      // if (invitationError) throw invitationError

      // 2. Add the user to the organization
      // const { error: memberError } = await supabase
      //   .from('organization_members')
      //   .insert({
      //     organization_id: invitation.organization_id,
      //     user_id: getCurrentUserId(),
      //     role: invitation.role
      //   })

      // if (memberError) throw memberError

      setSuccess(true)

      toast({
        title: "Invitation accepted",
        description: `You have been added to ${invitation?.organization_name}.`,
      })

      // Redirect to organization page after a delay
      setTimeout(() => {
        router.push(`/organizations/${invitation?.organization_id}`)
      }, 2000)
    } catch (error) {
      console.error("Error accepting invitation:", error)
      setError("Failed to accept invitation. Please try again.")
    } finally {
      setProcessing(false)
    }
  }

  const handleSignIn = () => {
    // In a real app, you would redirect to sign in page with a return URL
    // const returnUrl = `/invitations/${token}`
    // router.push(`/signin?returnUrl=${encodeURIComponent(returnUrl)}`)

    // For demo purposes, we'll just set isAuthenticated to true
    setIsAuthenticated(true)
  }

  const handleSignUp = () => {
    // In a real app, you would redirect to sign up page with a return URL
    // const returnUrl = `/invitations/${token}`
    // router.push(`/signup?returnUrl=${encodeURIComponent(returnUrl)}`)

    // For demo purposes, we'll just set isAuthenticated to true
    setIsAuthenticated(true)
  }

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-12 flex justify-center">
        <p>Loading invitation...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-12 flex justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <div className="flex justify-center mb-4">
              <div className="rounded-full bg-red-100 dark:bg-red-900/30 p-3">
                <XCircle className="h-6 w-6 text-red-600 dark:text-red-400" />
              </div>
            </div>
            <CardTitle className="text-center">Invalid Invitation</CardTitle>
            <CardDescription className="text-center">{error}</CardDescription>
          </CardHeader>
          <CardFooter>
            <Button asChild className="w-full">
              <a href="/">Return to Home</a>
            </Button>
          </CardFooter>
        </Card>
      </div>
    )
  }

  if (success) {
    return (
      <div className="container mx-auto px-4 py-12 flex justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <div className="flex justify-center mb-4">
              <div className="rounded-full bg-emerald-100 dark:bg-emerald-900/30 p-3">
                <CheckCircle2 className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
              </div>
            </div>
            <CardTitle className="text-center">Invitation Accepted</CardTitle>
            <CardDescription className="text-center">
              You have successfully joined {invitation?.organization_name}.
            </CardDescription>
          </CardHeader>
          <CardFooter>
            <Button asChild className="w-full">
              <a href={`/organizations/${invitation?.organization_id}`}>Go to Organization</a>
            </Button>
          </CardFooter>
        </Card>
      </div>
    )
  }

  if (!isAuthenticated) {
    return (
      <div className="container mx-auto px-4 py-12 flex justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <div className="flex justify-center mb-4">
              <div className="rounded-full bg-slate-100 dark:bg-slate-800 p-3">
                <Building2 className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
              </div>
            </div>
            <CardTitle className="text-center">Organization Invitation</CardTitle>
            <CardDescription className="text-center">
              You've been invited to join {invitation?.organization_name}. Please sign in or create an account to accept
              this invitation.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button onClick={handleSignIn} className="w-full">
              Sign In
            </Button>
            <Button onClick={handleSignUp} variant="outline" className="w-full">
              Create Account
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-12 flex justify-center">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="flex justify-center mb-4">
            <div className="rounded-full bg-slate-100 dark:bg-slate-800 p-3">
              <Building2 className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
            </div>
          </div>
          <CardTitle className="text-center">Organization Invitation</CardTitle>
          <CardDescription className="text-center">
            You've been invited by {invitation?.invited_by} to join {invitation?.organization_name} as a{" "}
            {invitation?.role}.
          </CardDescription>
        </CardHeader>
        <CardFooter className="flex gap-4">
          <Button onClick={handleAcceptInvitation} className="flex-1" disabled={processing}>
            {processing ? "Accepting..." : "Accept Invitation"}
          </Button>
          <Button asChild variant="outline" className="flex-1" disabled={processing}>
            <a href="/">Decline</a>
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}
