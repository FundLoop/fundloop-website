"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs"
import { Button } from "@/components/ui/button"
import { ArrowLeft } from "lucide-react"
import Markdown from "@/components/markdown"
import type { Database, Tables } from "@/types/supabase"

type DocPost = Tables<"blog_posts">

export default function DocPostPage() {
  const params = useParams()
  const slug = params.slug as string
  const supabase = createClientComponentClient<Database>()

  const [post, setPost] = useState<DocPost | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchPost = async () => {
      setLoading(true)
      try {
        const { data, error } = await supabase
          .from("blog_posts")
          .select("id, title, subtitle, content, picture, published_at")
          .eq("slug", slug)
          .eq("is_support", true)
          .single()
        if (error) throw error
        setPost(data)
      } catch (err) {
        console.error("Error fetching doc:", err)
      } finally {
        setLoading(false)
      }
    }
    if (slug) {
      fetchPost()
    }
  }, [slug, supabase])

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    }).format(date)
  }

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-12">Loading...</div>
    )
  }

  if (!post) {
    return (
      <div className="container mx-auto px-4 py-12">
        <Button asChild variant="ghost" size="sm" className="gap-1 mb-8">
          <Link href="/documentation">
            <ArrowLeft className="h-4 w-4" />
            <span>Back to Support</span>
          </Link>
        </Button>
        <p>Document not found.</p>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-12">
      <div className="flex items-center gap-2 mb-8">
        <Button asChild variant="ghost" size="sm" className="gap-1">
          <Link href="/documentation">
            <ArrowLeft className="h-4 w-4" />
            <span>Back to Support</span>
          </Link>
        </Button>
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
