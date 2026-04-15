import type { ReactNode } from "react"
import Footer from "@/components/footer"
import Navbar from "@/components/navbar"
import { getNavigationContext } from "@/lib/navigation-context"

export default async function PublicLayout({ children }: { children: ReactNode }) {
  const navigationContext = await getNavigationContext()

  return (
    <>
      <Navbar navigationContext={navigationContext} />
      <main className="min-h-screen">{children}</main>
      <Footer />
    </>
  )
}
