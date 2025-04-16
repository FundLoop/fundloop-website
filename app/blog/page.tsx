"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Search, ArrowLeft } from "lucide-react"
import type { Database, Tables } from "@/types/supabase"

type BlogPost = Tables<"blog_posts">

export default function BlogPage() {
  const [posts, setPosts] = useState<BlogPost[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [filteredPosts, setFilteredPosts] = useState<BlogPost[]>([])
  const supabase = createClientComponentClient<Database>()

  useEffect(() => {
    const fetchPosts = async () => {
      setLoading(true)

      try {
        // Simple query for blog posts - no joins
        const { data, error } = await supabase
          .from("blog_posts")
          .select("id, title, slug, excerpt, published_at")
          .order("published_at", { ascending: false })

        if (error) throw error

        setPosts(data || [])
        setFilteredPosts(data || [])
      } catch (err) {
        console.error("Error fetching blog posts:", err)
      } finally {
        setLoading(false)
      }
    }

    fetchPosts()
  }, [supabase])

  // Filter posts when search term changes
  useEffect(() => {
    if (searchTerm.trim() === "") {
      setFilteredPosts(posts)
    } else {
      const term = searchTerm.toLowerCase()
      const filtered = posts.filter(
        (post) => post.title.toLowerCase().includes(term) || post.excerpt.toLowerCase().includes(term),
      )
      setFilteredPosts(filtered)
    }
  }, [searchTerm, posts])

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
      <div className="flex items-center gap-2 mb-8">
        <Button asChild variant="ghost" size="sm" className="gap-1">
          <Link href="/">
            <ArrowLeft className="h-4 w-4" />
            <span>Back to Home</span>
          </Link>
        </Button>
      </div>

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold">FundLoop Blog</h1>
          <p className="text-slate-600 dark:text-slate-300 mt-2">
            News, updates, and insights from the FundLoop ecosystem
          </p>
        </div>

        <div className="relative w-full md:w-[300px]">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-500 dark:text-slate-400" />
          <Input
            placeholder="Search articles..."
            className="pl-8"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {loading ? (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array(6)
            .fill(0)
            .map((_, i) => (
              <Card key={i} className="flex flex-col h-full">
                <CardHeader>
                  <div className="h-6 w-full bg-slate-200 dark:bg-slate-700 rounded mb-2" />
                  <div className="h-4 w-24 bg-slate-200 dark:bg-slate-700 rounded" />
                </CardHeader>
                <CardContent className="flex-grow">
                  <div className="h-4 w-full bg-slate-200 dark:bg-slate-700 rounded mb-2" />
                  <div className="h-4 w-5/6 bg-slate-200 dark:bg-slate-700 rounded mb-2" />
                  <div className="h-4 w-4/6 bg-slate-200 dark:bg-slate-700 rounded" />
                </CardContent>
              </Card>
            ))}
        </div>
      ) : filteredPosts.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-lg text-slate-600 dark:text-slate-300 mb-4">No articles found matching your search.</p>
          <Button onClick={() => setSearchTerm("")}>Clear Search</Button>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredPosts.map((post) => (
            <Card key={post.id} className="flex flex-col h-full">
              <CardHeader>
                <CardTitle className="text-xl">
                  <Link
                    href={`/blog/${post.slug}?origin=blog`}
                    className="hover:text-emerald-600 dark:hover:text-emerald-400"
                  >
                    {post.title}
                  </Link>
                </CardTitle>
                <CardDescription>{formatDate(post.published_at)}</CardDescription>
              </CardHeader>
              <CardContent className="flex-grow">
                <p className="text-sm text-slate-600 dark:text-slate-300">{post.excerpt}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
