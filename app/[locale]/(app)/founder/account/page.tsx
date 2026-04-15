import { redirect } from "next/navigation"
import { getTranslations } from "next-intl/server"
import { AccountSettingsPanel } from "@/components/account/account-settings-panel"
import { getNavigationContext } from "@/lib/navigation-context"

type FounderAccountPageProps = {
  params: Promise<{ locale: string }>
}

export default async function FounderAccountPage({ params }: FounderAccountPageProps) {
  const { locale } = await params
  const navigationContext = await getNavigationContext()
  const t = await getTranslations("founderAccount")

  if (!navigationContext.isAuthenticated) {
    redirect(`/${locale}/join`)
  }

  return (
    <AccountSettingsPanel
      heading={t("heading")}
      description={t("description")}
      cubid={{
        status: navigationContext.user?.cubidIdentityStatus ?? "unlinked",
        email: navigationContext.user?.email ?? null,
        cubidId: navigationContext.user?.cubidId ?? null,
        cubidScore: navigationContext.user?.cubidScore ?? null,
      }}
    />
  )
}
