import type { Metadata } from "next"
import Image from "next/image"
import { getTranslations } from "next-intl/server"
import { ArrowRight, Search } from "lucide-react"
import { Link } from "@/i18n/navigation"
import { getPublicBlogPosts } from "@/lib/public-content"
import { Input } from "@/components/ui/input"
import {
  MarketingPage,
  MarketingSection,
  SectionBody,
  SectionEyebrow,
  SectionTitle,
} from "@/components/marketing/page-chrome"
import { Reveal } from "@/components/marketing/reveal"

const DEFAULT_PICTURE =
  "https://kyxtqnfnksvcaugxwzuj.supabase.co/storage/v1/object/public/blog-pics//introducing-fundloop.png"

type PageProps = {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ q?: string }>
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
  const t = await getTranslations({ locale, namespace: "metadata.blog" })

  return {
    title: t("title"),
    description: t("description"),
  }
}

export default async function BlogPage({ params, searchParams }: PageProps) {
  const { locale } = await params
  const { q } = await searchParams
  const t = await getTranslations({ locale, namespace: "blogPage" })
  const posts = await getPublicBlogPosts(q)

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
            <form action="" className="rounded-[2rem] border border-[color:var(--marketing-line)] bg-white/58 p-6 shadow-[0_24px_70px_rgba(15,23,23,0.08)] dark:bg-white/[0.03] sm:p-8">
              <label
                htmlFor="blog-search"
                className="text-[0.68rem] font-semibold uppercase tracking-[0.28em] text-[var(--marketing-muted)]"
              >
                {t("searchPlaceholder")}
              </label>
              <div className="relative mt-4">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--marketing-muted)]" />
                <Input
                  id="blog-search"
                  name="q"
                  defaultValue={q ?? ""}
                  placeholder={t("searchPlaceholder")}
                  className="h-12 rounded-full pl-11"
                />
              </div>
            </form>
          </Reveal>
        </div>
      </MarketingSection>

      <MarketingSection className="pb-24 pt-8">
        {posts.length === 0 ? (
          <Reveal>
            <div className="rounded-[2rem] border border-[color:var(--marketing-line)] bg-white/58 p-8 text-center shadow-[0_24px_70px_rgba(15,23,23,0.08)] dark:bg-white/[0.03]">
              <SectionTitle className="text-4xl sm:text-5xl">{t("emptyTitle")}</SectionTitle>
              <SectionBody className="mx-auto mt-5 max-w-2xl">{t("emptyBody")}</SectionBody>
            </div>
          </Reveal>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {posts.map((post, index) => {
              const publishedLabel = post.publishedAt ? t("publishedLabel", { date: formatDate(locale, post.publishedAt!) }) : null

              return (
                <Reveal key={post.id} delay={index * 50}>
                  <article className="flex h-full flex-col rounded-[1.75rem] border border-[color:var(--marketing-line)] bg-white/58 p-5 shadow-[0_20px_60px_rgba(15,23,23,0.08)] dark:bg-white/[0.03]">
                    <div className="relative mb-5 aspect-[4/3] overflow-hidden rounded-[1.25rem]">
                      <Image src={post.picture || DEFAULT_PICTURE} alt={post.title} fill className="object-cover" />
                    </div>
                    <div className="flex flex-1 flex-col">
                      {publishedLabel ? (
                        <p className="text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-[var(--marketing-muted)]">
                          {publishedLabel}
                        </p>
                      ) : null}
                      <h2 className="mt-3 font-display text-3xl leading-none tracking-[-0.04em]">{post.title}</h2>
                      {post.subtitle ? (
                        <p className="mt-3 text-sm font-semibold uppercase tracking-[0.18em] text-[var(--marketing-accent)]">
                          {post.subtitle}
                        </p>
                      ) : null}
                      <p className="mt-4 flex-1 text-sm leading-6 text-[var(--marketing-muted-strong)]">{post.excerpt}</p>
                      <Link
                        href={`/blog/${post.slug}`}
                        className="mt-6 inline-flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.18em] text-[var(--marketing-accent)]"
                      >
                        {t("readArticle")}
                        <ArrowRight className="h-4 w-4" />
                      </Link>
                    </div>
                  </article>
                </Reveal>
              )
            })}
          </div>
        )}
      </MarketingSection>
    </MarketingPage>
  )
}
