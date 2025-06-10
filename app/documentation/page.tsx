"use client"

import { useEffect, useMemo, useState, useRef } from "react"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs"
import ArticlePage from "@/components/ArticlePage"
import { Button } from "@/components/ui/button"
import type { Database, Tables } from "@/types/supabase"

type DocPost = Tables<"blog_posts">

export default function DocumentationPage() {
  const [posts, setPosts] = useState<DocPost[]>([])
  const [loading, setLoading] = useState(true)
  const [currentSlug, setCurrentSlug] = useState<string | null>(null)
  const articleRef = useRef<HTMLDivElement>(null)
  const supabase = createClientComponentClient<Database>()

  useEffect(() => {
    const fetchDocs = async () => {
      setLoading(true)
      const { data, error } = await supabase
        .from("blog_posts")
        .select(
          "id, title, subtitle, slug, excerpt, content, category, picture, published_at, created_at, sort_order_within_category"
        )
        .eq("is_support", true)
      if (!error) setPosts(data || [])
      setLoading(false)
    }
    fetchDocs()
  }, [supabase])

  const categories = useMemo(() => {
    return Array.from(new Set(posts.map((p) => p.category).filter(Boolean)))
      .sort((a, b) => (b ?? "").localeCompare(a ?? ""))
      .filter((c): c is string => Boolean(c))
  }, [posts])

  const postsByCategory = useMemo(() => {
    const map: Record<string, DocPost[]> = {}
    categories.forEach((cat) => {
      map[cat] = posts
        .filter((p) => p.category === cat)
        .sort((a, b) => {
          const aOrder = a.sort_order_within_category
          const bOrder = b.sort_order_within_category
          if (aOrder != null && bOrder != null) return aOrder - bOrder
          if (aOrder != null) return -1
          if (bOrder != null) return 1
          const aDate = a.created_at || ""
          const bDate = b.created_at || ""
          return aDate.localeCompare(bDate)
        })
    })
    return map
  }, [posts, categories])

  const flatPosts = useMemo(() => {
    return categories.flatMap((cat) => postsByCategory[cat])
  }, [categories, postsByCategory])

  useEffect(() => {
    if (!currentSlug && flatPosts.length > 0) {
      setCurrentSlug(flatPosts[0].slug)
    }
  }, [flatPosts, currentSlug])

  const currentIndex = flatPosts.findIndex((p) => p.slug === currentSlug)
  const currentPost = currentIndex >= 0 ? flatPosts[currentIndex] : null
  const prevPost = currentIndex > 0 ? flatPosts[currentIndex - 1] : null
  const nextPost =
    currentIndex >= 0 && currentIndex < flatPosts.length - 1
      ? flatPosts[currentIndex + 1]
      : null

  return (
    <div className="container mx-auto px-4 py-12">
      <div className="flex items-center gap-2 mb-8">
        <Button asChild variant="ghost" size="sm" className="gap-1">
          <Link href="/">
            <ArrowLeft className="h-4 w-4" />
            <span>Back to Home</span>
          </Link>
        </Button>
      </div>
      <div className="grid md:grid-cols-[16rem_1fr] gap-8 h-[calc(100vh-12rem)]">
        <nav className="overflow-y-auto pr-4 space-y-4">
          {categories.map((cat) => (
            <div key={cat}>
              <p className="font-semibold capitalize mb-1">{cat}</p>
              <ul className="space-y-1 pl-2">
                {postsByCategory[cat].map((post) => (
                  <li key={post.id}>
                    <button
                      onClick={() => setCurrentSlug(post.slug)}
                      className={`text-left w-full hover:underline ${
                        currentSlug === post.slug
                          ? "text-emerald-600 dark:text-emerald-400 font-medium"
                          : ""
                      }`}
                    >
                      {post.title}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
        <div className="flex-1 overflow-y-auto" ref={articleRef}>
          {loading && <p>Loading...</p>}
          {!loading && currentPost && (
            <>
              <ArticlePage
                post={currentPost}
                backHref="/documentation"
                backText="Back to Support"
                showBack={false}
                showImage={false}
                dateKey="updated_at"
                datePrefix="Last edited: "
              />
              <div className="flex justify-between mt-8">
                <Button
                  variant="outline"
                  onClick={() => {
                    if (prevPost) {
                      setCurrentSlug(prevPost.slug)
                      articleRef.current?.scrollTo({ top: 0 })
                    }
                  }}
                  disabled={!prevPost}
                >
                  ← Back
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    if (nextPost) {
                      setCurrentSlug(nextPost.slug)
                      articleRef.current?.scrollTo({ top: 0 })
                    }
                  }}
                  disabled={!nextPost}
                >
                  Next Page →
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

