"use client"

import { useEffect, useState } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "@/components/ui/use-toast"
import { Modal } from "@/components/modal"
import UserSignupFlow from "@/components/user-signup-flow"
import { supabase } from "@/lib/supabase"

export default function JoinPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const inviteCode = searchParams.get("invite")

  const [loading, setLoading] = useState(true)
  const [inviterName, setInviterName] = useState<string | null>(null)
  const [isValidCode, setIsValidCode] = useState(false)
  const [userSignupOpen, setUserSignupOpen] = useState(false)

  useEffect(() => {
    const validateInviteCode = async () => {
      if (!inviteCode) {
        router.push("/")
        return
      }

      setLoading(true)
      try {
        // Verify the invitation code
        const { data, error } = await supabase
          .from("invitation_codes")
          .select("code, created_by, max_uses, usage_count, expires_at")
          .eq("code", inviteCode)
          .single()

        if (error) {
          console.error("Error validating invite code:", error)
          toast({
            title: "Invalid invitation code",
            description: "The invitation code is invalid or has expired.",
            variant: "destructive",
          })
          router.push("/")
          return
        }

        // Check if code has expired
        if (data.expires_at && new Date(data.expires_at) < new Date()) {
          toast({
            title: "Expired invitation code",
            description: "This invitation code has expired.",
            variant: "destructive",
          })
          router.push("/")
          return
        }

        // Check if code has reached max uses
        if (data.max_uses && data.usage_count >= data.max_uses) {
          toast({
            title: "Invitation code limit reached",
            description: "This invitation code has reached its maximum number of uses.",
            variant: "destructive",
          })
          router.push("/")
          return
        }

        setIsValidCode(true)

        // Get inviter's name
        if (data.created_by) {
          const { data: userData, error: userError } = await supabase
            .from("users")
            .select("full_name")
            .eq("user_id", data.created_by)
            .single()

          if (!userError && userData) {
            setInviterName(userData.full_name)
          }
        }
      } catch (err) {
        console.error("Error:", err)
        router.push("/")
      } finally {
        setLoading(false)
      }
    }

    validateInviteCode()
  }, [inviteCode, router])

  const handleJoinClick = () => {
    setUserSignupOpen(true)
  }

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-24 flex justify-center">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle>Validating Invitation</CardTitle>
            <CardDescription>Please wait while we validate your invitation code</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center space-y-4 py-4">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-10 w-full" />
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-24 flex justify-center">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle>Join FundLoop</CardTitle>
          <CardDescription>
            {inviterName
              ? `You've been invited by ${inviterName} to join FundLoop`
              : "You've been invited to join FundLoop"}
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center py-6">
          <p className="mb-6">
            FundLoop is a network state for mutual prosperity, connecting projects and users in a sustainable economic
            ecosystem.
          </p>
          <p className="text-sm text-slate-600 dark:text-slate-300 mb-6">
            Your invitation code: <span className="font-mono font-medium">{inviteCode}</span>
          </p>
        </CardContent>
        <CardFooter>
          <Button
            className="w-full bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-700 hover:to-cyan-700"
            onClick={handleJoinClick}
          >
            Join Now
          </Button>
        </CardFooter>
      </Card>

      {/* User Signup Modal */}
      <Modal title="Join as a User" isOpen={userSignupOpen} onClose={() => setUserSignupOpen(false)} size="lg">
        <UserSignupFlow
          onClose={() => {
            setUserSignupOpen(false)
            router.push("/")
          }}
        />
      </Modal>
    </div>
  )
}
