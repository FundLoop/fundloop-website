"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { getSupabaseBrowserClient } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import { ThemeToggle } from "@/components/theme-toggle"
import { AuthModal } from "@/components/auth-modal"
import ResourcesDropdown from "@/components/resources-dropdown"
import UseCasesDropdown from "@/components/use-cases-dropdown"
import { CircleDollarSign, ChevronDown, User, Settings, LogOut } from "lucide-react"
import { MobileMenu } from "@/components/mobile-menu"
import { useCaseLinks } from "@/lib/use-cases"
import { cn } from "@/lib/utils"

export default function Navbar() {
  const [session, setSession] = useState<any>(null)
  const [user, setUser] = useState<{ full_name: string | null; avatar_url: string | null; status: string | null } | null>(
    null,
  )
  const [loading, setLoading] = useState(true)
  const [showAuthModal, setShowAuthModal] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const pathname = usePathname()
  const router = useRouter()

  const openOnboarding = () => {
    const params = new URLSearchParams(window.location.search)
    params.set("onboarding", "user")
    const query = params.toString()
    router.push(query ? `${pathname}?${query}` : pathname, { scroll: false })
  }

  useEffect(() => {
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

    fetchUser()

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
  }, [router])

  const handleSignOut = async () => {
    const supabase = getSupabaseBrowserClient()
    await supabase.auth.signOut()
    setSession(null)
    setUser(null)
    router.refresh()
  }

  const navLinks = [
    { label: "Projects", href: "/projects" },
    { label: "Users", href: "/users" },
    { label: "Analytics", href: "/analytics" },
    { label: "Blog", href: "/blog" },
  ]

  const exploreLinks = [
    {
      label: "Projects",
      href: "/projects",
      description: "Browse aligned projects participating in the FundLoop ecosystem.",
    },
    {
      label: "Users",
      href: "/users",
      description: "See the people shaping the network and participating across projects.",
    },
    {
      label: "Analytics",
      href: "/analytics",
      description: "Understand how contributions, activity, and citizen salary flow through the system.",
    },
    {
      label: "About FundLoop",
      href: "/about",
      description: "Learn the mission, model, and long-term vision behind FundLoop.",
    },
  ]

  const desktopNavItemClass =
    "h-9 rounded-full px-4 text-sm font-medium transition-colors data-[state=open]:bg-emerald-50 data-[state=open]:text-emerald-700 dark:data-[state=open]:bg-emerald-950/40 dark:data-[state=open]:text-emerald-300"

  return (
    <>
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur">
        <div className="container flex h-16 items-center justify-between px-4">
          <Link href="/" className="flex items-center gap-2">
            <CircleDollarSign className="h-6 w-6 text-emerald-600" />
            <span className="font-bold text-xl hidden sm:inline">FundLoop</span>
            <span className="relative left-1 top-1 hidden text-[0.7rem] font-medium italic tracking-[0.08em] text-[#5a1f1f] sm:inline dark:text-[#d6a3a3]">
              Coming Soon
            </span>
          </Link>

          <div className="hidden md:flex items-center rounded-full border border-slate-200/80 bg-white/80 px-2 py-1 shadow-sm dark:border-slate-800 dark:bg-slate-950/70">
            <UseCasesDropdown triggerClassName={desktopNavItemClass} />

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className={desktopNavItemClass}>
                  Explore <ChevronDown className="h-4 w-4 ml-1" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-[30rem] max-w-[calc(100vw-2rem)] p-2">
                <div className="grid gap-1 sm:grid-cols-2">
                {exploreLinks.map((link) => (
                  <DropdownMenuItem key={link.href} asChild className="p-0">
                    <Link
                      href={link.href}
                      className={`flex min-h-24 flex-col items-start rounded-sm px-3 py-3 outline-none transition-colors hover:bg-accent ${
                        pathname === link.href ? "text-emerald-600" : ""
                      }`}
                    >
                      <span className="text-sm font-semibold">{link.label}</span>
                      <span className="mt-1 text-xs leading-5 text-muted-foreground">{link.description}</span>
                    </Link>
                  </DropdownMenuItem>
                ))}
                </div>
              </DropdownMenuContent>
            </DropdownMenu>

            {navLinks.slice(3).map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "inline-flex h-9 items-center rounded-full px-4 text-sm font-medium transition-colors",
                  pathname === link.href
                    ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                    : "text-muted-foreground hover:bg-slate-100 hover:text-foreground dark:hover:bg-slate-900",
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
              <Button className="bg-emerald-600 text-white hover:bg-emerald-700" onClick={() => setShowAuthModal(true)}>
                Authenticate
              </Button>
            ) : user?.status !== "active" ? (
              <div className="flex items-center gap-2">
                <Button className="bg-emerald-600 text-white hover:bg-emerald-700" onClick={openOnboarding}>
                  Continue onboarding
                </Button>
                <Button variant="ghost" size="icon" onClick={() => void handleSignOut()}>
                  <LogOut className="h-4 w-4" />
                  <span className="sr-only">Log out</span>
                </Button>
              </div>
            ) : (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="h-8 w-8 p-0 rounded-full">
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
                      My Profile
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/settings">
                      <Settings className="mr-2 h-4 w-4" />
                      Settings
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleSignOut}>
                    <LogOut className="mr-2 h-4 w-4" />
                    Log out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            {/* Mobile hamburger icon */}
            <MobileMenu setMobileMenuOpen={setMobileMenuOpen} />
          </div>
        </div>
      </header>

      {/* Mobile menu modal */}
      <MobileMenu
        mobileMenuOpen={mobileMenuOpen}
        setMobileMenuOpen={setMobileMenuOpen}
        navLinks={navLinks}
        useCaseLinks={useCaseLinks.map(({ href, shortLabel }) => ({ href, label: shortLabel }))}
      />
      <AuthModal open={showAuthModal} onClose={() => setShowAuthModal(false)} />
    </>
  )
}
