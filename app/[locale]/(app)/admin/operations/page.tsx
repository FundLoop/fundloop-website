import { redirect } from "next/navigation"
import { AlertTriangle, BookOpenCheck, ClipboardCheck } from "lucide-react"
import { Link } from "@/i18n/navigation"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { getNavigationContext } from "@/lib/navigation-context"
import { OPERATIONS_RUNBOOK_SECTIONS, type OperationsRunbookSection } from "@/lib/operations/runbook"

type AdminOperationsPageProps = {
  params: Promise<{ locale: string }>
}

function statusVariant(status: OperationsRunbookSection["status"]) {
  if (status === "active") return "default" as const
  if (status === "watch") return "secondary" as const
  return "outline" as const
}

export default async function AdminOperationsPage({ params }: AdminOperationsPageProps) {
  const { locale } = await params
  const navigationContext = await getNavigationContext()

  if (!navigationContext.isAuthenticated) {
    redirect(`/${locale}/join`)
  }

  if (!navigationContext.hasAdminAccess) {
    redirect(`/${locale}/workspace`)
  }

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,color-mix(in_srgb,var(--surface-canvas)_88%,transparent),transparent_34%)]">
      <div className="container mx-auto space-y-8 px-4 py-12">
        <section className="rounded-[calc(var(--radius-2xl)+0.25rem)] border border-[color:var(--surface-border)] bg-[var(--surface-panel)] p-8 shadow-[var(--surface-shadow-panel)] backdrop-blur-md">
          <div className="max-w-3xl space-y-4">
            <p className="text-[0.72rem] font-semibold uppercase tracking-[0.28em] text-[var(--interactive-primary)]">
              Operator runbook
            </p>
            <h1 className="text-4xl font-semibold tracking-[var(--tracking-display)] text-[var(--text-strong)]">
              Operations checklist
            </h1>
            <p className="max-w-2xl text-base leading-7 text-[var(--text-muted)]">
              Use this page as the first stop for release health, monthly-cycle execution, identity sync issues, payment
              incidents, payout readiness, and artifact evidence. It points to the live control surfaces and the durable
              engineering docs that explain each boundary.
            </p>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          {OPERATIONS_RUNBOOK_SECTIONS.map((section) => (
            <Card key={section.id} className="bg-[var(--surface-panel-strong)]">
              <CardHeader className="space-y-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={statusVariant(section.status)}>{section.status}</Badge>
                  <Badge variant="outline">{section.owner}</Badge>
                </div>
                <div>
                  <CardTitle className="text-2xl">{section.title}</CardTitle>
                  <CardDescription className="mt-2 text-sm leading-6">{section.description}</CardDescription>
                </div>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="rounded-2xl border border-[color:var(--surface-border)] bg-[var(--surface-inset)] p-4">
                  <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-[var(--text-strong)]">
                    <ClipboardCheck className="h-4 w-4 text-[var(--interactive-primary)]" />
                    Checks before action
                  </div>
                  <ul className="space-y-2 text-sm leading-6 text-[var(--text-muted)]">
                    {section.checks.map((check) => (
                      <li key={check} className="flex gap-2">
                        <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--interactive-primary)]" />
                        <span>{check}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="rounded-2xl border border-amber-500/25 bg-amber-500/10 p-4 text-sm leading-6 text-[var(--text-muted)]">
                  <div className="mb-2 flex items-center gap-2 font-semibold text-[var(--text-strong)]">
                    <AlertTriangle className="h-4 w-4 text-amber-600" />
                    Escalation rule
                  </div>
                  {section.escalation}
                </div>

                <div className="flex flex-wrap gap-3">
                  <Button asChild>
                    <Link href={section.primaryActionHref}>{section.primaryActionLabel}</Link>
                  </Button>
                  {section.secondaryActionHref ? (
                    <Button asChild variant="outline">
                      <Link href={section.secondaryActionHref}>{section.secondaryActionLabel}</Link>
                    </Button>
                  ) : null}
                </div>

                <div className="flex items-center gap-2 rounded-2xl border border-[color:var(--surface-border)] px-4 py-3 text-xs text-[var(--text-soft)]">
                  <BookOpenCheck className="h-4 w-4 text-[var(--interactive-primary)]" />
                  Engineering reference: <code>{section.docsPath}</code>
                </div>
              </CardContent>
            </Card>
          ))}
        </section>
      </div>
    </div>
  )
}
