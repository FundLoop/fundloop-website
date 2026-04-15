import { redirect } from "next/navigation"
import { getTranslations } from "next-intl/server"
import { AccountSettingsPanel } from "@/components/account/account-settings-panel"
import { getNavigationContext } from "@/lib/navigation-context"

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
