"use client"

import { useEffect, useRef, useState } from "react"
import { Globe } from "lucide-react"
import { getSupabaseBrowserClient } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { toast } from "@/components/ui/use-toast"

type OnboardingAuthStepProps = {
  title: string
  description: string
  onAuthenticated?: () => void
}

export function OnboardingAuthStep({ title, description, onAuthenticated }: OnboardingAuthStepProps) {
  const [email, setEmail] = useState("")
  const [otpSent, setOtpSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [otpDigits, setOtpDigits] = useState(["", "", "", "", "", ""])
  const otpInputs = useRef<(HTMLInputElement | null)[]>([])

  useEffect(() => {
    const supabase = getSupabaseBrowserClient()
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN") {
        onAuthenticated?.()
      }
    })

    return () => subscription.unsubscribe()
  }, [onAuthenticated])

  useEffect(() => {
    if (otpSent) {
      otpInputs.current[0]?.focus()
    }
  }, [otpSent])

  const handleRequestOtp = async () => {
    setLoading(true)
    try {
      const supabase = getSupabaseBrowserClient()
      const redirectTo = typeof window !== "undefined" ? window.location.href : undefined

      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: redirectTo,
        },
      })

      if (error) {
        toast({
          title: "Failed to send OTP",
          description: error.message,
          variant: "destructive",
        })
        return
      }

      setOtpSent(true)
      setOtpDigits(["", "", "", "", "", ""])
      toast({
        title: "Verification code sent",
        description: "Check your email for the six-digit code.",
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unexpected error sending OTP"
      toast({
        title: "Failed to send OTP",
        description: message,
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const verifyOtp = async (digits = otpDigits) => {
    setLoading(true)
    try {
      const supabase = getSupabaseBrowserClient()
      const { error } = await supabase.auth.verifyOtp({
        email,
        token: digits.join(""),
        type: "email",
      })

      if (error) {
        toast({
          title: "Verification failed",
          description: error.message,
          variant: "destructive",
        })
        return
      }

      toast({
        title: "Signed in",
        description: "Your onboarding draft will continue where you left off.",
      })
      onAuthenticated?.()
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unexpected verification error"
      toast({
        title: "Verification failed",
        description: message,
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleGoogleSignIn = async () => {
    setLoading(true)
    try {
      const supabase = getSupabaseBrowserClient()
      const redirectTo = typeof window !== "undefined" ? window.location.href : undefined
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo,
        },
      })

      if (error) {
        toast({
          title: "Google sign-in failed",
          description: error.message,
          variant: "destructive",
        })
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unexpected Google sign-in error"
      toast({
        title: "Google sign-in failed",
        description: message,
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleOtpDigitChange = (index: number, value: string) => {
    const nextDigits = [...otpDigits]
    nextDigits[index] = value.slice(-1)
    setOtpDigits(nextDigits)

    if (value && index < otpDigits.length - 1) {
      otpInputs.current[index + 1]?.focus()
    }

    if (nextDigits.every((digit) => digit.length === 1)) {
      void verifyOtp(nextDigits)
    }
  }

  return (
    <Card className="border-slate-200/70 shadow-none">
      <CardHeader>
        <CardTitle className="text-2xl">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="onboarding-auth-email">Email</Label>
          <Input
            id="onboarding-auth-email"
            type="email"
            placeholder="you@example.com"
            value={email}
            disabled={otpSent || loading}
            onChange={(event) => setEmail(event.target.value)}
          />
        </div>

        {otpSent ? (
          <div className="space-y-3">
            <Label>Verification code</Label>
            <div className="flex gap-2">
              {otpDigits.map((digit, index) => (
                <Input
                  key={index}
                  ref={(element) => {
                    otpInputs.current[index] = element
                  }}
                  inputMode="numeric"
                  maxLength={1}
                  className="h-12 w-12 text-center text-lg"
                  value={digit}
                  onChange={(event) => handleOtpDigitChange(index, event.target.value)}
                />
              ))}
            </div>
            <p className="text-sm text-muted-foreground">
              Enter the six-digit code from your email to continue your onboarding draft.
            </p>
          </div>
        ) : null}

        {otpSent ? (
          <Button className="w-full" onClick={() => void verifyOtp()} disabled={loading}>
            {loading ? "Verifying..." : "Verify code"}
          </Button>
        ) : (
          <Button className="w-full" onClick={() => void handleRequestOtp()} disabled={loading || !email.trim()}>
            {loading ? "Sending code..." : "Continue with email"}
          </Button>
        )}

        {!otpSent ? (
          <Button variant="secondary" className="w-full" onClick={() => void handleGoogleSignIn()} disabled={loading}>
            <Globe className="mr-2 h-4 w-4" />
            Continue with Google
          </Button>
        ) : null}
      </CardContent>
    </Card>
  )
}
