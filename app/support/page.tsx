"use client"

import type React from "react"

import { useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "@/components/ui/use-toast"
import { ArrowLeft, Mail, MessageSquare, Phone } from "lucide-react"
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs"
import type { Database } from "@/types/supabase"

export default function SupportPage() {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    subject: "",
    category: "",
    message: "",
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const supabase = createClientComponentClient<Database>()

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { id, value } = e.target
    setFormData((prev) => ({ ...prev, [id]: value }))
  }

  const handleSelectChange = (value: string) => {
    setFormData((prev) => ({ ...prev, category: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const newErrors: Record<string, string> = {}
    if (!formData.name.trim()) newErrors.name = "Name is required"
    if (!formData.email.trim()) {
      newErrors.email = "Email is required"
    } else if (!/^\S+@\S+\.\S+$/.test(formData.email)) {
      newErrors.email = "Invalid email address"
    }
    if (!formData.subject.trim()) newErrors.subject = "Subject is required"
    if (!formData.category) newErrors.category = "Category is required"
    if (!formData.message.trim()) newErrors.message = "Message is required"
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      return
    }
    setErrors({})
    setIsSubmitting(true)
    const { error } = await supabase.from("support_requests").insert({
      name: formData.name,
      email: formData.email,
      subject: formData.subject,
      category: formData.category,
      message: formData.message,
    })
    setIsSubmitting(false)
    if (error) {
      toast({ title: "Submission failed", description: error.message })
      return
    }
    toast({
      title: "Support request submitted",
      description: "We'll get back to you as soon as possible.",
    })
    setFormData({ name: "", email: "", subject: "", category: "", message: "" })
  }

  return (
    <div className="container mx-auto px-4 py-12">
      <div className="flex items-center gap-2 mb-8">
        <Button asChild variant="ghost" size="sm" className="gap-1">
          <Link href="/">
            <ArrowLeft className="h-4 w-4" />
            <span>Back to Home</span>
          </Link>
        </Button>
      </div>

      <div className="max-w-5xl mx-auto">
        <h1 className="text-3xl md:text-4xl font-bold mb-4">Support</h1>
        <p className="text-slate-600 dark:text-slate-300 text-lg mb-8">
          Need help with FundLoop? Our support team is here to assist you.
        </p>

        <div className="grid md:grid-cols-3 gap-8 mb-12">
          <Card>
            <CardHeader className="text-center">
              <div className="mx-auto bg-emerald-100 dark:bg-emerald-900/30 p-3 rounded-full mb-4 w-12 h-12 flex items-center justify-center">
                <Mail className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
              </div>
              <CardTitle>Email Support</CardTitle>
              <CardDescription>Get help via email</CardDescription>
            </CardHeader>
            <CardContent className="text-center">
              <a
                href="mailto:support@fundloop.org?subject=Support%20Request&body=Please%20describe%20your%20issue%20here."
                className="text-emerald-600 dark:text-emerald-400 font-medium"
              >
                support@fundloop.org
              </a>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="text-center">
              <div className="mx-auto bg-emerald-100 dark:bg-emerald-900/30 p-3 rounded-full mb-4 w-12 h-12 flex items-center justify-center">
                <MessageSquare className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
              </div>
              <CardTitle>Live Chat</CardTitle>
              <CardDescription>Chat with our support team</CardDescription>
            </CardHeader>
            <CardContent className="text-center">
              <p className="text-slate-600 dark:text-slate-300 mb-4">Coming Soon</p>
              <p className="text-slate-600 dark:text-slate-300 mb-4">Available Monday to Friday, 9am to 5pm UTC.</p>
              <Button variant="outline" className="gap-1">
                <MessageSquare className="h-4 w-4" />
                Start Chat
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="text-center">
              <div className="mx-auto bg-emerald-100 dark:bg-emerald-900/30 p-3 rounded-full mb-4 w-12 h-12 flex items-center justify-center">
                <Phone className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
              </div>
              <CardTitle>Phone Support</CardTitle>
              <CardDescription>Talk to a support agent</CardDescription>
            </CardHeader>
            <CardContent className="text-center">
              <p className="text-slate-600 dark:text-slate-300 mb-4">Coming Soon</p>
              <p className="text-slate-600 dark:text-slate-300 mb-4">Available for premium support customers.</p>
            </CardContent>
          </Card>
        </div>

        <Card className="mb-12">
          <CardHeader>
            <CardTitle>Contact Form</CardTitle>
            <CardDescription>Fill out the form below and we'll get back to you as soon as possible.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Name</Label>
                  <Input
                    id="name"
                    placeholder="Your name"
                    value={formData.name}
                    onChange={handleInputChange}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="Your email"
                    value={formData.email}
                    onChange={handleInputChange}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="subject">Subject</Label>
                  <Input
                    id="subject"
                    placeholder="Subject of your inquiry"
                    value={formData.subject}
                    onChange={handleInputChange}
                    required
                    aria-invalid={!!errors.subject}
                    aria-describedby="subject-error"
                  />
                  {errors.subject && (
                    <p id="subject-error" className="text-sm text-red-500">
                      {errors.subject}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="category">Category</Label>
                  <Select value={formData.category} onValueChange={handleSelectChange}>
                    <SelectTrigger id="category">
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="general">General Inquiry</SelectItem>
                      <SelectItem value="technical">Technical Support</SelectItem>
                      <SelectItem value="billing">Billing & Payments</SelectItem>
                      <SelectItem value="account">Account Issues</SelectItem>
                      <SelectItem value="feature">Feature Request</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                  {errors.category && (
                    <p id="category-error" className="text-sm text-red-500">
                      {errors.category}
                    </p>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="message">Message</Label>
                <Textarea
                  id="message"
                  placeholder="Please describe your issue or question in detail"
                  className="min-h-[150px]"
                  value={formData.message}
                  onChange={handleInputChange}
                  required
                  aria-invalid={!!errors.message}
                  aria-describedby="message-error"
                />
                {errors.message && (
                  <p id="message-error" className="text-sm text-red-500">
                    {errors.message}
                  </p>
                )}
              </div>
            </form>
          </CardContent>
          <CardFooter>
            <Button
              type="submit"
              className="w-full bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-700 hover:to-cyan-700"
              onClick={handleSubmit}
              disabled={isSubmitting}
            >
              {isSubmitting ? "Submitting..." : "Submit"}
            </Button>
          </CardFooter>
        </Card>

        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4">Frequently Asked Questions</h2>
          <p className="text-slate-600 dark:text-slate-300 mb-6">
            Find quick answers to common questions in our FAQ section.
          </p>
          <Button asChild variant="outline">
            <Link href="/faq">View FAQ</Link>
          </Button>
          <p className="mt-4">
            <Link
              href="/documentation"
              className="text-emerald-600 dark:text-emerald-400 underline"
            >
              Documentation
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
