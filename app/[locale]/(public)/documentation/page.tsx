import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import { ArrowRight } from "lucide-react"
import { Link } from "@/i18n/navigation"
import { getDocumentationHubData } from "@/lib/public-content"
import { Button } from "@/components/ui/button"
import Markdown from "@/components/markdown"
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
  searchParams: Promise<{ article?: string }>
}

type DocumentationItem = {
  title: string
  body: string
}

function formatDate(locale: string, dateString: string) {
  return new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date(dateString))
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: "metadata.documentation" })

  return {
    title: t("title"),
    description: t("description"),
  }
}

export default async function DocumentationPage({ params, searchParams }: PageProps) {
  const { locale } = await params
  const { article } = await searchParams
  const t = await getTranslations({ locale, namespace: "documentationPage" })
  const shellT = await getTranslations({ locale, namespace: "shell" })
  const { categories, posts } = await getDocumentationHubData()

  const aboutItems = t.raw("sections.about.items") as DocumentationItem[]
  const usingItems = t.raw("sections.using.items") as DocumentationItem[]
  const integrationItems = t.raw("sections.integrations.items") as DocumentationItem[]

  const activePost = posts.find((post) => post.slug === article) ?? posts[0] ?? null

  return (
    <MarketingPage>
      <MarketingSection className="pt-10">
        <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(19rem,0.72fr)]">
          <Reveal>
            <SectionEyebrow>{t("hero.eyebrow")}</SectionEyebrow>
            <SectionTitle className="mt-4 max-w-4xl text-5xl sm:text-6xl lg:text-7xl">{t("hero.title")}</SectionTitle>
            <SectionBody className="mt-6 max-w-2xl">{t("hero.body")}</SectionBody>
          </Reveal>

          <Reveal delay={120}>
            <div className="rounded-[2rem] border border-[color:var(--marketing-line)] bg-[linear-gradient(135deg,rgba(255,248,238,0.82),rgba(182,221,214,0.22))] p-6 dark:bg-[linear-gradient(135deg,rgba(14,22,22,0.92),rgba(182,221,214,0.08))] sm:p-8">
              <p className="text-[0.68rem] font-semibold uppercase tracking-[0.28em] text-[var(--marketing-muted)]">
                {t("sections.support.eyebrow")}
              </p>
              <p className="mt-5 text-sm leading-7 text-[var(--marketing-muted-strong)]">{t("sections.support.body")}</p>
            </div>
          </Reveal>
        </div>
      </MarketingSection>

      <MarketingSection id="about-fundloop" className="border-y border-[color:var(--marketing-line)] bg-white/34 dark:bg-white/[0.02]">
        <div className="grid gap-12 lg:grid-cols-[minmax(0,0.82fr)_minmax(0,1.18fr)]">
          <Reveal className="lg:sticky lg:top-28 lg:self-start">
            <SectionEyebrow>{t("sections.about.eyebrow")}</SectionEyebrow>
            <SectionTitle className="mt-4 text-5xl sm:text-6xl">{t("sections.about.title")}</SectionTitle>
            <SectionBody className="mt-5">{t("sections.about.body")}</SectionBody>
          </Reveal>

          <div className="space-y-5">
            {aboutItems.map((item, index) => (
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

      <MarketingSection id="using-fundloop">
        <div className="grid gap-12 lg:grid-cols-[minmax(0,0.82fr)_minmax(0,1.18fr)]">
          <Reveal className="lg:sticky lg:top-28 lg:self-start">
            <SectionEyebrow>{t("sections.using.eyebrow")}</SectionEyebrow>
            <SectionTitle className="mt-4 text-5xl sm:text-6xl">{t("sections.using.title")}</SectionTitle>
            <SectionBody className="mt-5">{t("sections.using.body")}</SectionBody>
          </Reveal>

          <div className="space-y-5">
            {usingItems.map((item, index) => (
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

      <MarketingSection id="protocol-and-integrations" className="border-y border-[color:var(--marketing-line)] bg-white/34 dark:bg-white/[0.02]">
        <div className="grid gap-12 lg:grid-cols-[minmax(0,0.82fr)_minmax(0,1.18fr)]">
          <Reveal className="lg:sticky lg:top-28 lg:self-start">
            <SectionEyebrow>{t("sections.integrations.eyebrow")}</SectionEyebrow>
            <SectionTitle className="mt-4 text-5xl sm:text-6xl">{t("sections.integrations.title")}</SectionTitle>
            <SectionBody className="mt-5">{t("sections.integrations.body")}</SectionBody>
          </Reveal>

          <div className="space-y-5">
            {integrationItems.map((item, index) => (
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

      <MarketingSection id="support-articles" className="pb-24 pt-12">
        <div className="grid gap-8 lg:grid-cols-[18rem_minmax(0,1fr)]">
          <Reveal>
            <aside className="rounded-[2rem] border border-[color:var(--marketing-line)] bg-white/52 p-5 dark:bg-white/[0.03] lg:sticky lg:top-28">
              <p className="text-[0.68rem] font-semibold uppercase tracking-[0.28em] text-[var(--marketing-muted)]">
                {t("sections.support.browseTopics")}
              </p>
              {categories.length === 0 ? (
                <p className="mt-5 text-sm text-[var(--marketing-muted-strong)]">
                  {posts.length === 0 ? t("sections.support.empty") : t("sections.support.unavailable")}
                </p>
              ) : (
                <div className="mt-6 space-y-6">
                  {categories.map((category) => (
                    <div key={category}>
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--marketing-muted)]">{category}</p>
                      <div className="mt-3 space-y-2">
                        {posts
                          .filter((post) => post.category === category)
                          .map((post) => (
                            <Link
                              key={post.id}
                              href={`/documentation?article=${post.slug}#support-articles`}
                              className={`block rounded-2xl border px-4 py-3 text-sm transition-colors ${
                                activePost?.slug === post.slug
                                  ? "border-[color:var(--marketing-line-strong)] bg-[rgba(204,92,44,0.12)] text-[var(--marketing-accent)]"
                                  : "border-[color:var(--marketing-line)] bg-transparent text-[var(--marketing-muted-strong)] hover:bg-black/[0.03] dark:hover:bg-white/[0.04]"
                              }`}
                            >
                              {post.title}
                            </Link>
                          ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </aside>
          </Reveal>

          <Reveal delay={100}>
            <div className="rounded-[2rem] border border-[color:var(--marketing-line)] bg-white/58 p-6 shadow-[0_24px_70px_rgba(15,23,23,0.08)] dark:bg-white/[0.03] sm:p-8">
              {activePost ? (
                <article>
                  <header className="border-b border-[color:var(--marketing-line)] pb-6">
                    <p className="text-[0.68rem] font-semibold uppercase tracking-[0.28em] text-[var(--marketing-muted)]">
                      {activePost.category || t("sections.support.eyebrow")}
                    </p>
                    <h1 className="mt-4 font-display text-4xl leading-none tracking-[-0.04em] sm:text-5xl">{activePost.title}</h1>
                    {activePost.subtitle ? (
                      <p className="mt-4 text-lg leading-7 text-[var(--marketing-muted-strong)]">{activePost.subtitle}</p>
                    ) : null}
                    {activePost.updatedAt ? (
                      <p className="mt-4 text-sm text-[var(--marketing-muted)]">
                        {t("sections.support.updatedLabel", { date: formatDate(locale, activePost.updatedAt) })}
                      </p>
                    ) : null}
                  </header>

                  <div className="mt-8">
                    <Markdown content={activePost.content} />
                  </div>
                </article>
              ) : (
                <div>
                  <SectionEyebrow>{t("sections.support.eyebrow")}</SectionEyebrow>
                  <SectionTitle className="mt-4 text-4xl sm:text-5xl">{t("sections.support.title")}</SectionTitle>
                  <SectionBody className="mt-5 max-w-2xl">
                    {posts.length === 0 ? t("sections.support.unavailable") : t("sections.support.chooseArticle")}
                  </SectionBody>
                  <div className="mt-8 flex flex-col gap-4 sm:flex-row">
                    <Button
                      asChild
                      size="lg"
                      className="rounded-full bg-[var(--marketing-accent)] px-7 text-white hover:bg-[color:var(--marketing-accent)]/92"
                    >
                      <Link href="/support">
                        {shellT("nav.primary.support")}
                        <ArrowRight className="h-4 w-4" />
                      </Link>
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </Reveal>
        </div>
      </MarketingSection>
    </MarketingPage>
  )
}
