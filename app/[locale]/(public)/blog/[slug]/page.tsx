import type { Metadata } from "next"
import Image from "next/image"
import { notFound } from "next/navigation"
import { getTranslations } from "next-intl/server"
import { ArrowLeft } from "lucide-react"
import { Link } from "@/i18n/navigation"
import { getPublicBlogPostBySlug } from "@/lib/public-content"
import { Button } from "@/components/ui/button"
import Markdown from "@/components/markdown"
import { MarketingPage, MarketingSection, SectionBody, SectionEyebrow, SectionTitle } from "@/components/marketing/page-chrome"
import { Reveal } from "@/components/marketing/reveal"

const DEFAULT_PICTURE =
  "https://kyxtqnfnksvcaugxwzuj.supabase.co/storage/v1/object/public/blog-pics//introducing-fundloop.png"

type PageProps = {
  params: Promise<{ locale: string; slug: string }>
  searchParams: Promise<{ origin?: string }>
}

function formatDate(locale: string, dateString: string) {
  return new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date(dateString))
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale, slug } = await params
  const t = await getTranslations({ locale, namespace: "metadata.blogPost" })
  const post = await getPublicBlogPostBySlug(slug)

  if (!post) {
    return {
      title: t("missingTitle"),
      description: t("missingDescription"),
    }
  }

  return {
    title: t("title", { title: post.title }),
    description: t("description", { excerpt: post.excerpt }),
  }
}

export default async function BlogPostPage({ params, searchParams }: PageProps) {
  const { locale, slug } = await params
  const { origin } = await searchParams
  const t = await getTranslations({ locale, namespace: "blogPostPage" })
  const post = await getPublicBlogPostBySlug(slug)

  if (!post) {
    notFound()
  }

  const backHref = origin === "benefits" ? "/" : "/blog"
  const backText = origin === "benefits" ? t("backToHome") : t("backToBlog")

  return (
    <MarketingPage>
      <MarketingSection className="pb-10 pt-10">
        <Reveal>
          <Button
            asChild
            variant="ghost"
            className="rounded-full px-0 text-[var(--marketing-muted-strong)] hover:bg-transparent hover:text-[var(--marketing-accent)]"
          >
            <Link href={backHref}>
              <ArrowLeft className="h-4 w-4" />
              {backText}
            </Link>
          </Button>
        </Reveal>
      </MarketingSection>

      <MarketingSection className="pt-0">
        <div className="mx-auto max-w-4xl">
          <Reveal>
            <SectionEyebrow>{t("publishedLabel", { date: formatDate(locale, post.publishedAt ?? post.createdAt ?? new Date().toISOString()) })}</SectionEyebrow>
            <SectionTitle className="mt-4 max-w-4xl text-5xl sm:text-6xl lg:text-7xl">{post.title}</SectionTitle>
            {post.subtitle ? <SectionBody className="mt-6 max-w-3xl">{post.subtitle}</SectionBody> : null}
          </Reveal>

          <Reveal delay={120}>
            <div className="relative mt-10 aspect-[16/9] overflow-hidden rounded-[2rem] border border-[color:var(--marketing-line)]">
              <Image src={post.picture || DEFAULT_PICTURE} alt={post.title} fill className="object-cover" />
            </div>
          </Reveal>
        </div>
      </MarketingSection>

      <MarketingSection className="pb-24 pt-12">
        <Reveal>
          <article className="mx-auto max-w-3xl rounded-[2rem] border border-[color:var(--marketing-line)] bg-white/58 p-6 shadow-[0_24px_70px_rgba(15,23,23,0.08)] dark:bg-white/[0.03] sm:p-8">
            <Markdown content={post.content} />
          </article>
        </Reveal>
      </MarketingSection>
    </MarketingPage>
  )
}
