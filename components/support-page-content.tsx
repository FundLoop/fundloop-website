"use client"

import type React from "react"

import { useState } from "react"
import Link from "next/link"
import { useTranslations } from "next-intl"
import { ArrowLeft, Mail, MessageSquare, User } from "lucide-react"
import { Link as LocaleLink } from "@/i18n/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "@/components/ui/use-toast"
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase"
import {
  MarketingPage,
  MarketingSection,
  SectionBody,
  SectionEyebrow,
  SectionTitle,
} from "@/components/marketing/page-chrome"
import { Reveal } from "@/components/marketing/reveal"

type SupportChannel = {
  icon: "user" | "mail" | "message-square"
  title: string
  body: string
  href?: string
  linkLabel?: string
}

type QuickRoute = {
  title: string
  body: string
  href: string
}

const supportChannelIcons = {
  user: User,
  mail: Mail,
  "message-square": MessageSquare,
} as const

export default function SupportPageContent() {
  const t = useTranslations("support")
  const supabaseConfigured = isSupabaseConfigured()
  const quickRoutes = t.raw("quickRoutes.items") as QuickRoute[]
  const supportChannels = t.raw("channels.items") as SupportChannel[]
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
        title: t("form.toasts.unavailableTitle"),
        description: t("form.toasts.unavailableDescription"),
        variant: "destructive",
      })
      return
    }

    const supabase = getSupabase()
    const nextErrors: Record<string, string> = {}

    if (!formData.name.trim()) nextErrors.name = t("form.errors.nameRequired")
    if (!formData.email.trim()) {
      nextErrors.email = t("form.errors.emailRequired")
    } else if (!/^\S+@\S+\.\S+$/.test(formData.email)) {
      nextErrors.email = t("form.errors.emailInvalid")
    }
    if (!formData.subject.trim()) nextErrors.subject = t("form.errors.subjectRequired")
    if (!formData.category) nextErrors.category = t("form.errors.categoryRequired")
    if (!formData.message.trim()) nextErrors.message = t("form.errors.messageRequired")

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
      toast({ title: t("form.toasts.submissionFailedTitle"), description: error.message })
      return
    }

    toast({
      title: t("form.toasts.submissionSuccessTitle"),
      description: t("form.toasts.submissionSuccessDescription"),
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
            <LocaleLink href="/">
              <ArrowLeft className="h-4 w-4" />
              {t("backToHome")}
            </LocaleLink>
          </Button>
        </Reveal>
      </MarketingSection>

      <MarketingSection className="pt-0">
        <Reveal>
          <SectionEyebrow>{t("hero.eyebrow")}</SectionEyebrow>
          <SectionTitle className="mt-4 max-w-5xl text-5xl sm:text-6xl lg:text-7xl">{t("hero.title")}</SectionTitle>
          <SectionBody className="mt-6 max-w-3xl">{t("hero.body")}</SectionBody>
        </Reveal>
      </MarketingSection>

      <MarketingSection className="border-y border-[color:var(--marketing-line)] bg-white/34 dark:bg-white/[0.02]">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,0.72fr)_minmax(0,1.28fr)]">
          <Reveal>
            <SectionEyebrow>{t("quickRoutes.eyebrow")}</SectionEyebrow>
            <SectionTitle className="mt-4 text-5xl sm:text-6xl">{t("quickRoutes.title")}</SectionTitle>
          </Reveal>
          <div className="grid gap-6 sm:grid-cols-2">
            {quickRoutes.map((path, index) => (
              <Reveal key={path.href} delay={index * 90}>
                <LocaleLink href={path.href} className="group block border-t border-[color:var(--marketing-line)] pt-5">
                  <p className="font-display text-3xl leading-none tracking-[-0.04em]">{path.title}</p>
                  <p className="mt-3 text-sm leading-6 text-[var(--marketing-muted-strong)]">{path.body}</p>
                  <span className="mt-4 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--marketing-accent)]">
                    {t("quickRoutes.openPage")}
                    <ArrowLeft className="h-3.5 w-3.5 rotate-180 transition-transform duration-200 group-hover:translate-x-1" />
                  </span>
                </LocaleLink>
              </Reveal>
            ))}
          </div>
        </div>
      </MarketingSection>

      <MarketingSection>
        <div className="grid gap-12 lg:grid-cols-[minmax(0,0.78fr)_minmax(0,1.22fr)]">
          <Reveal className="space-y-6">
            <div>
              <SectionEyebrow>{t("channels.eyebrow")}</SectionEyebrow>
              <SectionTitle className="mt-4 text-5xl sm:text-6xl">{t("channels.title")}</SectionTitle>
            </div>
            {supportChannels.map((channel, index) => {
              const Icon = supportChannelIcons[channel.icon]

              return (
                <Reveal key={channel.title} delay={index * 70}>
                  <div className="border-t border-[color:var(--marketing-line)] pt-5">
                    <div className="flex items-center gap-3">
                      <span className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-[color:var(--marketing-line)] bg-white/55 dark:bg-white/[0.04]">
                        <Icon className="h-4 w-4" />
                      </span>
                      <p className="text-sm font-semibold uppercase tracking-[0.18em]">{channel.title}</p>
                    </div>
                    {channel.href ? (
                      <Link
                        href={channel.href}
                        className="mt-4 inline-flex text-sm font-semibold text-[var(--marketing-accent)] underline-offset-4 hover:underline"
                      >
                        {channel.linkLabel}
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
                {t("form.eyebrow")}
              </p>
              <form onSubmit={handleSubmit} className="mt-8 space-y-5">
                <div className="grid gap-5 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="name">{t("form.name")}</Label>
                    <Input id="name" value={formData.name} onChange={handleInputChange} placeholder={t("form.namePlaceholder")} required />
                    {errors.name ? <p className="text-sm text-red-500">{errors.name}</p> : null}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">{t("form.email")}</Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={handleInputChange}
                      placeholder={t("form.emailPlaceholder")}
                      required
                    />
                    {errors.email ? <p className="text-sm text-red-500">{errors.email}</p> : null}
                  </div>
                </div>

                <div className="grid gap-5 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="subject">{t("form.subject")}</Label>
                    <Input
                      id="subject"
                      value={formData.subject}
                      onChange={handleInputChange}
                      placeholder={t("form.subjectPlaceholder")}
                      required
                    />
                    {errors.subject ? <p className="text-sm text-red-500">{errors.subject}</p> : null}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="category">{t("form.category")}</Label>
                    <Select value={formData.category} onValueChange={handleSelectChange}>
                      <SelectTrigger id="category">
                        <SelectValue placeholder={t("form.categoryPlaceholder")} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="general">{t("form.categories.general")}</SelectItem>
                        <SelectItem value="technical">{t("form.categories.technical")}</SelectItem>
                        <SelectItem value="billing">{t("form.categories.billing")}</SelectItem>
                        <SelectItem value="account">{t("form.categories.account")}</SelectItem>
                        <SelectItem value="feature">{t("form.categories.feature")}</SelectItem>
                        <SelectItem value="other">{t("form.categories.other")}</SelectItem>
                      </SelectContent>
                    </Select>
                    {errors.category ? <p className="text-sm text-red-500">{errors.category}</p> : null}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="message">{t("form.message")}</Label>
                  <Textarea
                    id="message"
                    value={formData.message}
                    onChange={handleInputChange}
                    placeholder={t("form.messagePlaceholder")}
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
                  {!supabaseConfigured ? t("form.unavailable") : isSubmitting ? t("form.submitting") : t("form.submit")}
                </Button>
              </form>
            </div>
          </Reveal>
        </div>
      </MarketingSection>
    </MarketingPage>
  )
}
