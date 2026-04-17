import type { Metadata } from "next"
import Link from "next/link"
import { getTranslations } from "next-intl/server"
import { ArrowLeft, ExternalLink } from "lucide-react"
import { Link as LocaleLink } from "@/i18n/navigation"
import { Button } from "@/components/ui/button"
import { MarketingPage, MarketingSection, SectionBody, SectionEyebrow, SectionTitle } from "@/components/marketing/page-chrome"
import { Reveal } from "@/components/marketing/reveal"
import { ecosystemSites } from "@/lib/public-site"

type PageProps = {
  params: Promise<{ locale: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: "metadata.ecosystem" })

  return {
    title: t("title"),
    description: t("description"),
  }
}

export default async function EcosystemPage({ params }: PageProps) {
  await params
  const t = await getTranslations("ecosystemPage")

  return (
    <MarketingPage>
      <MarketingSection className="pb-10 pt-10">
        <Reveal>
          <Button
            asChild
            variant="ghost"
            className="rounded-full px-0 text-[var(--marketing-muted-strong)] hover:bg-transparent hover:text-[var(--marketing-accent)]"
          >
            <LocaleLink href="/">
              <ArrowLeft className="h-4 w-4" />
              {t("backToHome")}
            </LocaleLink>
          </Button>
        </Reveal>
      </MarketingSection>

      <MarketingSection className="pt-0">
        <Reveal>
          <SectionEyebrow>{t("hero.eyebrow")}</SectionEyebrow>
          <SectionTitle className="mt-4 max-w-5xl text-5xl sm:text-6xl lg:text-7xl">{t("hero.title")}</SectionTitle>
          <SectionBody className="mt-6 max-w-3xl">{t("hero.body")}</SectionBody>
        </Reveal>
      </MarketingSection>

      <MarketingSection className="border-y border-[color:var(--marketing-line)] bg-white/34 dark:bg-white/[0.02]">
        <div className="space-y-4">
          {ecosystemSites.map((site, index) => (
            <Reveal key={site.url} delay={index * 40}>
              <div className="grid gap-5 border-t border-[color:var(--marketing-line)] py-6 sm:grid-cols-[4rem_minmax(0,0.9fr)_minmax(0,1.1fr)_auto] sm:items-start">
                <p className="font-display text-4xl leading-none text-[var(--marketing-muted)]">{String(index + 1).padStart(2, "0")}</p>
                <Link
                  href={site.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group inline-flex items-start font-display text-3xl leading-none tracking-[-0.04em] transition-colors hover:text-[var(--marketing-accent)] sm:text-4xl"
                >
                  {site.name}
                </Link>
                <p className="max-w-2xl text-sm leading-6 text-[var(--marketing-muted-strong)]">{site.desc}</p>
                <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--marketing-accent)]">
                  {t("open")}
                  <ExternalLink className="h-3.5 w-3.5" />
                </span>
              </div>
            </Reveal>
          ))}
        </div>
      </MarketingSection>
    </MarketingPage>
  )
}
