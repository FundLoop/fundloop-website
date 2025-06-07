"use client"
import Link from "next/link"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { ArrowLeft } from "lucide-react"
import Markdown from "@/components/markdown"
import type { Tables } from "@/types/supabase"

interface Props {
  post: Tables<"blog_posts">
  backHref: string
  backText: string
  showBack?: boolean
}

export default function ArticlePage({ post, backHref, backText, showBack = true }: Props) {
  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    }).format(date)
  }

  return (
    <div className="container mx-auto px-4 py-12">
      {showBack && (
        <div className="flex items-center gap-2 mb-8">
          <Button asChild variant="ghost" size="sm" className="gap-1">
            <Link href={backHref}>
              <ArrowLeft className="h-4 w-4" />
              <span>{backText}</span>
            </Link>
          </Button>
        </div>
      )}
      <article className="max-w-3xl mx-auto">
        {post.picture && (
          <div className="relative w-full h-60 mb-8">
            <Image src={post.picture} alt={post.title} fill className="object-cover rounded-md" />
          </div>
        )}
        <header className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold mb-2">{post.title}</h1>
          {post.subtitle && <p className="text-slate-600 dark:text-slate-300 mb-2">{post.subtitle}</p>}
          {post.published_at && (
            <p className="text-slate-600 dark:text-slate-300 text-sm">{formatDate(post.published_at)}</p>
          )}
        </header>
        <Markdown content={post.content} />
      </article>
    </div>
  )
}
