import type { ReactNode } from "react"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Settings | FundLoop",
  description: "Manage your FundLoop account settings",
}

export default function SettingsLayout({ children }: { children: ReactNode }) {
  return <>{children}</>
}
