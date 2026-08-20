"use client"

import { useMemo, useState } from "react"
import { useTranslations } from "next-intl"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { AuthModal } from "@/components/auth-modal"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Link, usePathname, useRouter } from "@/i18n/navigation"
import type { NavigationContext } from "@/lib/navigation-context"
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase"
import { BriefcaseBusiness, LogOut, Shield, User } from "lucide-react"

type ShellAuthControlsProps = {
  navigationContext: NavigationContext
  variant: "public" | "app"
  showQuickLinks?: boolean
}

function getQuickDestinations(t: ReturnType<typeof useTranslations>, context: NavigationContext) {
  return [
    context.hasWorkspaceAccess
      ? {
          href: "/workspace",
          label: t("nav.workspace"),
          icon: User,
        }
      : null,
    context.hasFounderAccess
      ? {
          href: "/founder",
          label: t("nav.founder"),
          icon: BriefcaseBusiness,
        }
      : null,
    context.hasAdminAccess
      ? {
          href: "/admin",
          label: t("nav.admin"),
          icon: Shield,
        }
      : null,
  ].filter(Boolean) as { href: string; label: string; icon: typeof User }[]
}

export function ShellAuthControls({ navigationContext, variant, showQuickLinks = false }: ShellAuthControlsProps) {
  const t = useTranslations("shell")
  const pathname = usePathname()
  const router = useRouter()
  const [showAuthModal, setShowAuthModal] = useState(false)
  const supabaseConfigured = isSupabaseConfigured()

  const quickDestinations = useMemo(() => getQuickDestinations(t, navigationContext), [navigationContext, t])

  const openOnboarding = () => {
    const params = new URLSearchParams(window.location.search)
    params.set("onboarding", "user")
    const query = params.toString()
    router.push(query ? `${pathname}?${query}` : pathname, { scroll: false })
  }

  const handleSignOut = async () => {
    if (!supabaseConfigured) {
      return
    }

    const supabase = getSupabaseBrowserClient()
    await supabase.auth.signOut()
    router.refresh()
  }

  const actionButtonClass =
    variant === "public"
      ? "rounded-full border border-[color:var(--marketing-line)] bg-[var(--surface-panel)] text-[var(--marketing-ink)] hover:bg-[var(--surface-panel-strong)]"
      : "rounded-full border border-[color:var(--surface-border)] bg-[var(--surface-panel)] text-[var(--text-strong)] hover:bg-[var(--surface-panel-strong)]"

  if (!navigationContext.isAuthenticated) {
    return (
      <>
        <Button
          className="rounded-full border border-transparent bg-[var(--marketing-accent)] px-5 text-white hover:bg-[color:var(--marketing-accent)]/90"
          disabled={!supabaseConfigured}
          onClick={() => setShowAuthModal(true)}
        >
          {supabaseConfigured ? t("nav.authenticate") : t("nav.authUnavailable")}
        </Button>
        <AuthModal open={showAuthModal} onClose={() => setShowAuthModal(false)} />
      </>
    )
  }

  if (navigationContext.user?.status !== "active") {
    return (
      <div className="flex items-center gap-2">
        <Button
          className="rounded-full border border-transparent bg-[var(--marketing-accent)] px-5 text-white hover:bg-[color:var(--marketing-accent)]/90"
          onClick={openOnboarding}
        >
          {t("nav.continueOnboarding")}
        </Button>
        <Button variant="ghost" size="icon" className={actionButtonClass} onClick={() => void handleSignOut()}>
          <LogOut className="h-4 w-4" />
          <span className="sr-only">{t("nav.logout")}</span>
        </Button>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2">
      {showQuickLinks
        ? quickDestinations.map((destination) => (
            <Button key={destination.href} asChild variant="ghost" className={`${actionButtonClass} hidden md:inline-flex`}>
              <Link href={destination.href}>{destination.label}</Link>
            </Button>
          ))
        : null}

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className={`h-10 w-10 rounded-full p-0 ${variant === "app" ? actionButtonClass : ""}`}>
            <Avatar className="h-10 w-10">
              <AvatarImage src={navigationContext.user?.avatarUrl || "/placeholder.svg"} />
              <AvatarFallback>{navigationContext.user?.fullName?.slice(0, 2) || "FL"}</AvatarFallback>
            </Avatar>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          <div className="px-3 py-2">
            <p className="text-sm font-medium">{navigationContext.user?.fullName || t("nav.accountFallback")}</p>
            <p className="text-xs text-muted-foreground">{navigationContext.user?.email}</p>
          </div>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link href="/workspace">{t("nav.workspace")}</Link>
          </DropdownMenuItem>
          {navigationContext.hasFounderAccess ? (
            <DropdownMenuItem asChild>
              <Link href="/founder">{t("nav.founder")}</Link>
            </DropdownMenuItem>
          ) : null}
          {navigationContext.hasAdminAccess ? (
            <DropdownMenuItem asChild>
              <Link href="/admin">{t("nav.admin")}</Link>
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuItem asChild>
            <Link href="/workspace/account">{t("nav.account")}</Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => void handleSignOut()}>{t("nav.logout")}</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <AuthModal open={showAuthModal} onClose={() => setShowAuthModal(false)} />
    </div>
  )
}
