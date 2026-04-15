import Link from "next/link"
import { Bell, BrainCircuit, CreditCard, Mail, Shield, User, Wallet } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

// TODO(Session 03 IA): this hub is transitional; keep account/settings leaves, but move primary product actions into user and founder workspaces per `docs/engineering/information-architecture.md`.

const settingsCards = [
  {
    title: "Account",
    description: "Manage your account settings and preferences",
    body: "Update your profile information, change your password, and manage your account preferences.",
    href: "/settings/account",
    icon: User,
  },
  {
    title: "Email Addresses",
    description: "Manage your email addresses",
    body: "Add or remove email addresses, set your primary email, and manage email preferences.",
    href: "/settings/account",
    icon: Mail,
  },
  {
    title: "Wallet Addresses",
    description: "Manage your wallet addresses",
    body: "Add or remove wallet addresses, set your primary wallet for receiving payments.",
    href: "/settings/account",
    icon: Wallet,
  },
  {
    title: "Notifications",
    description: "Manage your notification preferences",
    body: "Control which notifications you receive and how they are delivered.",
    href: "/settings/notifications",
    icon: Bell,
  },
  {
    title: "zkAS Results",
    description: "View verified zkActivitySum publications",
    body: "Review published zkAS allocations once they have been verified and released by FundLoop superadmins.",
    href: "/settings/zkas",
    icon: BrainCircuit,
  },
  {
    title: "Security",
    description: "Manage your account security",
    body: "Update your password, enable two-factor authentication, and manage security settings.",
    href: "/settings/security",
    icon: Shield,
  },
] as const

export default function SettingsPage() {
  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,color-mix(in_srgb,var(--surface-canvas)_86%,transparent),transparent_36%)]">
      <div className="container mx-auto space-y-10 px-4 py-12">
        <section className="rounded-[calc(var(--radius-2xl)+0.25rem)] border border-[color:var(--surface-border)] bg-[var(--surface-panel)] p-8 shadow-[var(--surface-shadow-panel)] backdrop-blur-md">
          <div className="max-w-3xl space-y-4">
            <p className="text-[0.72rem] font-semibold uppercase tracking-[0.28em] text-[var(--interactive-primary)]">
              Account controls
            </p>
            <h1 className="text-4xl font-semibold tracking-[var(--tracking-display)] text-[var(--text-strong)]">Settings</h1>
            <p className="max-w-2xl text-base leading-7 text-[var(--text-muted)]">
              Manage the personal controls that still live in the shared settings hub while the wider user and founder
              workspaces are being refactored.
            </p>
          </div>
        </section>

        <div className="grid max-w-5xl gap-6 md:grid-cols-2">
          {settingsCards.map((item) => {
            const Icon = item.icon

            return (
              <Link key={item.title} href={item.href} className="block">
                <Card className="h-full bg-[var(--surface-panel-strong)] transition-transform duration-200 hover:-translate-y-0.5 hover:border-[color:var(--surface-border-strong)] hover:shadow-[var(--surface-shadow-panel)]">
                  <CardHeader>
                    <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-full border border-[color:var(--surface-border)] bg-[var(--surface-inset)] text-[var(--interactive-primary)]">
                      <Icon className="h-5 w-5" />
                    </div>
                    <CardTitle className="flex items-center gap-2">{item.title}</CardTitle>
                    <CardDescription>{item.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm leading-6 text-[var(--text-muted)]">{item.body}</p>
                  </CardContent>
                </Card>
              </Link>
            )
          })}

          <Card className="h-full border-dashed border-[color:var(--surface-border-strong)] bg-[var(--surface-subtle)]">
            <CardHeader>
              <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-full border border-[color:var(--surface-border)] bg-[var(--surface-inset)] text-[var(--interactive-primary)]">
                <CreditCard className="h-5 w-5" />
              </div>
              <CardTitle>Payments</CardTitle>
              <CardDescription>Project payment settings are moving into project-specific payment pages</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm leading-6 text-[var(--text-muted)]">
                Manage crypto collection routes from each project&apos;s payments screen for now. A dedicated account-level
                payments settings page is not live yet.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
