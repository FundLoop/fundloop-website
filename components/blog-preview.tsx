"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import type { Database, Tables } from "@/types/supabase"

type BlogPost = Tables<"blog_posts">

export default function BlogPreview() {
  const [posts, setPosts] = useState<BlogPost[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClientComponentClient<Database>()

  useEffect(() => {
    const fetchPosts = async () => {
      setLoading(true)

      try {
        // Simple query for blog posts - no joins
        const { data, error } = await supabase
          .from("blog_posts")
          .select("id, title, subtitle, slug, excerpt, picture, published_at")
          .eq("is_support", false)
          .order("published_at", { ascending: false })
          .limit(3)

        if (error) throw error

        setPosts(data || [])
      } catch (err) {
        console.error("Error fetching blog posts:", err)
      } finally {
        setLoading(false)
      }
    }

    fetchPosts()
  }, [supabase])

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    }).format(date)
  }

  return (
    <section className="py-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Latest News</h2>
          <p className="text-slate-600 dark:text-slate-300 mt-2">Updates and insights from the FundLoop ecosystem</p>
        </div>
        <Button asChild className="mt-4 md:mt-0">
          <Link href="/blog">View All Posts</Link>
        </Button>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        {loading
          ? Array(3)
              .fill(0)
              .map((_, i) => (
                <Card key={i} className="flex flex-col h-full">
                  <CardHeader>
                    <Skeleton className="h-6 w-full mb-2" />
                    <Skeleton className="h-4 w-24" />
                  </CardHeader>
                  <CardContent className="flex-grow">
                    <Skeleton className="h-4 w-full mb-2" />
                    <Skeleton className="h-4 w-5/6 mb-2" />
                    <Skeleton className="h-4 w-4/6" />
                  </CardContent>
                </Card>
              ))
          : posts.map((post) => (
              <Card
                key={post.id}
                className="overflow-hidden transition-transform transform hover:scale-105 hover:shadow-lg"
              >
                <Link href={`/blog/${post.slug}`} className="block h-full">
                  {post.picture && (
                    <div className="relative w-full h-40">
                      <Image src={post.picture} alt={post.title} fill className="object-cover" />
                    </div>
                  )}
                  <CardHeader>
                    <CardTitle className="text-xl hover:text-emerald-600 dark:hover:text-emerald-400">
                      {post.title}
                    </CardTitle>
                    {post.subtitle && (
                      <p className="text-sm text-slate-600 dark:text-slate-300">
                        {post.subtitle}
                      </p>
                    )}
                    <CardDescription>{formatDate(post.published_at)}</CardDescription>
                  </CardHeader>
                  <CardContent className="flex-grow">
                    <p className="text-sm text-slate-600 dark:text-slate-300">
                      {post.excerpt}
                    </p>
                  </CardContent>
                </Link>
              </Card>
            ))}
      </div>
    </section>
  )
}
