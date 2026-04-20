import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import { ArrowLeft, ArrowRight, Bot, Building2, Users } from "lucide-react"
import { Link } from "@/i18n/navigation"
import { Button } from "@/components/ui/button"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { MarketingPage, MarketingSection, SectionBody, SectionEyebrow, SectionTitle } from "@/components/marketing/page-chrome"
import { Reveal } from "@/components/marketing/reveal"

type PageProps = {
  params: Promise<{ locale: string }>
}

type FaqItem = {
  value: string
  question: string
  answer: string
}

function FAQSection({
  icon: Icon,
  title,
  description,
  items,
}: {
  icon: typeof Building2
  title: string
  description: string
  items: readonly FaqItem[]
}) {
  return (
    <div className="border-t border-[color:var(--marketing-line)] pt-6">
      <div className="mb-6 flex items-start gap-4">
        <span className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-[color:var(--marketing-line)] bg-white/55 dark:bg-white/[0.04]">
          <Icon className="h-4 w-4" />
        </span>
        <div>
          <h2 className="font-display text-4xl leading-none tracking-[-0.04em]">{title}</h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--marketing-muted-strong)]">{description}</p>
        </div>
      </div>

      <Accordion type="single" collapsible className="space-y-4">
        {items.map((faq) => (
          <AccordionItem key={faq.value} value={faq.value} className="border-b border-[color:var(--marketing-line)]">
            <AccordionTrigger className="py-5 text-left text-lg font-semibold tracking-[-0.02em] hover:no-underline">
              {faq.question}
            </AccordionTrigger>
            <AccordionContent className="pb-5 text-base leading-7 text-[var(--marketing-muted-strong)]">
              {faq.answer}
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  )
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: "metadata.faq" })

  return {
    title: t("title"),
    description: t("description"),
  }
}

export default async function FAQPage({ params }: PageProps) {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: "faqPage" })
  const projectFaqs = t.raw("sections.projects.items") as FaqItem[]
  const humanFaqs = t.raw("sections.humans.items") as FaqItem[]
  const botFaqs = t.raw("sections.bots.items") as FaqItem[]

  return (
    <MarketingPage>
      <MarketingSection className="pb-10 pt-10">
        <Reveal>
          <Button
            asChild
            variant="ghost"
            className="rounded-full px-0 text-[var(--marketing-muted-strong)] hover:bg-transparent hover:text-[var(--marketing-accent)]"
          >
            <Link href="/">
              <ArrowLeft className="h-4 w-4" />
              {t("backToHome")}
            </Link>
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
        <div className="space-y-12">
          <Reveal>
            <FAQSection
              icon={Building2}
              title={t("sections.projects.title")}
              description={t("sections.projects.description")}
              items={projectFaqs}
            />
          </Reveal>
          <Reveal delay={80}>
            <FAQSection
              icon={Users}
              title={t("sections.humans.title")}
              description={t("sections.humans.description")}
              items={humanFaqs}
            />
          </Reveal>
          <Reveal delay={160}>
            <FAQSection
              icon={Bot}
              title={t("sections.bots.title")}
              description={t("sections.bots.description")}
              items={botFaqs}
            />
          </Reveal>
        </div>
      </MarketingSection>

      <MarketingSection className="pb-24 pt-14">
        <Reveal>
          <div className="rounded-[2rem] border border-[color:var(--marketing-line)] bg-[linear-gradient(135deg,rgba(255,248,238,0.84),rgba(244,203,141,0.2))] p-8 dark:bg-[linear-gradient(135deg,rgba(18,27,25,0.94),rgba(239,139,87,0.12))] sm:p-10">
            <SectionEyebrow>{t("cta.eyebrow")}</SectionEyebrow>
            <SectionTitle className="mt-4 max-w-4xl text-5xl sm:text-6xl">{t("cta.title")}</SectionTitle>
            <SectionBody className="mt-5 max-w-3xl">{t("cta.body")}</SectionBody>
            <div className="mt-8 flex flex-col gap-4 sm:flex-row">
              <Button
                asChild
                variant="outline"
                size="lg"
                className="rounded-full border-[color:var(--marketing-line-strong)] bg-transparent px-7 hover:bg-black/[0.04] dark:hover:bg-white/[0.06]"
              >
                <Link href="/participation">{t("cta.participation")}</Link>
              </Button>
              <Button
                asChild
                variant="outline"
                size="lg"
                className="rounded-full border-[color:var(--marketing-line-strong)] bg-transparent px-7 hover:bg-black/[0.04] dark:hover:bg-white/[0.06]"
              >
                <Link href="/founders">{t("cta.founders")}</Link>
              </Button>
              <Button
                asChild
                size="lg"
                className="rounded-full bg-[var(--marketing-accent)] px-7 text-white hover:bg-[color:var(--marketing-accent)]/92"
              >
                <Link href="/support">
                  {t("cta.support")}
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
        </Reveal>
      </MarketingSection>
    </MarketingPage>
  )
}
