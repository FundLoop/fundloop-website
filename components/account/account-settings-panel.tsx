"use client"

import { useTranslations } from "next-intl"
import { Mail, Wallet } from "lucide-react"
import { EmailManagement } from "@/components/account/email-management"
import { WalletManagement } from "@/components/account/wallet-management"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

type AccountSettingsPanelProps = {
  heading: string
  description: string
}

export function AccountSettingsPanel({ heading, description }: AccountSettingsPanelProps) {
  const t = useTranslations("accountSettings")

  return (
    <div className="space-y-8">
      <section className="rounded-[calc(var(--radius-2xl)+0.25rem)] border border-[color:var(--surface-border)] bg-[var(--surface-panel)] p-8 shadow-[var(--surface-shadow-panel)]">
        <div className="max-w-3xl space-y-4">
          <h1 className="text-4xl font-semibold tracking-[var(--tracking-display)] text-[var(--text-strong)]">{heading}</h1>
          <p className="max-w-2xl text-base leading-7 text-[var(--text-muted)]">{description}</p>
        </div>
      </section>

      <section className="rounded-[calc(var(--radius-2xl)+0.25rem)] border border-[color:var(--surface-border)] bg-[var(--surface-panel-strong)] p-6 shadow-[var(--surface-shadow-panel)]">
        <Tabs defaultValue="emails" className="w-full">
          <TabsList className="mb-8 grid w-full grid-cols-2">
            <TabsTrigger value="emails" className="flex items-center gap-2">
              <Mail className="h-4 w-4" />
              {t("emails")}
            </TabsTrigger>
            <TabsTrigger value="wallets" className="flex items-center gap-2">
              <Wallet className="h-4 w-4" />
              {t("wallets")}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="emails" className="mt-0">
            <EmailManagement />
          </TabsContent>

          <TabsContent value="wallets" className="mt-0">
            <WalletManagement />
          </TabsContent>
        </Tabs>
      </section>
    </div>
  )
}
