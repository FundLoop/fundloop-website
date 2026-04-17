import { redirect } from "next/navigation"
import { getTranslations } from "next-intl/server"
import { Link } from "@/i18n/navigation"
import { getNavigationContext } from "@/lib/navigation-context"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

type WorkspacePageProps = {
  params: Promise<{ locale: string }>
}

export default async function WorkspacePage({ params }: WorkspacePageProps) {
  const { locale } = await params
  const navigationContext = await getNavigationContext()
  const t = await getTranslations("workspace")

  if (!navigationContext.isAuthenticated) {
    redirect(`/${locale}/join`)
  }

  const cards = [
    {
      title: t("cards.account.title"),
      description: t("cards.account.description"),
      href: "/workspace/account",
    },
    {
      title: t("cards.participation.title"),
      description: t("cards.participation.description"),
      href: "/participation",
    },
    {
      title: t("cards.results.title"),
      description: t("cards.results.description"),
      href: "/settings/zkas",
    },
  ]

  if (navigationContext.hasFounderAccess) {
    cards.push({
      title: t("cards.founder.title"),
      description: t("cards.founder.description"),
      href: "/founder",
    })
  }

  return (
    <div className="space-y-8">
      <section className="rounded-[calc(var(--radius-2xl)+0.25rem)] border border-[color:var(--surface-border)] bg-[var(--surface-panel)] p-8 shadow-[var(--surface-shadow-panel)]">
        <div className="max-w-3xl space-y-4">
          <p className="text-[0.72rem] font-semibold uppercase tracking-[0.28em] text-[var(--interactive-primary)]">{t("eyebrow")}</p>
          <h1 className="text-4xl font-semibold tracking-[var(--tracking-display)] text-[var(--text-strong)]">
            {t("title")}
          </h1>
          <p className="max-w-2xl text-base leading-7 text-[var(--text-muted)]">{t("body")}</p>
        </div>
      </section>

      <section className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <Link key={card.href} href={card.href} className="block">
            <Card className="h-full bg-[var(--surface-panel-strong)] transition-transform duration-200 hover:-translate-y-0.5 hover:border-[color:var(--surface-border-strong)] hover:shadow-[var(--surface-shadow-panel)]">
              <CardHeader>
                <CardTitle>{card.title}</CardTitle>
                <CardDescription>{card.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <span className="text-sm font-semibold text-[var(--interactive-primary)]">{t("open")}</span>
              </CardContent>
            </Card>
          </Link>
        ))}
      </section>
    </div>
  )
}
