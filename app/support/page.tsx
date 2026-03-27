"use client"

import type React from "react"

import { useState } from "react"
import Link from "next/link"
import { ArrowLeft, Mail, MessageSquare, User } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "@/components/ui/use-toast"
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase"
import { MarketingPage, MarketingSection, SectionBody, SectionEyebrow, SectionTitle } from "@/components/marketing/page-chrome"
import { Reveal } from "@/components/marketing/reveal"

const helpPaths = [
  {
    title: "Participation",
    body: "Use this when you want the clearest walkthrough of how people join projects, build signal, and receive rewards.",
    href: "/participation",
  },
  {
    title: "FAQ",
    body: "Use this when you want the shortest answer to common questions about pricing, bots, or participation.",
    href: "/faq",
  },
  {
    title: "Documentation",
    body: "Use this when you need walkthroughs, setup details, or support articles tied to product workflows.",
    href: "/documentation",
  },
] as const

const supportChannels = [
  {
    icon: User,
    title: "Founder call",
    body: "Coming soon for teams that need higher-touch guidance.",
  },
  {
    icon: Mail,
    title: "Email support",
    body: "Reach us at support@fundloop.org for account, onboarding, or payment questions.",
    href: "mailto:support@fundloop.org?subject=Support%20Request&body=Please%20describe%20your%20issue%20here.",
  },
  {
    icon: MessageSquare,
    title: "Live chat",
    body: "Planned for future support hours once the public flows are live at a larger scale.",
  },
] as const

type SupportChannel = (typeof supportChannels)[number]

