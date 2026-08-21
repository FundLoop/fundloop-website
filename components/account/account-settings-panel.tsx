"use client"

import { useTranslations } from "next-intl"
import { Coins, Fingerprint, Mail, Wallet } from "lucide-react"
import { AssetPreferencesPanel } from "@/components/account/asset-preferences-panel"
import { CubidIdentityPanel } from "@/components/account/cubid-identity-panel"
import { FundloopProfilePanel } from "@/components/account/fundloop-profile-panel"
import { EmailManagement } from "@/components/account/email-management"
import { WalletManagement } from "@/components/account/wallet-management"
import type { CubidIdentitySnapshotSummary, CubidIdentityStatus } from "@/lib/cubid/types"
import type { CubidIdentityOwnership, ManagedIdentityField } from "@/lib/cubid/read-model"
import type { UserAssetPreferenceSummary } from "@/lib/edge-functions/user-asset-preferences-update-contract"
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
  assetPreferences: {
    preferences: UserAssetPreferenceSummary[]
    defaultPreferences: UserAssetPreferenceSummary[]
    hasCustomPreferences: boolean
    rejectsAllProjectTokens: boolean
  }
}

export function AccountSettingsPanel({ heading, description, cubid, localProfile, assetPreferences }: AccountSettingsPanelProps) {
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
          <TabsList className="mb-8 grid w-full grid-cols-2 md:grid-cols-5">
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
            <TabsTrigger value="assetPreferences" className="flex items-center gap-2">
              <Coins className="h-4 w-4" />
              {t("assetPreferences")}
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

          <TabsContent value="assetPreferences" className="mt-0">
            <AssetPreferencesPanel
              preferences={assetPreferences.preferences}
              defaultPreferences={assetPreferences.defaultPreferences}
              hasCustomPreferences={assetPreferences.hasCustomPreferences}
              rejectsAllProjectTokens={assetPreferences.rejectsAllProjectTokens}
              labels={{
                tabTitle: t("assetPreferences"),
                title: t("panels.assetPreferences.title"),
                description: t("panels.assetPreferences.description"),
                defaultsBadge: t("panels.assetPreferences.defaultsBadge"),
                customBadge: t("panels.assetPreferences.customBadge"),
                planningNote: t("panels.assetPreferences.planningNote"),
                rejectAllWarningTitle: t("panels.assetPreferences.rejectAllWarningTitle"),
                rejectAllWarningBody: t("panels.assetPreferences.rejectAllWarningBody"),
                usingDefaultsTitle: t("panels.assetPreferences.usingDefaultsTitle"),
                usingDefaultsBody: t("panels.assetPreferences.usingDefaultsBody"),
                rank: t("panels.assetPreferences.rank"),
                assetType: t("panels.assetPreferences.assetType"),
                assetCode: t("panels.assetPreferences.assetCode"),
                projectId: t("panels.assetPreferences.projectId"),
                projectIdPlaceholder: t("panels.assetPreferences.projectIdPlaceholder"),
                accepted: t("panels.assetPreferences.accepted"),
                acceptedHint: t("panels.assetPreferences.acceptedHint"),
                addStablecoin: t("panels.assetPreferences.addStablecoin"),
                addFiat: t("panels.assetPreferences.addFiat"),
                addProjectToken: t("panels.assetPreferences.addProjectToken"),
                moveUp: t("panels.assetPreferences.moveUp"),
                moveDown: t("panels.assetPreferences.moveDown"),
                remove: t("panels.assetPreferences.remove"),
                resetDefaults: t("panels.assetPreferences.resetDefaults"),
                save: t("panels.assetPreferences.save"),
                saving: t("panels.assetPreferences.saving"),
                validationTitle: t("panels.assetPreferences.validationTitle"),
                validationAssetCode: t("panels.assetPreferences.validationAssetCode"),
                validationProjectId: t("panels.assetPreferences.validationProjectId"),
                successTitle: t("panels.assetPreferences.successTitle"),
                successDescription: t("panels.assetPreferences.successDescription"),
                failureTitle: t("panels.assetPreferences.failureTitle"),
                typeLabels: {
                  stablecoin: t("panels.assetPreferences.typeLabels.stablecoin"),
                  fiat: t("panels.assetPreferences.typeLabels.fiat"),
                  project_token: t("panels.assetPreferences.typeLabels.project_token"),
                },
              }}
            />
          </TabsContent>
        </Tabs>
      </section>
    </div>
  )
}
