"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "@/components/ui/use-toast"
import { supabase } from "@/lib/supabase"
import { ChromeIcon as Google } from "lucide-react"

interface FullPageAuthProps {
  open: boolean
  onClose: () => void
}

export function FullPageAuth({ open, onClose }: FullPageAuthProps) {
  const [email, setEmail] = useState("")
  const [otp, setOtp] = useState("")
  const [loading, setLoading] = useState(false)
  const [otpSent, setOtpSent] = useState(false)

  const handleRequestOtp = async () => {
    setLoading(true)
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${location.origin}/my-profile`,
        },
      })
      if (error) {
        toast({
          title: "Failed to send OTP",
          description: error.message,
          variant: "destructive",
        })
      } else {
        toast({
          title: "OTP sent",
          description: "Check your email for the verification code",
        })
        setOtpSent(true)
      }
    } catch (error) {
      console.error("Error sending OTP:", error)
      toast({
        title: "Failed to send OTP",
        description: "An unexpected error occurred",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleVerifyOtp = async () => {
    setLoading(true)
    try {
      const { error } = await supabase.auth.verifyOtp({
        email,
        token: otp,
        type: "email",
      })
      if (error) {
        toast({
          title: "Failed to verify OTP",
          description: error.message,
          variant: "destructive",
        })
      } else {
        toast({
          title: "OTP verified",
          description: "You have been signed in successfully",
        })
        onClose()
      }
    } catch (error) {
      console.error("Error verifying OTP:", error)
      toast({
        title: "Failed to verify OTP",
        description: "An unexpected error occurred",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleSignInWithGoogle = async () => {
    setLoading(true)
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/my-profile`,
        },
      })
      if (error) {
        toast({
          title: "Sign in with Google failed",
          description: error.message,
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Sign in with Google error:", error)
      toast({
        title: "Sign in with Google failed",
        description: "An unexpected error occurred",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Authentication</DialogTitle>
          <DialogDescription>Sign in or create an account to continue</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              placeholder="you@example.com"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={otpSent}
            />
          </div>
          {otpSent ? (
            <div className="grid gap-2">
              <Label htmlFor="otp">Verification Code</Label>
              <Input id="otp" placeholder="123456" type="number" value={otp} onChange={(e) => setOtp(e.target.value)} />
            </div>
          ) : null}
        </div>
        {otpSent ? (
          <Button onClick={handleVerifyOtp} disabled={loading} className="w-full">
            {loading ? "Verifying..." : "Verify OTP"}
          </Button>
        ) : (
          <Button onClick={handleRequestOtp} disabled={loading} className="w-full">
            {loading ? "Sending OTP..." : "Send Verification Code"}
          </Button>
        )}
        <Button onClick={handleSignInWithGoogle} disabled={loading} variant="secondary" className="w-full mt-2">
          <Google className="mr-2 h-4 w-4" />
          Sign In with Google
        </Button>
      </DialogContent>
    </Dialog>
  )
}
