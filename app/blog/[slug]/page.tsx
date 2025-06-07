"use client"

import { useEffect, useState, useRef } from "react"
import { useParams, useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs"
import { Button } from "@/components/ui/button"
import { ArrowLeft } from "lucide-react"
import ArticlePage from "@/components/ArticlePage"
import type { Database, Tables } from "@/types/supabase"

type BlogPost = Tables<"blog_posts">

export default function BlogPostPage() {
  const params = useParams()
  const router = useRouter()
  const slug = params.slug as string
  const searchParams = useSearchParams()
  const origin = searchParams.get("origin")
  const benefitsSection = useRef<HTMLDivElement>(null)

  const [post, setPost] = useState<BlogPost | null>(null)
  const [loading, setLoading] = useState(true)
  const [showBack, setShowBack] = useState(true)
  const supabase = createClientComponentClient<Database>()

  useEffect(() => {
    const fetchPost = async () => {
      setLoading(true)

      try {
        const { data, error } = await supabase
          .from("blog_posts")
          .select("id, title, subtitle, content, picture, published_at")
          .eq("slug", slug)
          .eq("is_support", false)
          .single()

        if (error) throw error

        setPost(data)
      } catch (err) {
        console.error("Error fetching blog post:", err)
        router.push("/blog")
      } finally {
        setLoading(false)
      }
    }

    if (slug) {
      fetchPost()
    }
  }, [slug, supabase, router])

  // Restore scroll position on mount and save on unmount
  useEffect(() => {
    const saved = localStorage.getItem(`blog-scroll-${slug}`)
    if (saved) {
      window.scrollTo(0, parseInt(saved, 10))
    } else {
      window.scrollTo(0, 0)
    }

    const saveScroll = () => {
      localStorage.setItem(`blog-scroll-${slug}`, String(window.scrollY))
    }

    window.addEventListener("beforeunload", saveScroll)

    return () => {
      saveScroll()
      window.removeEventListener("beforeunload", saveScroll)
    }
  }, [slug])

  // Show/hide back button based on scroll direction
  useEffect(() => {
    let last = window.scrollY
    const onScroll = () => {
      const current = window.scrollY
      if (current > last + 10) {
        setShowBack(false)
      } else if (current < last - 10) {
        setShowBack(true)
      }
      last = current
    }
    window.addEventListener("scroll", onScroll)
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    }).format(date)
  }

  const handleBackToBenefits = () => {
    router.push("/")
    // Wait for the homepage to load, then scroll to the benefits section
    setTimeout(() => {
      const benefitsSection = document.getElementById("benefits")
      if (benefitsSection) {
        benefitsSection.scrollIntoView({ behavior: "smooth", block: "start" })
      }
    }, 50) // A short delay to allow the homepage to render
  }

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-12">
        <div className="flex items-center gap-2 mb-8">
          <Button asChild variant="ghost" size="sm" className="gap-1">
            <Link href="/blog">
              <ArrowLeft className="h-4 w-4" />
              <span>Back to Blog</span>
            </Link>
          </Button>
        </div>
        <div className="max-w-3xl mx-auto">
          <div className="h-10 w-3/4 bg-slate-200 dark:bg-slate-700 rounded mb-4" />
          <div className="h-4 w-24 bg-slate-200 dark:bg-slate-700 rounded mb-8" />
          <div className="space-y-4">
            <div className="h-4 w-full bg-slate-200 dark:bg-slate-700 rounded" />
            <div className="h-4 w-full bg-slate-200 dark:bg-slate-700 rounded" />
            <div className="h-4 w-3/4 bg-slate-200 dark:bg-slate-700 rounded" />
          </div>
        </div>
      </div>
    )
  }

  if (!post) {
    return (
      <div className="container mx-auto px-4 py-12">
        <div className="flex items-center gap-2 mb-8">
          <Button asChild variant="ghost" size="sm" className="gap-1">
            <Link href="/blog">
              <ArrowLeft className="h-4 w-4" />
              <span>Back to Blog</span>
            </Link>
          </Button>
        </div>
        <div className="max-w-3xl mx-auto text-center">
          <h1 className="text-2xl font-bold mb-4">Post Not Found</h1>
          <p className="mb-6">The blog post you're looking for doesn't exist or has been removed.</p>
          <Button asChild>
            <Link href="/blog">Back to Blog</Link>
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-12">
      <ArticlePage
        post={post}
        backHref={origin === "benefits" ? "/" : "/blog"}
        backText={origin === "benefits" ? "Back to Benefits" : "Back to Blog"}
        showBack={showBack}
        onBack={origin === "benefits" ? handleBackToBenefits : undefined}
      />
    </div>
  )
}
