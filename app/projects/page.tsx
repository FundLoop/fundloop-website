"use client"

export const revalidate = 300

import { useEffect, useState } from "react"
import Link from "next/link"
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Search, ExternalLink, ArrowLeft } from "lucide-react"
import type { Database } from "@/types/supabase"

// Define a simpler project type without relationships
interface Project {
  id: number
  slug: string
  name: string
  logo_url: string | null
  description: string
  category_id: number | null
  created_at: string | null
  website: string | null
  category?: string
  user_count?: number
}

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [filteredProjects, setFilteredProjects] = useState<Project[]>([])
  const [categories, setCategories] = useState<{ id: number; name: string }[]>([])
  const [categoryFilter, setCategoryFilter] = useState("all")
  const [sortOrder, setSortOrder] = useState("recent")
  const supabase = createClientComponentClient<Database>()

  useEffect(() => {
    const fetchProjects = async () => {
      setLoading(true)

      try {
        // Fetch projects with soft delete awareness
        const { data: projectData, error: projectError } = await supabase
          .from("projects")
          .select("id, slug, name, logo_url, description, category_id, created_at, website")
          .is("deleted_at", null)
          .eq("status", "active")
          .order("created_at", { ascending: false })

        if (projectError) throw projectError

        // Fetch all categories for filters
        const { data: allCategories } = await supabase
          .from("ref_categories")
          .select("id, name")
          .order("name")

        setCategories(allCategories || [])

        // Get categories
        const categoryIds = projectData.map((project) => project.category_id).filter((id): id is number => id !== null)

        let categoryMap: Record<number, string> = {}

        if (categoryIds.length > 0) {
          const { data: categoryData } = await supabase.from("ref_categories").select("id, name").in("id", categoryIds)

          if (categoryData) {
            categoryMap = categoryData.reduce((acc: Record<number, string>, cat) => {
              acc[cat.id] = cat.name
              return acc
            }, {})
          }
        }

        // Format the project data
        const formattedProjects = projectData.map((project) => ({
          ...project,
          category: project.category_id ? categoryMap[project.category_id] || "Uncategorized" : "Uncategorized",
          user_count: 0, // Default value
        }))

        setProjects(formattedProjects)
        setFilteredProjects(formattedProjects)
      } catch (err) {
        console.error("Error fetching projects:", err)
      } finally {
        setLoading(false)
      }
    }

    fetchProjects()
  }, [supabase])

  // Apply filters and sorting
  useEffect(() => {
    let result = [...projects]

    if (categoryFilter !== "all") {
      result = result.filter((p) => p.category_id === Number.parseInt(categoryFilter))
    }

    if (searchTerm.trim() !== "") {
      const term = searchTerm.toLowerCase()
      result = result.filter(
        (project) =>
          project.name.toLowerCase().includes(term) ||
          project.description.toLowerCase().includes(term) ||
          (project.category && project.category.toLowerCase().includes(term)),
      )
    }

    result.sort((a, b) => {
      if (sortOrder === "oldest") {
        return new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime()
      }
      return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
    })

    setFilteredProjects(result)
  }, [searchTerm, projects, categoryFilter, sortOrder])

  const getTimeAgo = (dateString: string | null) => {
    if (!dateString) return "Recently"

    const date = new Date(dateString)
    const now = new Date()
    const diffInMonths = (now.getFullYear() - date.getFullYear()) * 12 + now.getMonth() - date.getMonth()

    if (diffInMonths < 1) return "Less than a month ago"
    if (diffInMonths === 1) return "1 month ago"
    return `${diffInMonths} months ago`
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
          <h1 className="text-3xl md:text-4xl font-bold">Aligned Projects</h1>
          <p className="text-slate-600 dark:text-slate-300 mt-2">
            Discover all projects that have taken the 1% pledge to support the FundLoop ecosystem
          </p>
        </div>

        <div className="flex w-full md:w-auto gap-2 flex-wrap">
          <div className="relative w-full md:w-[200px]">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-500 dark:text-slate-400" />
            <Input
              placeholder="Search projects..."
              className="pl-8"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filter Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {categories.map((cat) => (
                <SelectItem key={cat.id} value={cat.id.toString()}>
                  {cat.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={sortOrder} onValueChange={setSortOrder}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Sort" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="recent">Newest</SelectItem>
              <SelectItem value="oldest">Oldest</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {loading ? (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array(6)
            .fill(0)
            .map((_, i) => (
              <Card key={i} className="overflow-hidden">
                <CardHeader className="pb-2">
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-2">
                      <div className="h-10 w-10 rounded-full bg-slate-200 dark:bg-slate-700" />
                      <div>
                        <div className="h-5 w-32 bg-slate-200 dark:bg-slate-700 rounded" />
                        <div className="h-4 w-24 mt-1 bg-slate-200 dark:bg-slate-700 rounded" />
                      </div>
                    </div>
                    <div className="h-5 w-16 bg-slate-200 dark:bg-slate-700 rounded" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="h-4 w-full mb-2 bg-slate-200 dark:bg-slate-700 rounded" />
                  <div className="h-4 w-5/6 mb-2 bg-slate-200 dark:bg-slate-700 rounded" />
                  <div className="h-4 w-4/6 mb-4 bg-slate-200 dark:bg-slate-700 rounded" />
                  <div className="flex justify-between items-center">
                    <div className="h-4 w-24 bg-slate-200 dark:bg-slate-700 rounded" />
                    <div className="h-8 w-16 bg-slate-200 dark:bg-slate-700 rounded" />
                  </div>
                </CardContent>
              </Card>
            ))}
        </div>
      ) : filteredProjects.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-lg text-slate-600 dark:text-slate-300 mb-4">No projects found matching your search.</p>
          <Button onClick={() => setSearchTerm("")}>Clear Search</Button>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredProjects.map((project) => (
            <Card key={project.id} className="overflow-hidden">
              {/* Project card content */}
              <div className="block">
                <Link href={`/projects/${project.slug}`} className="block">
                  <CardHeader className="pb-2">
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-2">
                        <Avatar className="h-10 w-10">
                          <AvatarImage
                            src={project.logo_url || "/placeholder.svg?height=40&width=40"}
                            alt={project.name}
                          />
                          <AvatarFallback>{project.name.substring(0, 2)}</AvatarFallback>
                        </Avatar>
                        <div>
                          <CardTitle className="text-lg">{project.name}</CardTitle>
                          <CardDescription className="text-xs">Joined {getTimeAgo(project.created_at)}</CardDescription>
                        </div>
                      </div>
                      <Badge variant="outline">{project.category || "Uncategorized"}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-slate-600 dark:text-slate-300 mb-4">{project.description}</p>
                  </CardContent>
                </Link>
                <CardContent className="pt-0">
                  <div className="flex justify-between items-center">
                    <div className="text-sm text-slate-500 dark:text-slate-400">
                      {(project.user_count || 0).toLocaleString()} users
                    </div>
                    {/* External link button - separate from the card link */}
                    {project.website && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 gap-1"
                        onClick={(e) => {
                          e.stopPropagation()
                          window.open(project.website, "_blank", "noopener,noreferrer")
                        }}
                      >
                        <span>Visit</span>
                        <ExternalLink className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </CardContent>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
