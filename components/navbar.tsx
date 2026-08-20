"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"
import { CircleDollarSign } from "lucide-react"
import { Link, usePathname } from "@/i18n/navigation"
import { Button } from "@/components/ui/button"
import { MobileMenu } from "@/components/mobile-menu"
import { ShellAuthControls } from "@/components/shell-auth-controls"
import type { NavigationContext } from "@/lib/navigation-context"
import { publicPrimaryLinks } from "@/lib/public-site"
import { cn } from "@/lib/utils"

type NavbarProps = {
  navigationContext: NavigationContext
}

export default function Navbar({ navigationContext }: NavbarProps) {
  const t = useTranslations("shell")
  const pathname = usePathname()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const topLevelLinks = publicPrimaryLinks.map((link) => ({
    ...link,
    label: t(`nav.primary.${link.id}`),
  }))

  const mobileSections = [
    {
      title: t("mobile.public"),
      links: topLevelLinks,
    },
    navigationContext.isAuthenticated
      ? {
          title: t("mobile.workspace"),
          links: [
            { href: "/workspace", label: t("nav.workspace") },
            ...(navigationContext.hasFounderAccess ? [{ href: "/founder", label: t("nav.founder") }] : []),
            ...(navigationContext.hasAdminAccess ? [{ href: "/admin", label: t("nav.admin") }] : []),
            { href: "/workspace/account", label: t("nav.account") },
          ],
        }
      : null,
  ].filter(Boolean) as { title: string; links: { href: string; label: string }[] }[]

  return (
    <header className="sticky top-0 z-50 w-full px-3 py-3 sm:px-4">
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between rounded-full border border-[color:var(--marketing-line)] bg-[rgba(255,248,238,0.74)] px-3 shadow-[0_12px_40px_rgba(15,23,23,0.08)] backdrop-blur-xl dark:bg-[rgba(13,21,21,0.74)]">
        <Link href="/" className="flex items-center gap-3 rounded-full px-2 py-1">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[color:var(--marketing-line)] bg-[rgba(204,92,44,0.14)] text-[var(--marketing-accent)]">
            <CircleDollarSign className="h-5 w-5" />
          </span>
          <div className="hidden sm:block">
            <p className="font-display text-2xl leading-none tracking-[-0.04em]">FundLoop</p>
            <p className="mt-1 text-[0.6rem] font-semibold uppercase tracking-[0.28em] text-[var(--marketing-muted)]">
              {t("brandTagline")}
            </p>
          </div>
        </Link>

        <nav className="hidden items-center gap-1 rounded-full border border-[color:var(--marketing-line)] bg-white/55 px-2 py-1 dark:bg-white/[0.03] lg:flex">
          {topLevelLinks.map((link) => (
            <Button
              key={link.href}
              asChild
              variant="ghost"
              className={cn(
                "h-10 rounded-full px-4 text-sm font-medium",
                pathname === link.href
                  ? "bg-black/[0.04] text-[var(--marketing-accent)] dark:bg-white/[0.06]"
                  : "text-[var(--marketing-muted-strong)] hover:bg-black/[0.04] hover:text-[var(--marketing-ink)] dark:hover:bg-white/[0.06]",
              )}
            >
              <Link href={link.href}>{link.label}</Link>
            </Button>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <ShellAuthControls navigationContext={navigationContext} variant="public" showQuickLinks />
          <MobileMenu
            setMobileMenuOpen={setMobileMenuOpen}
            mobileMenuOpen={mobileMenuOpen}
            title="FundLoop"
            eyebrow={t("mobile.navigate")}
            sections={mobileSections}
          />
        </div>
      </div>
    </header>
  )
}
