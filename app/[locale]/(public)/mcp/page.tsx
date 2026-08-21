import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import { ArrowRight, ShieldCheck, Terminal, Waypoints } from "lucide-react"
import { Link } from "@/i18n/navigation"
import { Button } from "@/components/ui/button"
import {
  MarketingPage,
  MarketingSection,
  SectionBody,
  SectionEyebrow,
  SectionTitle,
} from "@/components/marketing/page-chrome"
import { Reveal } from "@/components/marketing/reveal"

type PageProps = {
  params: Promise<{ locale: string }>
}

type TextItem = {
  title: string
  body: string
}

type StatusItem = {
  label: string
  status: string
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: "metadata.mcp" })

  return {
    title: t("title"),
    description: t("description"),
  }
}

export default async function McpLandingPage({ params }: PageProps) {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: "mcpPage" })
  const tools = t.raw("tools.items") as TextItem[]
  const useCases = t.raw("useCases.items") as TextItem[]
  const directoryStatuses = t.raw("directories.items") as StatusItem[]
  const changelog = t.raw("changelog.items") as TextItem[]

  return (
    <MarketingPage>
      <MarketingSection className="pt-10">
        <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(20rem,0.72fr)]">
          <Reveal>
            <SectionEyebrow>{t("hero.eyebrow")}</SectionEyebrow>
            <SectionTitle className="mt-4 max-w-4xl text-5xl sm:text-6xl lg:text-7xl">{t("hero.title")}</SectionTitle>
            <SectionBody className="mt-6 max-w-2xl">{t("hero.body")}</SectionBody>
            <div className="mt-8 flex flex-col gap-4 sm:flex-row">
              <Button
                asChild
                size="lg"
                className="rounded-full bg-[var(--marketing-accent)] px-7 text-white hover:bg-[color:var(--marketing-accent)]/92"
              >
                <Link href="/documentation#protocol-and-integrations">
                  {t("hero.primaryCta")}
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="rounded-full border-[color:var(--marketing-line-strong)] bg-transparent px-7 hover:bg-black/[0.04] dark:hover:bg-white/[0.06]"
              >
                <Link href="/support">
                  {t("hero.secondaryCta")}
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </Reveal>

          <Reveal delay={120}>
            <div className="rounded-[2rem] border border-[color:var(--marketing-line)] bg-[linear-gradient(135deg,rgba(255,248,238,0.86),rgba(126,175,203,0.24))] p-6 dark:bg-[linear-gradient(135deg,rgba(14,22,22,0.94),rgba(126,175,203,0.1))] sm:p-8">
              <p className="text-[0.68rem] font-semibold uppercase tracking-[0.28em] text-[var(--marketing-muted)]">
                {t("connection.eyebrow")}
              </p>
              <code className="mt-5 block overflow-x-auto rounded-3xl border border-[color:var(--marketing-line)] bg-black/[0.04] p-4 text-sm leading-6 text-[var(--marketing-ink)] dark:bg-white/[0.05]">
                https://{"{supabase_project_ref}"}.supabase.co/functions/v1/mcp
              </code>
              <p className="mt-5 text-sm leading-7 text-[var(--marketing-muted-strong)]">{t("connection.body")}</p>
            </div>
          </Reveal>
        </div>
      </MarketingSection>

      <MarketingSection className="border-y border-[color:var(--marketing-line)] bg-white/34 dark:bg-white/[0.02]">
        <div className="grid gap-5 lg:grid-cols-3">
          {[
            { icon: Waypoints, title: t("status.transport.title"), body: t("status.transport.body") },
            { icon: ShieldCheck, title: t("status.auth.title"), body: t("status.auth.body") },
            { icon: Terminal, title: t("status.runtime.title"), body: t("status.runtime.body") },
          ].map((item, index) => {
            const Icon = item.icon
            return (
              <Reveal key={item.title} delay={index * 80}>
                <div className="h-full rounded-[1.5rem] border border-[color:var(--marketing-line)] bg-white/48 p-6 dark:bg-white/[0.03]">
                  <Icon className="h-7 w-7 text-[var(--marketing-accent)]" />
                  <h2 className="mt-5 text-2xl font-semibold tracking-[-0.04em]">{item.title}</h2>
                  <p className="mt-3 text-sm leading-7 text-[var(--marketing-muted-strong)]">{item.body}</p>
                </div>
              </Reveal>
            )
          })}
        </div>
      </MarketingSection>

      <MarketingSection id="supported-tools">
        <div className="grid gap-12 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
          <Reveal className="lg:sticky lg:top-28 lg:self-start">
            <SectionEyebrow>{t("tools.eyebrow")}</SectionEyebrow>
            <SectionTitle className="mt-4 text-5xl sm:text-6xl">{t("tools.title")}</SectionTitle>
            <SectionBody className="mt-5">{t("tools.body")}</SectionBody>
          </Reveal>
          <div className="space-y-5">
            {tools.map((item, index) => (
              <Reveal key={item.title} delay={index * 70}>
                <div className="border-t border-[color:var(--marketing-line)] pt-5">
                  <h2 className="text-2xl font-semibold tracking-[-0.04em] sm:text-3xl">{item.title}</h2>
                  <p className="mt-3 text-base leading-7 text-[var(--marketing-muted-strong)]">{item.body}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </MarketingSection>

      <MarketingSection id="connect" className="border-y border-[color:var(--marketing-line)] bg-white/34 dark:bg-white/[0.02]">
        <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,0.78fr)]">
          <Reveal>
            <SectionEyebrow>{t("instructions.eyebrow")}</SectionEyebrow>
            <SectionTitle className="mt-4 max-w-4xl text-5xl sm:text-6xl">{t("instructions.title")}</SectionTitle>
            <SectionBody className="mt-5 max-w-3xl">{t("instructions.body")}</SectionBody>
            <ol className="mt-8 space-y-4 text-base leading-7 text-[var(--marketing-muted-strong)]">
              {(t.raw("instructions.steps") as string[]).map((step, index) => (
                <li key={step} className="grid gap-4 rounded-3xl border border-[color:var(--marketing-line)] bg-white/45 p-5 dark:bg-white/[0.03] sm:grid-cols-[3rem_minmax(0,1fr)]">
                  <span className="font-display text-4xl leading-none text-[var(--marketing-accent)]">{index + 1}</span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
          </Reveal>

          <Reveal delay={120}>
            <div className="rounded-[2rem] border border-[color:var(--marketing-line)] bg-white/58 p-6 dark:bg-white/[0.03]">
              <p className="text-[0.68rem] font-semibold uppercase tracking-[0.28em] text-[var(--marketing-muted)]">
                {t("privacy.eyebrow")}
              </p>
              <h2 className="mt-4 text-3xl font-semibold tracking-[-0.04em]">{t("privacy.title")}</h2>
              <p className="mt-4 text-sm leading-7 text-[var(--marketing-muted-strong)]">{t("privacy.body")}</p>
              <Link href="/privacy" className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-[var(--marketing-accent)]">
                {t("privacy.cta")}
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </Reveal>
        </div>
      </MarketingSection>

      <MarketingSection>
        <Reveal>
          <SectionEyebrow>{t("useCases.eyebrow")}</SectionEyebrow>
          <SectionTitle className="mt-4 max-w-4xl text-5xl sm:text-6xl">{t("useCases.title")}</SectionTitle>
        </Reveal>
        <div className="mt-10 grid gap-5 lg:grid-cols-3">
          {useCases.map((item, index) => (
            <Reveal key={item.title} delay={index * 80}>
              <div className="h-full rounded-[1.5rem] border border-[color:var(--marketing-line)] bg-white/45 p-6 dark:bg-white/[0.03]">
                <h2 className="text-2xl font-semibold tracking-[-0.04em]">{item.title}</h2>
                <p className="mt-3 text-sm leading-7 text-[var(--marketing-muted-strong)]">{item.body}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </MarketingSection>

      <MarketingSection className="pb-24">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <Reveal>
            <div className="rounded-[2rem] border border-[color:var(--marketing-line)] bg-[linear-gradient(135deg,rgba(255,248,238,0.84),rgba(244,203,141,0.18))] p-8 dark:bg-[linear-gradient(135deg,rgba(18,27,25,0.94),rgba(239,139,87,0.1))]">
              <SectionEyebrow>{t("directories.eyebrow")}</SectionEyebrow>
              <SectionTitle className="mt-4 text-4xl sm:text-5xl">{t("directories.title")}</SectionTitle>
              <div className="mt-7 space-y-3">
                {directoryStatuses.map((item) => (
                  <div key={item.label} className="flex items-center justify-between gap-4 border-t border-[color:var(--marketing-line)] pt-3 text-sm">
                    <span className="font-semibold">{item.label}</span>
                    <span className="text-[var(--marketing-muted-strong)]">{item.status}</span>
                  </div>
                ))}
              </div>
            </div>
          </Reveal>

          <Reveal delay={120}>
            <div className="rounded-[2rem] border border-[color:var(--marketing-line)] bg-white/58 p-8 dark:bg-white/[0.03]">
              <SectionEyebrow>{t("changelog.eyebrow")}</SectionEyebrow>
              <SectionTitle className="mt-4 text-4xl sm:text-5xl">{t("changelog.title")}</SectionTitle>
              <div className="mt-7 space-y-5">
                {changelog.map((item) => (
                  <div key={item.title} className="border-t border-[color:var(--marketing-line)] pt-4">
                    <h2 className="text-xl font-semibold tracking-[-0.03em]">{item.title}</h2>
                    <p className="mt-2 text-sm leading-7 text-[var(--marketing-muted-strong)]">{item.body}</p>
                  </div>
                ))}
              </div>
              <p className="mt-7 text-sm text-[var(--marketing-muted-strong)]">
                {t("contact.label")}{" "}
                <a className="font-semibold text-[var(--marketing-accent)]" href="mailto:support@fundloop.org">
                  support@fundloop.org
                </a>
              </p>
            </div>
          </Reveal>
        </div>
      </MarketingSection>
    </MarketingPage>
  )
}
