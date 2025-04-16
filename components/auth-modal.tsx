"use client"

import type React from "react"

import { useState, useRef, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "@/components/ui/use-toast"
import { supabase } from "@/lib/supabase"
import { ChromeIcon as Google, ArrowLeft } from "lucide-react"
import { useRouter } from "next/navigation"

interface FullPageAuthProps {
  open: boolean
  onClose: () => void
}

export function AuthModal({ open, onClose }: FullPageAuthProps) {
  const [email, setEmail] = useState("")
  const [otp, setOtp] = useState("")
  const [loading, setLoading] = useState(false)
  const [otpSent, setOtpSent] = useState(false)
  const [otpDigits, setOtpDigits] = useState(["", "", "", "", "", ""])
  const otpInputs = useRef<(HTMLInputElement | null)[]>([])
  const router = useRouter()

  useEffect(() => {
    if (otpSent && otpInputs.current[0]) {
      otpInputs.current[0].focus()
    }
  }, [otpSent])

  const handleRequestOtp = async () => {
    console.log("handleRequestOtp: Started")
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
        setOtpDigits(["", "", "", "", "", ""])
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
      console.log("handleRequestOtp: Finished")
    }
  }

  const verifyOtp = async () => {
    console.log("verifyOtp: Started")
    setLoading(true)
    try {
      const otpCode = otpDigits.join("")
      const { data, error } = await supabase.auth.verifyOtp({
        email,
        token: otpCode,
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
        router.refresh()
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
      console.log("verifyOtp: Finished")
    }
  }

  useEffect(() => {
    const allDigitsEntered = otpDigits.every((digit) => digit !== "")
    if (otpSent && allDigitsEntered) {
      verifyOtp()
    }
  }, [otpDigits, otpSent])

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

  const handleOtpChange = (index: number, value: string) => {
    const newOtpDigits = [...otpDigits]
    newOtpDigits[index] = value

    setOtpDigits(newOtpDigits)

    if (value && index < 5) {
      otpInputs.current[index + 1]?.focus()
    }
  }

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault()
    const pastedData = e.clipboardData.getData("text")
    const digits = pastedData.slice(0, 6).split("")

    if (digits.length === 6 && digits.every((digit) => /^\d$/.test(digit))) {
      setOtpDigits(digits)
    }
  }

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !otpDigits[index] && index > 0) {
      otpInputs.current[index - 1]?.focus()
    }
  }

  const handleBack = () => {
    setOtpSent(false)
    setOtpDigits(["", "", "", "", "", ""])
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Authentication</DialogTitle>
          <DialogDescription>Sign in or create an account to continue</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          {!otpSent ? (
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
          ) : (
            <div className="space-y-2">
              <Label>Your code was sent to you via email</Label>
              <div className="flex gap-2">
                {otpDigits.map((digit, index) => (
                  <Input
                    key={index}
                    type="text"
                    maxLength={1}
                    inputMode="numeric"
                    pattern="[0-9]*"
                    className="w-12 h-12 text-center rounded-md border"
                    value={digit}
                    onChange={(e) => handleOtpChange(index, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(index, e)}
                    onPaste={handlePaste}
                    ref={(el) => (otpInputs.current[index] = el)}
                    style={{ MozAppearance: "textfield" }}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
        {otpSent ? (
          <div className="flex justify-between">
            <Button variant="ghost" onClick={handleBack} disabled={loading}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
            <Button onClick={verifyOtp} disabled={loading}>
              {loading ? "Verifying..." : "Verify"}
            </Button>
          </div>
        ) : (
          <Button onClick={handleRequestOtp} disabled={loading} className="w-full">
            {loading ? "Sending OTP..." : "Send Verification Code"}
          </Button>
        )}
        {!otpSent && (
          <Button onClick={handleSignInWithGoogle} disabled={loading} variant="secondary" className="w-full mt-2">
            <Google className="mr-2 h-4 w-4" />
            Sign In with Google
          </Button>
        )}
      </DialogContent>
    </Dialog>
  )
}
