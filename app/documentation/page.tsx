"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ArrowLeft } from "lucide-react"
import type { Database, Tables } from "@/types/supabase"

type DocPost = Tables<"blog_posts">

export default function DocumentationPage() {
  const [posts, setPosts] = useState<DocPost[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClientComponentClient<Database>()

  useEffect(() => {
    const fetchDocs = async () => {
      setLoading(true)
      const { data, error } = await supabase
        .from("blog_posts")
        .select("id, title, subtitle, slug, excerpt, category, picture, published_at")
        .eq("is_support", true)
        .order("published_at", { ascending: false })
      if (!error) setPosts(data || [])
      setLoading(false)
    }
    fetchDocs()
  }, [supabase])

  const categories = Array.from(
    new Set(posts.map((p) => p.category).filter(Boolean)),
  ) as string[]

  const orderedCategories = categories.reverse()

  const [active, setActive] = useState<string | null>(null)

  if (loading) {
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
        <p>Loading...</p>
      </div>
    )
  }

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

      <div className="max-w-5xl mx-auto">
        <h1 className="text-3xl md:text-4xl font-bold mb-4">Documentation</h1>
        <p className="text-slate-600 dark:text-slate-300 text-lg mb-8">
          Comprehensive guides and resources for FundLoop.
        </p>

        {orderedCategories.length > 0 && (
          <div className="flex gap-8" onMouseLeave={() => setActive(null)}>
            <nav className="w-48 space-y-2">
              {orderedCategories.map((cat) => (
                <div
                  key={cat}
                  onMouseEnter={() => setActive(cat)}
                  className={`cursor-pointer capitalize px-2 py-1 rounded ${active === cat ? "bg-slate-100 dark:bg-slate-800" : ""}`}
                >
                  {cat}
                </div>
              ))}
            </nav>
            <div className="flex-1">
              {active && (
                <div className="grid md:grid-cols-2 gap-6">
                  {posts
                    .filter((p) => p.category === active)
                    .map((post) => (
                      <Card
                        key={post.id}
                        className="overflow-hidden transition-transform transform hover:scale-105 hover:shadow-lg"
                      >
                        <Link href={`/documentation/${post.slug}`} className="block h-full">
                          <CardHeader>
                            <CardTitle className="text-xl hover:text-emerald-600 dark:hover:text-emerald-400">
                              {post.title}
                            </CardTitle>
                            {post.subtitle && (
                              <p className="text-sm text-slate-600 dark:text-slate-300">
                                {post.subtitle}
                              </p>
                            )}
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
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
