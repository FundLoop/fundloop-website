"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase"
import Markdown from "@/components/markdown"
import { MarketingPage, MarketingSection, SectionBody, SectionEyebrow, SectionTitle } from "@/components/marketing/page-chrome"
import { Reveal } from "@/components/marketing/reveal"

interface DocPost {
  id: number
  title: string
  subtitle: string | null
  slug: string
  excerpt: string
  content: string
  category: string | null
  picture: string | null
  published_at: string | null
  created_at: string | null
  updated_at: string | null
  sort_order_within_category: number | null
}

function formatDate(dateString: string) {
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date(dateString))
}

export default function DocumentationPage() {
  const supabaseConfigured = isSupabaseConfigured()
  const [posts, setPosts] = useState<DocPost[]>([])
  const [loading, setLoading] = useState(supabaseConfigured)
  const [currentSlug, setCurrentSlug] = useState<string | null>(null)
  const getSupabase = () => getSupabaseBrowserClient()

  useEffect(() => {
    if (!supabaseConfigured) {
      return
    }

    const fetchDocs = async () => {
      const supabase = getSupabase()
      setLoading(true)
      const { data } = await supabase
        .from("blog_posts")
        .select(
          "id, title, subtitle, slug, excerpt, content, category, picture, published_at, created_at, updated_at, sort_order_within_category"
        )
        .eq("is_support", true)

      setPosts(data || [])
      setLoading(false)
    }

    void fetchDocs()
  }, [supabaseConfigured])

  const categories = useMemo(() => {
    return Array.from(new Set(posts.map((post) => post.category).filter(Boolean)))
      .sort((a, b) => (b ?? "").localeCompare(a ?? ""))
      .filter((category): category is string => Boolean(category))
  }, [posts])

  const postsByCategory = useMemo(() => {
    const map: Record<string, DocPost[]> = {}
    categories.forEach((category) => {
      map[category] = posts
        .filter((post) => post.category === category)
        .sort((a, b) => {
          const aOrder = a.sort_order_within_category
          const bOrder = b.sort_order_within_category

          if (aOrder != null && bOrder != null) return aOrder - bOrder
          if (aOrder != null) return -1
          if (bOrder != null) return 1

          return (a.created_at || "").localeCompare(b.created_at || "")
        })
    })
    return map
  }, [posts, categories])

  const flatPosts = useMemo(() => categories.flatMap((category) => postsByCategory[category]), [categories, postsByCategory])
  const activeSlug = currentSlug ?? flatPosts[0]?.slug ?? null
  const currentPost = flatPosts.find((post) => post.slug === activeSlug) ?? null

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
              Back to home
            </Link>
          </Button>
        </Reveal>
      </MarketingSection>

      <MarketingSection className="pt-0">
        <Reveal>
          <SectionEyebrow>Documentation</SectionEyebrow>
          <SectionTitle className="mt-4 max-w-5xl text-5xl sm:text-6xl lg:text-7xl">
            Guides and support articles for navigating FundLoop.
          </SectionTitle>
          <SectionBody className="mt-6 max-w-3xl">
            Browse help content by category, then read the article that best matches the part of the product you are
            trying to understand or troubleshoot.
          </SectionBody>
        </Reveal>
      </MarketingSection>

      <MarketingSection className="pb-24 pt-12">
        <div className="grid gap-8 lg:grid-cols-[18rem_minmax(0,1fr)]">
          <Reveal>
            <aside className="rounded-[2rem] border border-[color:var(--marketing-line)] bg-white/52 p-5 dark:bg-white/[0.03] lg:sticky lg:top-28">
              <p className="text-[0.68rem] font-semibold uppercase tracking-[0.28em] text-[var(--marketing-muted)]">
                Browse topics
              </p>
              {loading ? (
                <p className="mt-5 text-sm text-[var(--marketing-muted-strong)]">Loading articles...</p>
              ) : !supabaseConfigured ? (
                <p className="mt-5 text-sm text-[var(--marketing-muted-strong)]">
                  Documentation content needs a configured Supabase backend in this local environment.
                </p>
              ) : categories.length === 0 ? (
                <p className="mt-5 text-sm text-[var(--marketing-muted-strong)]">No documentation articles are published yet.</p>
              ) : (
                <div className="mt-6 space-y-6">
                  {categories.map((category) => (
                    <div key={category}>
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--marketing-muted)]">
                        {category}
                      </p>
                      <div className="mt-3 space-y-2">
                        {postsByCategory[category].map((post) => (
                          <button
                            key={post.id}
                            type="button"
                            onClick={() => setCurrentSlug(post.slug)}
                            className={`w-full rounded-2xl border px-4 py-3 text-left text-sm transition-colors ${
                              activeSlug === post.slug
                                ? "border-[color:var(--marketing-line-strong)] bg-[rgba(204,92,44,0.12)] text-[var(--marketing-accent)]"
                                : "border-[color:var(--marketing-line)] bg-transparent text-[var(--marketing-muted-strong)] hover:bg-black/[0.03] dark:hover:bg-white/[0.04]"
                            }`}
                          >
                            {post.title}
                          </button>
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
              {loading ? (
                <p className="text-sm text-[var(--marketing-muted-strong)]">Loading article...</p>
              ) : !supabaseConfigured ? (
                <p className="text-sm text-[var(--marketing-muted-strong)]">
                  Configure Supabase environment variables to load live documentation content locally.
                </p>
              ) : currentPost ? (
                <article>
                  <header className="border-b border-[color:var(--marketing-line)] pb-6">
                    <p className="text-[0.68rem] font-semibold uppercase tracking-[0.28em] text-[var(--marketing-muted)]">
                      {currentPost.category || "Documentation"}
                    </p>
                    <h1 className="mt-4 font-display text-4xl leading-none tracking-[-0.04em] sm:text-5xl">
                      {currentPost.title}
                    </h1>
                    {currentPost.subtitle ? (
                      <p className="mt-4 text-lg leading-7 text-[var(--marketing-muted-strong)]">{currentPost.subtitle}</p>
                    ) : null}
                    {currentPost.updated_at ? (
                      <p className="mt-4 text-sm text-[var(--marketing-muted)]">
                        Last updated {formatDate(currentPost.updated_at)}
                      </p>
                    ) : null}
                  </header>

                  <div className="prose prose-slate mt-8 max-w-none dark:prose-invert">
                    <Markdown content={currentPost.content} />
                  </div>
                </article>
              ) : (
                <p className="text-sm text-[var(--marketing-muted-strong)]">Choose an article from the left to begin.</p>
              )}
            </div>
          </Reveal>
        </div>
      </MarketingSection>
    </MarketingPage>
  )
}
