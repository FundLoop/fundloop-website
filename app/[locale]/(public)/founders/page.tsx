import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { getTranslations } from "next-intl/server"
import { Link } from "@/i18n/navigation"
import { ArrowRight, BriefcaseBusiness, Wallet, Waves } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { isValidLocale } from "@/i18n/routing"

type PageProps = {
  params: Promise<{ locale: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: "metadata.founders" })

  return {
    title: t("title"),
    description: t("description"),
  }
}

export default async function FoundersPage({ params }: PageProps) {
  const { locale } = await params
  if (!isValidLocale(locale)) {
    notFound()
  }

  const t = await getTranslations({ locale, namespace: "founders" })

  const cards = [
    {
      icon: BriefcaseBusiness,
      title: t("cards.commitment.title"),
      description: t("cards.commitment.description"),
    },
    {
      icon: Wallet,
      title: t("cards.operations.title"),
      description: t("cards.operations.description"),
    },
    {
      icon: Waves,
      title: t("cards.cadence.title"),
      description: t("cards.cadence.description"),
    },
  ]

  return (
    <div className="bg-[radial-gradient(circle_at_top,rgba(204,92,44,0.16),transparent_42%)]">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-12 px-4 py-16 sm:px-6 lg:px-8">
        <section className="rounded-[calc(var(--radius-2xl)+0.4rem)] border border-[color:var(--marketing-line)] bg-[rgba(255,248,238,0.86)] p-8 shadow-[0_28px_80px_rgba(15,23,23,0.1)] backdrop-blur-xl dark:bg-[rgba(13,21,21,0.88)]">
          <div className="max-w-3xl space-y-5">
            <p className="text-[0.72rem] font-semibold uppercase tracking-[0.28em] text-[var(--marketing-accent)]">{t("eyebrow")}</p>
            <h1 className="font-display text-5xl leading-tight tracking-[var(--tracking-display)] text-[var(--marketing-ink)] dark:text-[var(--marketing-paper)]">
              {t("title")}
            </h1>
            <p className="max-w-2xl text-base leading-8 text-[var(--marketing-muted-strong)]">{t("body")}</p>
            <div className="flex flex-wrap gap-3 pt-2">
              <Button asChild className="rounded-full bg-[var(--marketing-accent)] px-6 text-white hover:bg-[color:var(--marketing-accent)]/90">
                <Link href="/?onboarding=project">
                  {t("primaryCta")}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button asChild variant="ghost" className="rounded-full border border-[color:var(--marketing-line)]">
                <Link href="/documentation">{t("secondaryCta")}</Link>
              </Button>
            </div>
          </div>
        </section>

        <section className="grid gap-6 md:grid-cols-3">
          {cards.map((card) => (
            <Card key={card.title} className="border-[color:var(--marketing-line)] bg-[rgba(255,248,238,0.9)] dark:bg-[rgba(13,21,21,0.9)]">
              <CardHeader>
                <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-full border border-[color:var(--marketing-line)] bg-[rgba(204,92,44,0.12)] text-[var(--marketing-accent)]">
                  <card.icon className="h-5 w-5" />
                </div>
                <CardTitle>{card.title}</CardTitle>
                <CardDescription>{card.description}</CardDescription>
              </CardHeader>
            </Card>
          ))}
        </section>
      </div>
    </div>
  )
}
