"use client"

import { useTranslations } from "next-intl"
import { Fingerprint, Mail, Wallet } from "lucide-react"
import { CubidIdentityPanel } from "@/components/account/cubid-identity-panel"
import { FundloopProfilePanel } from "@/components/account/fundloop-profile-panel"
import { EmailManagement } from "@/components/account/email-management"
import { WalletManagement } from "@/components/account/wallet-management"
import type { CubidIdentitySnapshotSummary, CubidIdentityStatus } from "@/lib/cubid/types"
import type { CubidIdentityOwnership, ManagedIdentityField } from "@/lib/cubid/read-model"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

type AccountSettingsPanelProps = {
  heading: string
  description: string
  cubid: {
    status: CubidIdentityStatus
    signedInEmail: string | null
    cubidId: string | null
    cubidScore: number | null
    snapshot: CubidIdentitySnapshotSummary | null
    managedIdentity: {
      fullName: ManagedIdentityField
      primaryEmail: ManagedIdentityField
      primaryPhone: ManagedIdentityField
    }
    identityOwnership: CubidIdentityOwnership
    profileCompletionPercent: number
    profileCompletionMissingItems: string[]
    cubidPassportOrigin: string | null
    cubidStampPageId: string | null
  }
  localProfile: {
    displayName: string | null
    profileHeadline: string | null
    bio: string | null
    occupationName: string | null
    locationName: string | null
    interestCount: number
    interestNames: string[]
    visibility: {
      isPublic: boolean
      isNamePublic: boolean
      isPfpPublic: boolean
      isGenderPublic: boolean
      isOccupationPublic: boolean
      isLocationPublic: boolean
    }
  }
}

export function AccountSettingsPanel({ heading, description, cubid, localProfile }: AccountSettingsPanelProps) {
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
        <Tabs defaultValue="identity" className="w-full">
          <TabsList className="mb-8 grid w-full grid-cols-4">
            <TabsTrigger value="identity" className="flex items-center gap-2">
              <Fingerprint className="h-4 w-4" />
              {t("identity")}
            </TabsTrigger>
            <TabsTrigger value="profile" className="flex items-center gap-2">
              <Fingerprint className="h-4 w-4" />
              {t("profile")}
            </TabsTrigger>
            <TabsTrigger value="emails" className="flex items-center gap-2">
              <Mail className="h-4 w-4" />
              {t("emails")}
            </TabsTrigger>
            <TabsTrigger value="wallets" className="flex items-center gap-2">
              <Wallet className="h-4 w-4" />
              {t("wallets")}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="identity" className="mt-0">
            <CubidIdentityPanel
              status={cubid.status}
              signedInEmail={cubid.signedInEmail}
              cubidId={cubid.cubidId}
              cubidScore={cubid.cubidScore}
              cubidSnapshot={cubid.snapshot}
              managedIdentity={cubid.managedIdentity}
              identityOwnership={cubid.identityOwnership}
              profileCompletionPercent={cubid.profileCompletionPercent}
              profileCompletionMissingItems={cubid.profileCompletionMissingItems}
              cubidPassportOrigin={cubid.cubidPassportOrigin}
              cubidStampPageId={cubid.cubidStampPageId}
              title={t("panels.identity.title")}
              description={t(`panels.identity.status.${cubid.status}`)}
              linkedLabel={t("panels.identity.labels.linked")}
              verifiedLabel={t("panels.identity.labels.verified")}
              unlinkedLabel={t("panels.identity.labels.unlinked")}
              manageCta={t("panels.identity.manage")}
              refreshCta={t("panels.identity.refresh")}
              completionTitle={t("panels.identity.completion")}
            />
          </TabsContent>

          <TabsContent value="profile" className="mt-0">
            <FundloopProfilePanel
              profile={localProfile}
              title={t("panels.profile.title")}
              description={t("panels.profile.description")}
              ownershipNote={t("panels.profile.ownershipNote")}
            />
          </TabsContent>

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
