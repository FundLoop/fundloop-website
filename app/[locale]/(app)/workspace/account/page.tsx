import { redirect } from "next/navigation"
import { getTranslations } from "next-intl/server"
import { AccountSettingsPanel } from "@/components/account/account-settings-panel"
import { getNavigationContext } from "@/lib/navigation-context"
import { getUserAssetPreferenceReadiness } from "@/lib/workspace/user-asset-preferences"

type WorkspaceAccountPageProps = {
  params: Promise<{ locale: string }>
}

export default async function WorkspaceAccountPage({ params }: WorkspaceAccountPageProps) {
  const { locale } = await params
  const navigationContext = await getNavigationContext()
  const t = await getTranslations("workspaceAccount")

  if (!navigationContext.isAuthenticated) {
    redirect(`/${locale}/join`)
  }

  const assetPreferences = await getUserAssetPreferenceReadiness(navigationContext.user?.id)

  return (
    <AccountSettingsPanel
      heading={t("heading")}
      description={t("description")}
      cubid={{
        status: navigationContext.user?.cubidIdentityStatus ?? "unlinked",
        signedInEmail: navigationContext.user?.email ?? null,
        cubidId: navigationContext.user?.cubidId ?? null,
        cubidScore: navigationContext.user?.cubidScore ?? null,
        snapshot: navigationContext.user?.cubidSnapshot ?? null,
        managedIdentity: navigationContext.user?.managedIdentity ?? {
          fullName: { value: null, state: "pending" },
          primaryEmail: { value: null, state: "pending" },
          primaryPhone: { value: null, state: "pending" },
        },
        identityOwnership: navigationContext.user?.identityOwnership ?? {
          cubidManaged: [],
          fundloopManaged: [],
        },
        profileCompletionPercent: navigationContext.user?.profileCompletionPercent ?? 0,
        profileCompletionMissingItems: navigationContext.user?.profileCompletionMissingItems ?? [],
        cubidPassportOrigin: navigationContext.cubidPassportOrigin,
        cubidStampPageId: navigationContext.cubidStampPageId,
      }}
      localProfile={
        navigationContext.user?.localProfile ?? {
          displayName: null,
          profileHeadline: null,
          bio: null,
          occupationName: null,
          locationName: null,
          interestCount: 0,
          interestNames: [],
          visibility: {
            isPublic: false,
            isNamePublic: false,
            isPfpPublic: false,
            isGenderPublic: false,
            isOccupationPublic: false,
            isLocationPublic: false,
          },
        }
      }
      assetPreferences={{
        preferences: assetPreferences.preferences,
        defaultPreferences: assetPreferences.defaultPreferences,
        hasCustomPreferences: assetPreferences.hasCustomPreferences,
        rejectsAllProjectTokens: assetPreferences.rejectsAllProjectTokens,
      }}
    />
  )
}
