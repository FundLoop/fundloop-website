import "server-only"

import { cache } from "react"
import { isSupabaseConfigured } from "@/lib/supabase"
import { createServerSupabaseClient } from "@/lib/supabase-server"

export type PublicBlogPostPreview = {
  id: number
  title: string
  subtitle: string | null
  slug: string
  excerpt: string
  picture: string | null
  publishedAt: string | null
}

export type PublicBlogPostDetail = PublicBlogPostPreview & {
  content: string
  createdAt: string | null
  updatedAt: string | null
}

export type SupportDocumentationPost = {
  id: number
  title: string
  subtitle: string | null
  slug: string
  excerpt: string
  content: string
  category: string | null
  picture: string | null
  publishedAt: string | null
  createdAt: string | null
  updatedAt: string | null
  sortOrderWithinCategory: number | null
}

export type DocumentationHubData = {
  categories: string[]
  posts: SupportDocumentationPost[]
}

const DEFAULT_DOCUMENTATION_CATEGORY = "General"

function logPublicContentError(scope: string, error: unknown) {
  const message = error instanceof Error ? error.message : String(error)
  console.warn(`[public-content:${scope}] ${message}`)
}

function normalizeSearchTerm(search: string | undefined) {
  return search?.trim().toLowerCase() ?? ""
}

function postMatchesSearch(
  post: Pick<PublicBlogPostPreview, "title" | "excerpt" | "subtitle">,
  search: string,
) {
  if (!search) {
    return true
  }

  return [post.title, post.subtitle ?? "", post.excerpt].join(" ").toLowerCase().includes(search)
}

export async function getPublicBlogPosts(search?: string): Promise<PublicBlogPostPreview[]> {
  if (!isSupabaseConfigured()) {
    return []
  }

  try {
    const supabase = await createServerSupabaseClient()
    const { data, error } = await supabase
      .from("blog_posts")
      .select("id, title, subtitle, slug, excerpt, picture, published_at")
      .eq("is_support", false)
      .order("published_at", { ascending: false })

    if (error) {
      throw new Error(error.message)
    }

    const searchTerm = normalizeSearchTerm(search)

    return (data ?? [])
      .map<PublicBlogPostPreview>((post) => ({
        id: post.id,
        title: post.title,
        subtitle: post.subtitle,
        slug: post.slug,
        excerpt: post.excerpt,
        picture: post.picture,
        publishedAt: post.published_at,
      }))
      .filter((post) => postMatchesSearch(post, searchTerm))
  } catch (error) {
    logPublicContentError("blog-list", error)
    return []
  }
}

export const getPublicBlogPostBySlug = cache(async (slug: string): Promise<PublicBlogPostDetail | null> => {
  if (!isSupabaseConfigured()) {
    return null
  }

  try {
    const supabase = await createServerSupabaseClient()
    const { data, error } = await supabase
      .from("blog_posts")
      .select("id, title, subtitle, slug, excerpt, content, picture, published_at, created_at, updated_at")
      .eq("slug", slug)
      .eq("is_support", false)
      .maybeSingle()

    if (error) {
      throw new Error(error.message)
    }

    if (!data) {
      return null
    }

    return {
      id: data.id,
      title: data.title,
      subtitle: data.subtitle,
      slug: data.slug,
      excerpt: data.excerpt,
      content: data.content,
      picture: data.picture,
      publishedAt: data.published_at,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    }
  } catch (error) {
    logPublicContentError("blog-detail", error)
    return null
  }
})

export const getDocumentationHubData = cache(async (): Promise<DocumentationHubData> => {
  if (!isSupabaseConfigured()) {
    return {
      categories: [],
      posts: [],
    }
  }

  try {
    const supabase = await createServerSupabaseClient()
    const { data, error } = await supabase
      .from("blog_posts")
      .select(
        "id, title, subtitle, slug, excerpt, content, category, picture, published_at, created_at, updated_at, sort_order_within_category",
      )
      .eq("is_support", true)

    if (error) {
      throw new Error(error.message)
    }

    const posts = (data ?? [])
      .map<SupportDocumentationPost>((post) => ({
        id: post.id,
        title: post.title,
        subtitle: post.subtitle,
        slug: post.slug,
        excerpt: post.excerpt,
        content: post.content,
        category: post.category ?? DEFAULT_DOCUMENTATION_CATEGORY,
        picture: post.picture,
        publishedAt: post.published_at,
        createdAt: post.created_at,
        updatedAt: post.updated_at,
        sortOrderWithinCategory: post.sort_order_within_category,
      }))
      .sort((left, right) => {
        const leftCategory = left.category ?? ""
        const rightCategory = right.category ?? ""

        if (leftCategory !== rightCategory) {
          return leftCategory.localeCompare(rightCategory)
        }

        if (left.sortOrderWithinCategory != null && right.sortOrderWithinCategory != null) {
          return left.sortOrderWithinCategory - right.sortOrderWithinCategory
        }

        if (left.sortOrderWithinCategory != null) {
          return -1
        }

        if (right.sortOrderWithinCategory != null) {
          return 1
        }

        return (left.createdAt ?? "").localeCompare(right.createdAt ?? "")
      })

    return {
      categories: Array.from(new Set(posts.map((post) => post.category ?? DEFAULT_DOCUMENTATION_CATEGORY))),
      posts,
    }
  } catch (error) {
    logPublicContentError("documentation-hub", error)
    return {
      categories: [],
      posts: [],
    }
  }
})
