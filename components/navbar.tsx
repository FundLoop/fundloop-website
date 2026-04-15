"use client"

import { useEffect, useState } from "react"
import { useTranslations } from "next-intl"
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase"
import { Link, usePathname, useRouter } from "@/i18n/navigation"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ThemeToggle } from "@/components/theme-toggle"
import { AuthModal } from "@/components/auth-modal"
import ResourcesDropdown from "@/components/resources-dropdown"
import UseCasesDropdown from "@/components/use-cases-dropdown"
import { CircleDollarSign, ChevronDown, LogOut, Settings, User } from "lucide-react"
import { MobileMenu } from "@/components/mobile-menu"
import { useCaseLinks } from "@/lib/use-cases"
import { OPEN_USE_CASES_MENU_EVENT } from "@/lib/use-cases-nav"
import { cn } from "@/lib/utils"
import { publicExploreLinks, resourceLinks } from "@/lib/public-site"

type NavbarUser = {
  full_name: string | null
  avatar_url: string | null
  status: string | null
}

export default function Navbar() {
  const t = useTranslations("shell")
  const [session, setSession] = useState<any>(null)
  const [user, setUser] = useState<NavbarUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [showAuthModal, setShowAuthModal] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [useCasesOpen, setUseCasesOpen] = useState(false)

  const pathname = usePathname()
  const router = useRouter()
  const supabaseConfigured = isSupabaseConfigured()

  const openOnboarding = () => {
    const params = new URLSearchParams(window.location.search)
    params.set("onboarding", "user")
    const query = params.toString()
    router.push(query ? `${pathname}?${query}` : pathname, { scroll: false })
  }

  useEffect(() => {
    if (!supabaseConfigured) {
      setLoading(false)
      setSession(null)
      setUser(null)
      return
    }

    const fetchUser = async () => {
      const supabase = getSupabaseBrowserClient()
      const { data } = await supabase.auth.getSession()
      const activeSession = data.session
      setSession(activeSession)

      if (activeSession?.user?.id) {
        const { data: userData } = await supabase
          .from("users")
          .select("full_name, avatar_url, status")
          .eq("user_id", activeSession.user.id)
          .single()

        if (userData) {
          setUser({ full_name: userData.full_name, avatar_url: userData.avatar_url, status: userData.status })
        }
      } else {
        setUser(null)
      }

      setLoading(false)
    }

    void fetchUser()

    const supabase = getSupabaseBrowserClient()
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_, newSession) => {
      setSession(newSession)

      if (newSession?.user?.id) {
        const { data } = await supabase
          .from("users")
          .select("full_name, avatar_url, status")
          .eq("user_id", newSession.user.id)
          .single()

        if (data) {
          setUser({ full_name: data.full_name, avatar_url: data.avatar_url, status: data.status })
        }
      } else {
        setUser(null)
      }
    })

    return () => subscription.unsubscribe()
  }, [router, supabaseConfigured])

  useEffect(() => {
    const openUseCasesMenu = () => {
      if (window.matchMedia("(min-width: 1024px)").matches) {
        setMobileMenuOpen(false)
        setUseCasesOpen(true)
        return
      }

      setUseCasesOpen(false)
      setMobileMenuOpen(true)
    }

    window.addEventListener(OPEN_USE_CASES_MENU_EVENT, openUseCasesMenu)

    return () => window.removeEventListener(OPEN_USE_CASES_MENU_EVENT, openUseCasesMenu)
  }, [])

  const handleSignOut = async () => {
    if (!supabaseConfigured) {
      return
    }

    const supabase = getSupabaseBrowserClient()
    await supabase.auth.signOut()
    setSession(null)
    setUser(null)
    router.refresh()
  }

  const exploreLinks = publicExploreLinks.map((link) => ({
    ...link,
    label: t(`nav.exploreLinks.${link.id}.label`),
    description: t(`nav.exploreLinks.${link.id}.description`),
  }))
  const translatedResourceLinks = resourceLinks.map((link) => ({
    ...link,
    label: t(`nav.resourceLinks.${link.id}.label`),
    description: t(`nav.resourceLinks.${link.id}.description`),
  }))
  const topLevelLinks = [{ label: t("nav.blog"), href: "/blog" }]
  const mobileNavLinks = [...exploreLinks, { label: t("nav.blog"), href: "/blog" }]

  const desktopNavItemClass =
    "h-10 rounded-full px-4 text-sm font-medium text-[var(--marketing-muted-strong)] transition-colors data-[state=open]:bg-black/[0.04] data-[state=open]:text-[var(--marketing-ink)] dark:data-[state=open]:bg-white/[0.06] dark:data-[state=open]:text-[var(--marketing-paper)]"

  return (
    <>
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

          <div className="hidden items-center rounded-full border border-[color:var(--marketing-line)] bg-white/55 px-2 py-1 dark:bg-white/[0.03] lg:flex">
            <UseCasesDropdown open={useCasesOpen} onOpenChange={setUseCasesOpen} triggerClassName={desktopNavItemClass} />

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className={desktopNavItemClass}>
                  {t("nav.explore")} <ChevronDown className="ml-1 h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="start"
                className="w-[30rem] max-w-[calc(100vw-2rem)] rounded-[1.5rem] border-[color:var(--marketing-line)] bg-[rgba(255,248,238,0.94)] p-3 shadow-[0_30px_90px_rgba(15,23,23,0.14)] backdrop-blur-xl dark:bg-[rgba(13,21,21,0.95)]"
              >
                <div className="grid gap-1 sm:grid-cols-2">
                  {exploreLinks.map((link) => (
                    <DropdownMenuItem key={link.href} asChild className="p-0">
                      <Link
                        href={link.href}
                        className={`flex min-h-24 flex-col items-start rounded-2xl px-4 py-4 outline-none transition-transform duration-200 hover:-translate-y-0.5 hover:bg-black/[0.03] ${
                          pathname === link.href ? "text-[var(--marketing-accent)]" : ""
                        }`}
                      >
                        <span className="text-sm font-semibold uppercase tracking-[0.18em]">{link.label}</span>
                        <span className="mt-2 text-xs leading-5 text-[var(--marketing-muted-strong)]">{link.description}</span>
                      </Link>
                    </DropdownMenuItem>
                  ))}
                </div>
              </DropdownMenuContent>
            </DropdownMenu>

            {topLevelLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "inline-flex h-9 items-center rounded-full px-4 text-sm font-medium transition-colors",
                  pathname === link.href
                    ? "bg-black/[0.04] text-[var(--marketing-accent)] dark:bg-white/[0.06]"
                    : "text-[var(--marketing-muted-strong)] hover:bg-black/[0.04] hover:text-[var(--marketing-ink)] dark:hover:bg-white/[0.06] dark:hover:text-[var(--marketing-paper)]",
                )}
              >
                {link.label}
              </Link>
            ))}

            <ResourcesDropdown triggerClassName={desktopNavItemClass} />
          </div>

          <div className="flex items-center gap-2">
            <ThemeToggle />

            {!session ? (
              <Button
                className="rounded-full border border-transparent bg-[var(--marketing-accent)] px-5 text-white hover:bg-[color:var(--marketing-accent)]/90"
                disabled={!supabaseConfigured || loading}
                onClick={() => setShowAuthModal(true)}
              >
                {supabaseConfigured ? t("nav.authenticate") : t("nav.authUnavailable")}
              </Button>
            ) : user?.status !== "active" ? (
              <div className="flex items-center gap-2">
                <Button
                  className="rounded-full border border-transparent bg-[var(--marketing-accent)] px-5 text-white hover:bg-[color:var(--marketing-accent)]/90"
                  onClick={openOnboarding}
                >
                  {t("nav.continueOnboarding")}
                </Button>
                <Button variant="ghost" size="icon" onClick={() => void handleSignOut()}>
                  <LogOut className="h-4 w-4" />
                  <span className="sr-only">{t("nav.logout")}</span>
                </Button>
              </div>
            ) : (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="h-8 w-8 rounded-full p-0">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={user?.avatar_url || "/placeholder.svg"} />
                      <AvatarFallback>{user?.full_name?.substring(0, 2) || "U"}</AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <div className="px-3 py-2">
                    <p className="text-sm font-medium">{user?.full_name || "User"}</p>
                    <p className="text-xs text-muted-foreground">{session?.user?.email}</p>
                  </div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link href="/my-profile">
                      <User className="mr-2 h-4 w-4" />
                      {t("nav.myProfile")}
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/settings">
                      <Settings className="mr-2 h-4 w-4" />
                      {t("nav.settings")}
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleSignOut}>
                    <LogOut className="mr-2 h-4 w-4" />
                    {t("nav.logout")}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            <MobileMenu
              setMobileMenuOpen={setMobileMenuOpen}
              mobileMenuOpen={mobileMenuOpen}
              navLinks={mobileNavLinks}
              useCaseLinks={useCaseLinks}
              resourceLinks={translatedResourceLinks}
            />
          </div>
        </div>
      </header>
      <AuthModal open={showAuthModal} onClose={() => setShowAuthModal(false)} />
    </>
  )
}
