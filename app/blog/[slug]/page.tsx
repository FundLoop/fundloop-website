"use client"

import { useEffect, useState, useRef } from "react"
import { useParams, useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs"
import { Button } from "@/components/ui/button"
import { ArrowLeft } from "lucide-react"
import Markdown from "@/components/markdown"
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
      <div className="flex items-center gap-2 mb-8">
        {origin === "benefits" ? (
          <Button variant="ghost" size="sm" className="gap-1" onClick={handleBackToBenefits}>
            <ArrowLeft className="h-4 w-4" />
            <span>Back to Benefits</span>
          </Button>
        ) : (
          <Button asChild variant="ghost" size="sm" className="gap-1">
            <Link href="/blog">
              <ArrowLeft className="h-4 w-4" />
              <span>Back to Blog</span>
            </Link>
          </Button>
        )}
      </div>

      <article className="max-w-3xl mx-auto">
        {post.picture && (
          <div className="relative w-full h-60 mb-8">
            <Image src={post.picture} alt={post.title} fill className="object-cover rounded-md" />
          </div>
        )}
        <header className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold mb-2">{post.title}</h1>
          {post.subtitle && (
            <p className="text-slate-600 dark:text-slate-300 mb-2">{post.subtitle}</p>
          )}
          {post.published_at && (
            <p className="text-slate-600 dark:text-slate-300 text-sm">
              {formatDate(post.published_at)}
            </p>
          )}
        </header>

        <Markdown content={post.content} />
      </article>
    </div>
  )
}
