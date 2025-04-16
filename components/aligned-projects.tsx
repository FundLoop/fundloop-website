"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { ExternalLink } from "lucide-react"
import type { Database } from "@/types/supabase"

// Define a simpler project type without relationships
interface Project {
  id: number
  name: string
  logo_url: string | null
  description: string
  category_id: number | null
  created_at: string | null
  website: string | null
  category?: string
  user_count?: number
}

export default function AlignedProjects() {
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClientComponentClient<Database>()

  useEffect(() => {
    const fetchProjects = async () => {
      setLoading(true)

      try {
        // Fetch projects with soft delete awareness
        const { data: projectData, error: projectError } = await supabase
          .from("projects")
          .select("id, name, logo_url, description, category_id, created_at, website")
          .is("deleted_at", null)
          .eq("status", "active")
          .order("created_at", { ascending: false })
          .limit(6)

        if (projectError) throw projectError

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
      } catch (err) {
        console.error("Error fetching projects:", err)
      } finally {
        setLoading(false)
      }
    }

    fetchProjects()
  }, [supabase])

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
    <section className="py-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Aligned Projects</h2>
          <p className="text-slate-600 dark:text-slate-300 mt-2">
            Discover projects that have taken the 1% pledge to support the ecosystem
          </p>
        </div>
        <Button asChild className="mt-4 md:mt-0">
          <Link href="/projects">View All Projects</Link>
        </Button>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading
          ? Array(6)
              .fill(0)
              .map((_, i) => (
                <Card key={i} className="overflow-hidden">
                  <CardHeader className="pb-2">
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-2">
                        <Skeleton className="h-10 w-10 rounded-full" />
                        <div>
                          <Skeleton className="h-5 w-32" />
                          <Skeleton className="h-4 w-24 mt-1" />
                        </div>
                      </div>
                      <Skeleton className="h-5 w-16" />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <Skeleton className="h-4 w-full mb-2" />
                    <Skeleton className="h-4 w-5/6 mb-2" />
                    <Skeleton className="h-4 w-4/6 mb-4" />
                    <div className="flex justify-between items-center">
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-8 w-16" />
                    </div>
                  </CardContent>
                </Card>
              ))
          : projects.map((project) => (
              <Card
                key={project.id}
                className="overflow-hidden transition-transform transform hover:scale-105 hover:shadow-lg"
              >
                <div className="block">
                  <Link href={`/projects/${project.id}`} className="block">
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
                            <CardDescription className="text-xs">
                              Joined {getTimeAgo(project.created_at)}
                            </CardDescription>
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
    </section>
  )
}
