"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
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
import { CircleDollarSign, ChevronDown, User, Settings, LogOut } from "lucide-react"
import { MobileMenu } from "@/components/mobile-menu"
import { toast } from "@/components/ui/use-toast"
import { Modal } from "@/components/modal"
import UserSignupFlow from "@/components/user-signup-flow"

export default function Navbar() {
  const [session, setSession] = useState<any>(null)
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [showAuthModal, setShowAuthModal] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [signupStep, setSignupStep] = useState<number>(5)
  const [welcomeOpen, setWelcomeOpen] = useState(false)

  const pathname = usePathname()
  const router = useRouter()

  useEffect(() => {
    const fetchUser = async () => {
      const { data } = await supabase.auth.getSession()
      const activeSession = data.session
      setSession(activeSession)

      if (activeSession?.user?.id) {
        const { data: userData } = await supabase
          .from("users")
          .select("full_name, avatar_url, signup_step, signin_count")
          .eq("user_id", activeSession.user.id)
          .single()

        if (userData) {
          setUser({ full_name: userData.full_name, avatar_url: userData.avatar_url })
          setSignupStep(userData.signup_step ?? 1)
          const newCount = (userData.signin_count ?? 0) + 1
          await supabase
            .from("users")
            .update({ signin_count: newCount })
            .eq("user_id", activeSession.user.id)
          if (userData.signup_step === null || userData.signup_step < 5) {
            setWelcomeOpen(true)
          } else {
            handleSigninActions(newCount, activeSession.user.id)
          }
        }
      } else {
        setUser(null)
      }

      setLoading(false)
    }

    fetchUser()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_, newSession) => {
      setSession(newSession)
      if (newSession?.user?.id) {
        const { data } = await supabase
          .from("users")
          .select("full_name, avatar_url, signup_step, signin_count")
          .eq("user_id", newSession.user.id)
          .single()

        if (data) {
          setUser({ full_name: data.full_name, avatar_url: data.avatar_url })
          setSignupStep(data.signup_step ?? 1)
          const newCount = (data.signin_count ?? 0) + 1
          await supabase
            .from("users")
            .update({ signin_count: newCount })
            .eq("user_id", newSession.user.id)
          if (data.signup_step === null || data.signup_step < 5) {
            setWelcomeOpen(true)
          } else {
            handleSigninActions(newCount, newSession.user.id)
          }
        }
      } else {
        setUser(null)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    setSession(null)
    setUser(null)
    router.refresh()
  }

  const handleSigninActions = async (count: number, userId: string) => {
    if (count === 2) {
      toast({
        title: "Welcome back",
        description: "Please review your profile information",
      })
      router.push("/my-profile")
    }

    if (count === 3) {
      const { data } = await supabase
        .from("invitation_codes")
        .select("usage_count")
        .eq("created_by", userId)
      const invited = data?.some((c) => (c as any).usage_count > 0)
      if (!invited) {
        toast({
          title: "Invite friends",
          description: "Share your invite code with others!",
        })
        router.push("/my-profile")
      }
    }

    if (count === 6) {
      const missing: string[] = []
      const { data: profile } = await supabase
        .from("users")
        .select("avatar_url")
        .eq("user_id", userId)
        .single()
      if (!profile?.avatar_url) missing.push("profile picture")

      const { count: projectCount } = await supabase
        .from("user_project_participation")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
      if (!projectCount || projectCount === 0) missing.push("project membership")

      const { data: codes } = await supabase
        .from("invitation_codes")
        .select("usage_count")
        .eq("created_by", userId)
      const used = codes?.some((c) => (c as any).usage_count > 0)
      if (!used) missing.push("invite code usage")

      if (missing.length > 0) {
        toast({
          title: "Complete your profile",
          description: `Please add: ${missing.join(", ")}`,
        })
        router.push("/my-profile")
      }
    }
  }

  const navLinks = [
    { label: "Projects", href: "/projects" },
    { label: "Users", href: "/users" },
    { label: "Analytics", href: "/analytics" },
    { label: "About", href: "/about" },
    { label: "Blog", href: "/blog" },
  ]

  return (
    <>
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur">
        <div className="container flex h-16 items-center justify-between px-4">
          <Link href="/" className="flex items-center gap-2">
            <CircleDollarSign className="h-6 w-6 text-emerald-600" />
            <span className="font-bold text-xl hidden sm:inline">FundLoop</span>
          </Link>

          <div className="hidden md:flex items-center gap-6">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="text-sm font-medium">
                  Explore <ChevronDown className="h-4 w-4 ml-1" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                {navLinks.slice(0, 3).map((link) => (
                  <DropdownMenuItem key={link.href} asChild>
                    <Link href={link.href}>{link.label}</Link>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {navLinks.slice(3).map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`text-sm font-medium ${
                  pathname === link.href ? "text-emerald-600" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {link.label}
              </Link>
            ))}

            <ResourcesDropdown />
          </div>

          <div className="flex items-center gap-2">
            <ThemeToggle />

            {!session ? (
              <Button className="bg-emerald-600 text-white hover:bg-emerald-700" onClick={() => setShowAuthModal(true)}>
                Authenticate
              </Button>
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
      <MobileMenu mobileMenuOpen={mobileMenuOpen} setMobileMenuOpen={setMobileMenuOpen} navLinks={navLinks} />
      <AuthModal open={showAuthModal} onClose={() => setShowAuthModal(false)} />
      <Modal title="Welcome" isOpen={welcomeOpen} onClose={() => setWelcomeOpen(false)} size="lg">
        <UserSignupFlow onClose={() => setWelcomeOpen(false)} />
      </Modal>
    </>
  )
}
