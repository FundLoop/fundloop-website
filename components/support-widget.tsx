"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { toast } from "@/components/ui/use-toast"
import { Heart } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { supabase } from "@/lib/supabase"

export default function SupportWidget() {
  const [amount, setAmount] = useState("250")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isDonationModalOpen, setIsDonationModalOpen] = useState(false)
  const [donationName, setDonationName] = useState("")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      // Simulate API call
      // In a real app, you would make an API call to your backend to process the donation
      // const response = await fetch('/api/donate', {
      //   method: 'POST',
      //   body: JSON.stringify({ amount }),
      //   headers: { 'Content-Type': 'application/json' },
      // });

      // if (!response.ok) {
      //   throw new Error('Failed to process donation');
      // }

      // const data = await response.json();

      toast({
        title: "Thank you for your support!",
        description: `Your donation of $${amount} will help grow the FundLoop ecosystem.`,
      })
      setIsDonationModalOpen(true) // Open the donation modal
    } catch (error) {
      console.error("Error processing donation:", error)
      toast({
        title: "Error",
        description: "Failed to process donation. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDonationConfirmation = async (paymentMethod: string) => {
    setIsDonationModalOpen(false)
    try {
      const { error } = await supabase.from("donations").insert([
        {
          amount: Number(amount),
          payment_method: paymentMethod,
          donation_name: donationName || "Anonymous",
        },
      ])

      if (error) {
        throw new Error("Failed to save donation confirmation")
      }

      toast({
        title: "Donation Confirmed",
        description: "Thank you for confirming your donation. We appreciate your support!",
      })
    } catch (error) {
      console.error("Error saving donation confirmation:", error)
      toast({
        title: "Error",
        description: "Failed to save donation confirmation. Please try again.",
        variant: "destructive",
      })
    }
  }

  return (
    <>
      <Card className="w-full max-w-md mx-auto">
        <CardHeader>
          <div className="flex items-center justify-center mb-2">
            <div className="rounded-full bg-red-100 dark:bg-red-900/30 p-2">
              <Heart className="h-6 w-6 text-red-600 dark:text-red-400" />
            </div>
          </div>
          <CardTitle className="text-center">Support This Project</CardTitle>
          <CardDescription className="text-center">
            Your donation helps us build and maintain the FundLoop ecosystem
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit}>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Select an amount</Label>
                <RadioGroup
                  defaultValue="250"
                  className="grid grid-cols-2 gap-4"
                  value={amount}
                  onValueChange={setAmount}
                >
                  <Label
                    htmlFor="amount-20"
                    className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-transparent p-4 hover:bg-accent hover:text-accent-foreground [&:has([data-state=checked])]:border-primary"
                  >
                    <RadioGroupItem value="20" id="amount-20" className="sr-only" />
                    <span className="text-xl font-bold">$20</span>
                  </Label>
                  <Label
                    htmlFor="amount-100"
                    className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-transparent p-4 hover:bg-accent hover:text-accent-foreground [&:has([data-state=checked])]:border-primary"
                  >
                    <RadioGroupItem value="100" id="amount-100" className="sr-only" />
                    <span className="text-xl font-bold">$100</span>
                  </Label>
                  <Label
                    htmlFor="amount-500"
                    className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-transparent p-4 hover:bg-accent hover:text-accent-foreground [&:has([data-state=checked])]:border-primary"
                  >
                    <RadioGroupItem value="500" id="amount-500" className="sr-only" />
                    <span className="text-xl font-bold">$500</span>
                  </Label>
                  <Label
                    htmlFor="amount-1000"
                    className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-transparent p-4 hover:bg-accent hover:text-accent-foreground [&:has([data-state=checked])]:border-primary"
                  >
                    <RadioGroupItem value="1000" id="amount-1000" className="sr-only" />
                    <span className="text-xl font-bold">$1000</span>
                  </Label>
                </RadioGroup>
              </div>

              <div className="space-y-2">
                <Label htmlFor="custom-amount">Or enter a custom amount</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-400">$</span>
                  <Input
                    id="custom-amount"
                    type="number"
                    placeholder="Custom amount"
                    className="pl-7"
                    value={amount !== "100" && amount !== "250" && amount !== "500" && amount !== "1000" ? amount : ""}
                    onChange={(e) => setAmount(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email (optional)</Label>
                <Input id="email" type="email" placeholder="For donation receipt" />
              </div>
            </div>
          </form>
        </CardContent>
        <CardFooter>
          <Button
            className="w-full bg-gradient-to-r from-red-500 to-pink-500 hover:from-red-600 hover:to-pink-600"
            onClick={handleSubmit}
            disabled={isSubmitting}
          >
            {isSubmitting ? "Processing..." : "Donate Now"}
          </Button>
        </CardFooter>
      </Card>

      <Dialog open={isDonationModalOpen} onOpenChange={() => setIsDonationModalOpen(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Thank You for Your Donation!</DialogTitle>
            <DialogDescription>
              Your generous contribution will help support the FundLoop ecosystem. Please complete your donation by
              following the instructions below:
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <p>
              <b>E-Transfer:</b> Send your donation to <code className="font-mono">donations@fundloop.org</code>
            </p>
            <p>
              <b>Cryptocurrency Transfer:</b> Send your donation to <code className="font-mono">fundloop.eth</code>
            </p>
            <Input
              type="text"
              placeholder="Preferred name for donation board (optional)"
              value={donationName}
              onChange={(e) => setDonationName(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setIsDonationModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => handleDonationConfirmation("e-transfer")}>I have eTransferred</Button>
            <Button onClick={() => handleDonationConfirmation("crypto")}>I have transferred crypto</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