export default function SupportPage() {
  const supabaseConfigured = isSupabaseConfigured()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    subject: "",
    category: "",
    message: "",
  })
  const [errors, setErrors] = useState<Record<string, string>>({})

  const getSupabase = () => getSupabaseBrowserClient()

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { id, value } = event.target
    setFormData((prev) => ({ ...prev, [id]: value }))
    setErrors((prev) => {
      const nextErrors = { ...prev }

      switch (id) {
        case "name":
          if (value.trim()) delete nextErrors.name
          break
        case "email":
          if (/^\S+@\S+\.\S+$/.test(value)) delete nextErrors.email
          break
        case "subject":
          if (value.trim()) delete nextErrors.subject
          break
        case "message":
          if (value.trim()) delete nextErrors.message
          break
      }

      return nextErrors
    })
  }

  const handleSelectChange = (value: string) => {
    setFormData((prev) => ({ ...prev, category: value }))
    setErrors((prev) => {
      const copy = { ...prev }
      if (value) delete copy.category
      return copy
    })
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()

    if (!supabaseConfigured) {
      toast({
        title: "Support is unavailable locally",
        description: "Configure Supabase environment variables to submit support requests from this checkout.",
        variant: "destructive",
      })
      return
    }

    const supabase = getSupabase()
    const nextErrors: Record<string, string> = {}

    if (!formData.name.trim()) nextErrors.name = "Name is required"
    if (!formData.email.trim()) {
      nextErrors.email = "Email is required"
    } else if (!/^\S+@\S+\.\S+$/.test(formData.email)) {
      nextErrors.email = "Invalid email address"
    }
    if (!formData.subject.trim()) nextErrors.subject = "Subject is required"
    if (!formData.category) nextErrors.category = "Category is required"
    if (!formData.message.trim()) nextErrors.message = "Message is required"

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors)
      return
    }

    setErrors({})
    setIsSubmitting(true)

    let ip = ""

    try {
      const response = await fetch("https://api.ipify.org?format=json")
      const data = await response.json()
      ip = data.ip
    } catch (error) {
      console.error("Failed to get IP", error)
    }

    const {
      data: { user },
    } = await supabase.auth.getUser()

    const { error } = await supabase.from("support_requests").insert([
      {
        name: formData.name,
        email: formData.email,
        subject: formData.subject,
        category: formData.category,
        message: formData.message,
        ip_address: ip || null,
        user_id: user?.id ?? null,
      },
    ])

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
    <MarketingPage>
      <MarketingSection className="pb-10 pt-10">
        <Reveal>
          <Button
            asChild
            variant="ghost"
            className="rounded-full px-0 text-[var(--marketing-muted-strong)] hover:bg-transparent hover:text-[var(--marketing-accent)]"
          >
            <Link href="/">
              <ArrowLeft className="h-4 w-4" />
              Back to home
            </Link>
          </Button>
        </Reveal>
      </MarketingSection>

      <MarketingSection className="pt-0">
        <Reveal>
          <SectionEyebrow>Support</SectionEyebrow>
          <SectionTitle className="mt-4 max-w-5xl text-5xl sm:text-6xl lg:text-7xl">
            Start with the fastest path, then reach out if you still need a human.
          </SectionTitle>
          <SectionBody className="mt-6 max-w-3xl">
            FundLoop support works best when we can route you quickly: FAQ for short answers, documentation for product
            details, and the contact form when you are blocked by a real account or onboarding issue.
          </SectionBody>
        </Reveal>
      </MarketingSection>

      <MarketingSection className="border-y border-[color:var(--marketing-line)] bg-white/34 dark:bg-white/[0.02]">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,0.72fr)_minmax(0,1.28fr)]">
          <Reveal>
            <SectionEyebrow>Quick routes</SectionEyebrow>
            <SectionTitle className="mt-4 text-5xl sm:text-6xl">Usually, one of these gets you unstuck fastest.</SectionTitle>
          </Reveal>
          <div className="grid gap-6 sm:grid-cols-2">
            {helpPaths.map((path, index) => (
              <Reveal key={path.href} delay={index * 90}>
                <Link href={path.href} className="group block border-t border-[color:var(--marketing-line)] pt-5">
                  <p className="font-display text-3xl leading-none tracking-[-0.04em]">{path.title}</p>
                  <p className="mt-3 text-sm leading-6 text-[var(--marketing-muted-strong)]">{path.body}</p>
                  <span className="mt-4 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--marketing-accent)]">
                    Open page
                    <ArrowLeft className="h-3.5 w-3.5 rotate-180 transition-transform duration-200 group-hover:translate-x-1" />
                  </span>
                </Link>
              </Reveal>
            ))}
          </div>
        </div>
      </MarketingSection>

      <MarketingSection>
        <div className="grid gap-12 lg:grid-cols-[minmax(0,0.78fr)_minmax(0,1.22fr)]">
          <Reveal className="space-y-6">
            <div>
              <SectionEyebrow>Channels</SectionEyebrow>
              <SectionTitle className="mt-4 text-5xl sm:text-6xl">Ways to get help.</SectionTitle>
            </div>
            {supportChannels.map((channel: SupportChannel, index) => {
              const Icon = channel.icon
              const channelHref = "href" in channel ? channel.href : undefined

              return (
                <Reveal key={channel.title} delay={index * 70}>
                  <div className="border-t border-[color:var(--marketing-line)] pt-5">
                    <div className="flex items-center gap-3">
                      <span className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-[color:var(--marketing-line)] bg-white/55 dark:bg-white/[0.04]">
                        <Icon className="h-4 w-4" />
                      </span>
                      <p className="text-sm font-semibold uppercase tracking-[0.18em]">{channel.title}</p>
                    </div>
                    {channelHref ? (
                      <Link
                        href={channelHref}
                        className="mt-4 inline-flex text-sm font-semibold text-[var(--marketing-accent)] underline-offset-4 hover:underline"
                      >
                        support@fundloop.org
                      </Link>
                    ) : null}
                    <p className="mt-3 text-sm leading-6 text-[var(--marketing-muted-strong)]">{channel.body}</p>
                  </div>
                </Reveal>
              )
            })}
          </Reveal>

          <Reveal delay={120}>
            <div className="rounded-[2rem] border border-[color:var(--marketing-line)] bg-white/58 p-6 shadow-[0_24px_70px_rgba(15,23,23,0.08)] dark:bg-white/[0.03] sm:p-8">
              <p className="text-[0.68rem] font-semibold uppercase tracking-[0.28em] text-[var(--marketing-muted)]">
                Contact form
              </p>
              <form onSubmit={handleSubmit} className="mt-8 space-y-5">
                <div className="grid gap-5 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="name">Name</Label>
                    <Input id="name" value={formData.name} onChange={handleInputChange} placeholder="Your name" required />
                    {errors.name ? <p className="text-sm text-red-500">{errors.name}</p> : null}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={handleInputChange}
                      placeholder="you@example.com"
                      required
                    />
                    {errors.email ? <p className="text-sm text-red-500">{errors.email}</p> : null}
                  </div>
                </div>

                <div className="grid gap-5 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="subject">Subject</Label>
                    <Input
                      id="subject"
                      value={formData.subject}
                      onChange={handleInputChange}
                      placeholder="What do you need help with?"
                      required
                    />
                    {errors.subject ? <p className="text-sm text-red-500">{errors.subject}</p> : null}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="category">Category</Label>
                    <Select value={formData.category} onValueChange={handleSelectChange}>
                      <SelectTrigger id="category">
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="general">General inquiry</SelectItem>
                        <SelectItem value="technical">Technical support</SelectItem>
                        <SelectItem value="billing">Billing and payments</SelectItem>
                        <SelectItem value="account">Account issues</SelectItem>
                        <SelectItem value="feature">Feature request</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                    {errors.category ? <p className="text-sm text-red-500">{errors.category}</p> : null}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="message">Message</Label>
                  <Textarea
                    id="message"
                    value={formData.message}
                    onChange={handleInputChange}
                    placeholder="Please describe your issue or question in detail."
                    className="min-h-[170px]"
                    required
                  />
                  {errors.message ? <p className="text-sm text-red-500">{errors.message}</p> : null}
                </div>

                <Button
                  type="submit"
                  size="lg"
                  className="w-full rounded-full bg-[var(--marketing-accent)] text-white hover:bg-[color:var(--marketing-accent)]/92"
                  disabled={isSubmitting || !supabaseConfigured}
                >
                  {!supabaseConfigured ? "Support unavailable locally" : isSubmitting ? "Submitting..." : "Submit request"}
                </Button>
              </form>
            </div>
          </Reveal>
        </div>
      </MarketingSection>
    </MarketingPage>
  )
}
