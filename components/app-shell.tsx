"use client"

import { useMemo, useState, type ReactNode } from "react"
import { useTranslations } from "next-intl"
import { BriefcaseBusiness, CircleDollarSign, LayoutGrid, Shield } from "lucide-react"
import { Link, usePathname } from "@/i18n/navigation"
import { Button } from "@/components/ui/button"
import { MobileMenu } from "@/components/mobile-menu"
import { ShellAuthControls } from "@/components/shell-auth-controls"
import { ThemeToggle } from "@/components/theme-toggle"
import type { NavigationContext } from "@/lib/navigation-context"
import { cn } from "@/lib/utils"

type AppShellProps = {
  children: ReactNode
  navigationContext: NavigationContext
}

function resolveSection(pathname: string) {
  if (pathname.startsWith("/admin")) {
    return "admin"
  }

  if (pathname.startsWith("/founder") || pathname.startsWith("/projects/") || pathname.startsWith("/organizations/")) {
    return "founder"
  }

  return "workspace"
}

export function AppShell({ children, navigationContext }: AppShellProps) {
  const t = useTranslations("shell")
  const pathname = usePathname()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const currentSection = resolveSection(pathname)

  const primaryLinks = useMemo(
    () =>
      [
        navigationContext.hasWorkspaceAccess
          ? {
              href: "/workspace",
              label: t("nav.workspace"),
              icon: LayoutGrid,
              active: currentSection === "workspace",
            }
          : null,
        navigationContext.hasFounderAccess
          ? {
              href: "/founder",
              label: t("nav.founder"),
              icon: BriefcaseBusiness,
              active: currentSection === "founder",
            }
          : null,
        navigationContext.hasAdminAccess
          ? {
              href: "/admin",
              label: t("nav.admin"),
              icon: Shield,
              active: currentSection === "admin",
            }
          : null,
      ].filter(Boolean) as { href: string; label: string; icon: typeof LayoutGrid; active: boolean }[],
    [currentSection, navigationContext.hasAdminAccess, navigationContext.hasFounderAccess, navigationContext.hasWorkspaceAccess, t],
  )

  const secondaryLinks = useMemo(() => {
    if (currentSection === "founder") {
      return [
        { href: "/founder", label: t("appShell.founder.overview") },
        { href: "/founder/projects", label: t("appShell.founder.projects") },
        { href: "/founder/account", label: t("appShell.founder.account") },
      ]
    }

    if (currentSection === "admin") {
      return [
        { href: "/admin", label: t("appShell.admin.overview") },
        { href: "/admin/cycles", label: t("appShell.admin.cycles") },
        { href: "/admin/payments", label: t("appShell.admin.payments") },
        { href: "/admin/zkas", label: t("appShell.admin.zkas") },
      ]
    }

    return [
      { href: "/workspace", label: t("appShell.workspace.overview") },
      { href: "/workspace/earnings", label: t("appShell.workspace.earnings") },
      { href: "/workspace/reporting", label: t("appShell.workspace.reporting") },
      { href: "/workspace/account", label: t("appShell.workspace.account") },
    ]
  }, [currentSection, t])

  const mobileSections = [
    {
      title: t("mobile.workspace"),
      links: primaryLinks.map(({ href, label }) => ({ href, label })),
    },
    {
      title: t("mobile.currentSection"),
      links: secondaryLinks,
    },
  ]

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,color-mix(in_srgb,var(--surface-canvas)_90%,transparent),transparent_26%)]">
      <header className="sticky top-0 z-40 border-b border-[color:var(--surface-border)] bg-[color:var(--surface-panel)]/92 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-4 py-4">
          <div className="flex min-w-0 items-center gap-4">
            <Link href="/workspace" className="flex items-center gap-3">
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-[color:var(--surface-border)] bg-[color:var(--interactive-primary)]/10 text-[var(--interactive-primary)]">
                <CircleDollarSign className="h-5 w-5" />
              </span>
              <div className="hidden sm:block">
                <p className="font-display text-2xl leading-none tracking-[var(--tracking-display)] text-[var(--text-strong)]">FundLoop</p>
                <p className="mt-1 text-[0.68rem] font-semibold uppercase tracking-[0.28em] text-[var(--text-soft)]">
                  {t("appShell.productShell")}
                </p>
              </div>
            </Link>
            <nav className="hidden items-center gap-2 lg:flex">
              {primaryLinks.map((link) => (
                <Button
                  key={link.href}
                  asChild
                  variant={link.active ? "default" : "ghost"}
                  className={cn(
                    "rounded-full",
                    link.active
                      ? "bg-[var(--interactive-primary)] text-white hover:bg-[color:var(--interactive-primary)]/90"
                      : "border border-[color:var(--surface-border)] bg-[var(--surface-panel-strong)] text-[var(--text-strong)] hover:bg-[var(--surface-panel)]",
                  )}
                >
                  <Link href={link.href}>
                    <link.icon className="mr-2 h-4 w-4" />
                    {link.label}
                  </Link>
                </Button>
              ))}
            </nav>
          </div>

          <div className="flex items-center gap-2">
            <ThemeToggle />
            <ShellAuthControls navigationContext={navigationContext} variant="app" />
            <MobileMenu
              setMobileMenuOpen={setMobileMenuOpen}
              mobileMenuOpen={mobileMenuOpen}
              title="FundLoop"
              eyebrow={t("mobile.navigate")}
              sections={mobileSections}
              triggerClassName="rounded-full border border-[color:var(--surface-border)] bg-[var(--surface-panel)] text-[var(--text-strong)] lg:hidden"
            />
          </div>
        </div>

        <div className="border-t border-[color:var(--surface-border)] bg-[var(--surface-subtle)]">
          <div className="mx-auto flex w-full max-w-7xl gap-2 overflow-x-auto px-4 py-3">
            {secondaryLinks.map((link) => (
              <Button
                key={link.href}
                asChild
                variant="ghost"
                className={cn(
                  "rounded-full border border-transparent px-4",
                  pathname === link.href
                    ? "border-[color:var(--surface-border-strong)] bg-[var(--surface-panel)] text-[var(--interactive-primary)]"
                    : "text-[var(--text-muted)] hover:bg-[var(--surface-panel)] hover:text-[var(--text-strong)]",
                )}
              >
                <Link href={link.href}>{link.label}</Link>
              </Button>
            ))}
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">{children}</main>
    </div>
  )
}
