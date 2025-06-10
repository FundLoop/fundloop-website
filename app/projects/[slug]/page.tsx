"use client"

export const revalidate = 300

import { useState, useEffect } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs"
import type { Database } from "@/types/supabase"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "@/components/ui/use-toast"
import { ArrowLeft, Edit2, Check, X, ExternalLink, Building2, Users, Share2, DollarSign } from "lucide-react"
import { ProjectVisibilityToggle } from "@/components/project-visibility-toggle"

interface SocialLink {
  name: string
  url: string
}

interface ProjectUser {
  id: number
  name: string
  avatar: string
  role: string
}

interface Organization {
  id: number
  name: string
  logo: string
}

interface Project {
  id: number
  slug: string
  name: string
  logo: string
  description: string
  category: string
  users: number
  joined: string
  website: string
  detailed_description: string
  is_public: boolean
  organization?: Organization
  team_members?: ProjectUser[]
}

export default function ProjectDetailPage() {
  const params = useParams()
  const slug = params.slug as string
  const supabase = createClientComponentClient<Database>()

  const [project, setProject] = useState<Project | null>(null)
  const [loading, setLoading] = useState(true)
  const [hasAccess, setHasAccess] = useState(false)
  const [editingField, setEditingField] = useState<string | null>(null)
  const [editValues, setEditValues] = useState<Record<string, string>>({})
  const [userRole, setUserRole] = useState<string | null>(null)

  useEffect(() => {
    const fetchProject = async () => {
      try {
        const { data, error } = await supabase
          .from("projects")
          .select(
            "id, slug, name, logo_url, description, detailed_description, website, created_at, category_id, is_public"
          )
          .eq("slug", slug)
          .is("deleted_at", null)
          .single()

        if (error) throw error

        if (!data) {
          setProject(null)
          return
        }

        const category = data.category_id
          ? (
              await supabase
                .from("ref_categories")
                .select("name")
                .eq("id", data.category_id)
                .single()
            ).data?.name || "Uncategorized"
          : "Uncategorized"

        const formattedProject: Project = {
          id: data.id,
          slug: data.slug,
          name: data.name,
          logo: data.logo_url || "/placeholder.svg?height=80&width=80",
          description: data.description,
          category,
          users: 0,
          joined: data.created_at ? new Date(data.created_at).toLocaleDateString() : "Recently",
          website: data.website || "",
          detailed_description: data.detailed_description || "",
          is_public: data.is_public ?? true,
        }

        setHasAccess(true)
        setProject(formattedProject)
        setUserRole("admin")
        setEditValues({
          name: formattedProject.name,
          description: formattedProject.description,
          detailed_description: formattedProject.detailed_description,
          website: formattedProject.website,
          category: formattedProject.category,
        })
      } catch (error) {
        console.error("Error fetching project:", error)
        toast({
          title: "Error",
          description: "Failed to load project details",
          variant: "destructive",
        })
      } finally {
        setLoading(false)
      }
    }

    fetchProject()
  }, [slug, supabase])

  const financials = {
    pledgedPercent: 1,
    contributed: 12500,
    participants: 23,
  }

  const socials: SocialLink[] = [
    { name: "Twitter", url: "https://twitter.com" },
    { name: "GitHub", url: "https://github.com" },
  ]

  const admins: ProjectUser[] = [
    {
      id: 1,
      name: "Jane Doe",
      avatar: "/placeholder.svg?height=40&width=40",
      role: "Admin",
    },
    {
      id: 2,
      name: "John Smith",
      avatar: "/placeholder.svg?height=40&width=40",
      role: "Admin",
    },
  ]

  const handleEdit = (field: string) => {
    setEditingField(field)
  }

  const handleSave = async (field: string) => {
    try {
      // In a real app, you would update in Supabase
      // For demo purposes, we'll just update the local state
      setProject((prev) => {
        if (!prev) return prev
        return {
          ...prev,
          [field]: editValues[field],
        }
      })

      toast({
        title: "Success",
        description: `${field.charAt(0).toUpperCase() + field.slice(1)} updated successfully`,
      })
    } catch (error) {
      console.error(`Error updating ${field}:`, error)
      toast({
        title: "Error",
        description: `Failed to update ${field}`,
        variant: "destructive",
      })
    } finally {
      setEditingField(null)
    }
  }

  const handleCancel = (field: string) => {
    if (project) {
      setEditValues((prev) => ({
        ...prev,
        [field]: project[field as keyof Project] as string,
      }))
    }
    setEditingField(null)
  }

  const handleVisibilityChange = (isPublic: boolean) => {
    setProject((prev) => {
      if (!prev) return prev
      return {
        ...prev,
        is_public: isPublic,
      }
    })
  }

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-12">
        <div className="space-y-4">
          <Skeleton className="h-8 w-1/3" />
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
        </div>
      </div>
    )
  }

  if (!project) {
    return (
      <div className="container mx-auto px-4 py-12">
        <div className="flex items-center gap-2 mb-8">
          <Button asChild variant="ghost" size="sm" className="gap-1">
            <Link href="/projects">
              <ArrowLeft className="h-4 w-4" />
              <span>Back to Projects</span>
            </Link>
          </Button>
        </div>
        <div className="text-center py-12">
          <h1 className="text-2xl font-bold mb-4">Project Not Found</h1>
          <p className="text-slate-600 dark:text-slate-300 mb-6">
            The project you're looking for doesn't exist or you don't have access to view it.
          </p>
          <Button asChild>
            <Link href="/projects">Browse Projects</Link>
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-12">
      <div className="flex items-center gap-2 mb-8">
        <Button asChild variant="ghost" size="sm" className="gap-1">
          <Link href="/projects">
            <ArrowLeft className="h-4 w-4" />
            <span>Back to Projects</span>
          </Link>
        </Button>
      </div>

      <div className="grid md:grid-cols-3 gap-8">
        <div className="md:col-span-2 space-y-8">
          <Card>
            <CardHeader className="flex flex-row items-start justify-between">
              <div className="flex items-start gap-4">
                <Avatar className="h-16 w-16">
                  <AvatarImage src={project.logo} alt={project.name} />
                  <AvatarFallback>{project.name.substring(0, 2)}</AvatarFallback>
                </Avatar>
                <div>
                  {editingField === "name" ? (
                    <div className="flex items-center gap-2">
                      <Input
                        value={editValues.name}
                        onChange={(e) => setEditValues({ ...editValues, name: e.target.value })}
                        className="max-w-xs"
                      />
                      <Button size="icon" variant="ghost" onClick={() => handleSave("name")}>
                        <Check className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => handleCancel("name")}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-2xl">{project.name}</CardTitle>
                      {hasAccess && userRole === "admin" && (
                        <Button size="icon" variant="ghost" onClick={() => handleEdit("name")}>
                          <Edit2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  )}
                  <CardDescription>Joined {project.joined}</CardDescription>
                </div>
              </div>
              <Badge variant="outline">{project.category}</Badge>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-medium mb-2">Description</h3>
                  {editingField === "description" ? (
                    <div className="space-y-2">
                      <Textarea
                        value={editValues.description}
                        onChange={(e) => setEditValues({ ...editValues, description: e.target.value })}
                        rows={3}
                      />
                      <div className="flex justify-end gap-2">
                        <Button size="sm" variant="outline" onClick={() => handleCancel("description")}>
                          Cancel
                        </Button>
                        <Button size="sm" onClick={() => handleSave("description")}>
                          Save
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start gap-2">
                      <p className="text-slate-600 dark:text-slate-300">{project.description}</p>
                      {hasAccess && userRole === "admin" && (
                        <Button size="icon" variant="ghost" onClick={() => handleEdit("description")}>
                          <Edit2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  )}
                </div>

                <div>
                  <h3 className="text-lg font-medium mb-2">Detailed Information</h3>
                  {editingField === "detailed_description" ? (
                    <div className="space-y-2">
                      <Textarea
                        value={editValues.detailed_description}
                        onChange={(e) => setEditValues({ ...editValues, detailed_description: e.target.value })}
                        rows={6}
                      />
                      <div className="flex justify-end gap-2">
                        <Button size="sm" variant="outline" onClick={() => handleCancel("detailed_description")}>
                          Cancel
                        </Button>
                        <Button size="sm" onClick={() => handleSave("detailed_description")}>
                          Save
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start gap-2">
                      <p className="text-slate-600 dark:text-slate-300">{project.detailed_description}</p>
                      {hasAccess && userRole === "admin" && (
                        <Button size="icon" variant="ghost" onClick={() => handleEdit("detailed_description")}>
                          <Edit2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  )}
                </div>

                <div>
                  <h3 className="text-lg font-medium mb-2">Website</h3>
                  {editingField === "website" ? (
                    <div className="space-y-2">
                      <Input
                        value={editValues.website}
                        onChange={(e) => setEditValues({ ...editValues, website: e.target.value })}
                      />
                      <div className="flex justify-end gap-2">
                        <Button size="sm" variant="outline" onClick={() => handleCancel("website")}>
                          Cancel
                        </Button>
                        <Button size="sm" onClick={() => handleSave("website")}>
                          Save
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <a
                        href={project.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1"
                      >
                        {project.website}
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                      {hasAccess && userRole === "admin" && (
                        <Button size="icon" variant="ghost" onClick={() => handleEdit("website")}>
                          <Edit2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  )}
                </div>

                <div>
                  <h3 className="text-lg font-medium mb-2">Socials</h3>
                  <div className="flex flex-wrap gap-2">
                    {socials.map((social) => (
                      <Badge key={social.name} variant="outline" asChild>
                        <a
                          href={social.url}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {social.name}
                        </a>
                      </Badge>
                    ))}
                  </div>
                </div>

              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Financial Summary</CardTitle>
            </CardHeader>
            <CardContent className="text-sm space-y-1">
              <div>Pledged: {financials.pledgedPercent}%</div>
              <div>Contributed: ${financials.contributed.toLocaleString()}</div>
              <div>Participants: {financials.participants}</div>
            </CardContent>
          </Card>

          {hasAccess && userRole === "admin" && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Project Settings</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <ProjectVisibilityToggle
                  projectId={project.id}
                  isPublic={project.is_public}
                  onVisibilityChange={handleVisibilityChange}
                />

                <Separator />

                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-medium">Share project</h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Copy the project link to share</p>
                  </div>
                  <Button variant="outline" size="sm" className="gap-1">
                    <Share2 className="h-4 w-4" />
                    Share
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {hasAccess && project.organization && (
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Building2 className="h-5 w-5 text-slate-500" />
                  <CardTitle className="text-lg">Organization</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-3 mb-4">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={project.organization.logo} alt={project.organization.name} />
                    <AvatarFallback>{project.organization.name.substring(0, 2)}</AvatarFallback>
                  </Avatar>
                  <div>
                    <h3 className="font-medium">{project.organization.name}</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400">Organization Owner</p>
                  </div>
                </div>
                <Button asChild variant="outline" className="w-full">
                  <Link href={`/organizations/${project.organization.id}`}>View Organization</Link>
                </Button>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-slate-500" />
                <CardTitle className="text-lg">People</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {admins.map((person) => (
                  <div key={person.id} className="flex items-center gap-3">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={person.avatar} alt={person.name} />
                      <AvatarFallback>{person.name.substring(0, 2)}</AvatarFallback>
                    </Avatar>
                    <div>
                      <h3 className="font-medium">{person.name}</h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400">{person.role}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {hasAccess && project.team_members && (
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-slate-500" />
                  <CardTitle className="text-lg">Team Members</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {project.team_members.map((member) => (
                    <div key={member.id} className="flex items-center gap-3">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={member.avatar} alt={member.name} />
                        <AvatarFallback>{member.name.substring(0, 2)}</AvatarFallback>
                      </Avatar>
                      <div>
                        <h3 className="font-medium">{member.name}</h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400">{member.role}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button className="w-full" asChild>
                <a href={project.website} target="_blank" rel="noopener noreferrer">
                  Visit Website
                </a>
              </Button>
              <Button variant="outline" className="w-full">
                Share Project
              </Button>
              <Button asChild className="w-full mt-2">
                <Link href={`/projects/${project.slug}/payments`}>
                  <DollarSign className="h-4 w-4 mr-2" />
                  Manage Payments
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
