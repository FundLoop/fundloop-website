import type { ReactNode } from "react"
import { AppShell } from "@/components/app-shell"
import { getNavigationContext } from "@/lib/navigation-context"

type AppLayoutProps = {
  children: ReactNode
}

export default async function AppLayout({ children }: AppLayoutProps) {
  const navigationContext = await getNavigationContext()

  return <AppShell navigationContext={navigationContext}>{children}</AppShell>
}
