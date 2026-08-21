import { redirect } from "next/navigation"
import { BookOpenCheck, BrainCircuit, CalendarClock, DollarSign, Eye, Fingerprint, Shield, Wallet } from "lucide-react"
import { Link } from "@/i18n/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { getNavigationContext } from "@/lib/navigation-context"

const summaryCards = [
  { title: "Total Revenue", value: "$1,245,000", note: "Across all projects" },
  { title: "Total Payments", value: "$15,675", note: "From all projects" },
  { title: "Active Projects", value: "112", note: "+7 this month" },
  { title: "Active Users", value: "36,500", note: "+13.7% from last month" },
] as const

const adminDestinations = [
  {
    title: "Payment Management",
    description: "Manage and confirm payments from projects",
    href: "/admin/payments",
    icon: DollarSign,
    cta: "View Payments",
    variant: "default" as const,
  },
  {
    title: "zkActivitySum",
    description: "Review monthly datasets and run privacy-preserving allocations",
    href: "/admin/zkas",
    icon: BrainCircuit,
    cta: "Open zkAS",
    variant: "secondary" as const,
  },
  {
    title: "Monthly Cycles",
    description: "Inspect the economic month records that anchor payments, reconciliation, zkAS, and reporting",
    href: "/admin/cycles",
    icon: CalendarClock,
    cta: "Open Cycles",
    variant: "outline" as const,
  },
  {
    title: "Wallet Deployments",
    description: "Audit wallet envs, manifests, and intake-contract sync state",
    href: "/admin/payments/deployments",
    icon: Wallet,
    cta: "Review Deployments",
    variant: "outline" as const,
  },
  {
    title: "Identity Health",
    description: "Review stale or failed CUBID sync state before identity-sensitive workflows depend on it",
    href: "/admin/identity",
    icon: Fingerprint,
    cta: "Open Identity Health",
    variant: "outline" as const,
  },
  {
    title: "Observability",
    description: "Inspect recent payment-flow failures, attempts, and operator context",
    href: "/admin/payments/observability",
    icon: Eye,
    cta: "Open Observability",
    variant: "secondary" as const,
  },
  {
    title: "Operations Runbook",
    description: "Use release, cycle, identity, payment, payout, and artifact checklists without relying on tribal knowledge",
    href: "/admin/operations",
    icon: BookOpenCheck,
    cta: "Open Runbook",
    variant: "outline" as const,
  },
  {
    title: "Superadmin Queue",
    description: "Review the restricted verification and publication work that still needs superadmin access",
    href: "/admin/superadmin",
    icon: Shield,
    cta: "Open Superadmin",
    variant: "secondary" as const,
  },
] as const

type AdminDashboardProps = {
  params: Promise<{ locale: string }>
}

export default async function AdminDashboard({ params }: AdminDashboardProps) {
  const { locale } = await params
  const navigationContext = await getNavigationContext()

  if (!navigationContext.isAuthenticated) {
    redirect(`/${locale}/join`)
  }

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,color-mix(in_srgb,var(--surface-canvas)_88%,transparent),transparent_32%)]">
      <div className="container mx-auto space-y-10 px-4 py-12">
        <section className="rounded-[calc(var(--radius-2xl)+0.25rem)] border border-[color:var(--surface-border)] bg-[var(--surface-panel)] p-8 shadow-[var(--surface-shadow-panel)] backdrop-blur-md">
          <div className="max-w-3xl space-y-4">
            <p className="text-[0.72rem] font-semibold uppercase tracking-[0.28em] text-[var(--interactive-primary)]">
              Operator workspace
            </p>
            <h1 className="text-4xl font-semibold tracking-[var(--tracking-display)] text-[var(--text-strong)]">
              Admin Dashboard
            </h1>
            <p className="max-w-2xl text-base leading-7 text-[var(--text-muted)]">
              Review platform operations, move through payment and zkAS workflows, and keep an eye on the network’s most
              important operational signals from one durable control surface.
            </p>
          </div>
        </section>

        <section className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
          {summaryCards.map((card) => (
            <Card key={card.title} className="bg-[var(--surface-panel-strong)]">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">{card.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-semibold tracking-tight text-[var(--text-strong)]">{card.value}</div>
                <p className="mt-2 text-xs uppercase tracking-[0.16em] text-[var(--text-soft)]">{card.note}</p>
              </CardContent>
            </Card>
          ))}
        </section>

        <section className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {adminDestinations.map((destination) => {
            const Icon = destination.icon

            return (
              <Card key={destination.href} className="h-full bg-[var(--surface-panel-strong)]">
                <CardHeader>
                  <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-full border border-[color:var(--surface-border)] bg-[var(--surface-inset)] text-[var(--interactive-primary)]">
                    <Icon className="h-5 w-5" />
                  </div>
                  <CardTitle>{destination.title}</CardTitle>
                  <CardDescription>{destination.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button asChild className="w-full" variant={destination.variant}>
                    <Link href={destination.href}>
                      <Icon className="mr-2 h-4 w-4" />
                      {destination.cta}
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            )
          })}
        </section>
      </div>
    </div>
  )
}
