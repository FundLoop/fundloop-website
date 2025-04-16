"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { toast } from "@/components/ui/use-toast"

export default function UserSignup() {
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    // Simulate API call
    setTimeout(() => {
      setIsSubmitting(false)
      toast({
        title: "User profile created!",
        description: "Welcome to FundLoop. You're now eligible to receive citizen salary payments.",
      })
    }, 1500)
  }

  return (
    <Card className="w-full" id="user-signup">
      <CardHeader>
        <CardTitle className="text-2xl">Join as a User</CardTitle>
        <CardDescription>
          Create your profile to participate in the ecosystem and receive citizen salary
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="user-name">Full Name</Label>
            <Input id="user-name" placeholder="Your name" required />
          </div>

          <div className="space-y-2">
            <Label htmlFor="user-email">Email</Label>
            <Input id="user-email" type="email" placeholder="you@example.com" required />
          </div>

          <div className="space-y-2">
            <Label htmlFor="user-wallet">Wallet Address (optional)</Label>
            <Input id="user-wallet" placeholder="0x..." />
            <p className="text-xs text-slate-500 dark:text-slate-400">
              For receiving citizen salary payments. You can add this later.
            </p>
          </div>

          <div className="flex items-start space-x-2 pt-4">
            <Checkbox id="terms" required />
            <div className="grid gap-1.5 leading-none">
              <label
                htmlFor="terms"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                I agree to the terms and conditions
              </label>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                I understand that my participation data may be anonymously shared with projects in the ecosystem.
              </p>
            </div>
          </div>
        </form>
      </CardContent>
      <CardFooter>
        <Button
          className="w-full bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700"
          onClick={handleSubmit}
          disabled={isSubmitting}
        >
          {isSubmitting ? "Creating Profile..." : "Create Profile"}
        </Button>
      </CardFooter>
    </Card>
  )
}
