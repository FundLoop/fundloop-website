"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, Briefcase } from "lucide-react"
import { OrganizationMembers } from "@/components/organization-members"

interface User {
  id: number
  name: string
  email: string
  avatar: string
  role: string
  joined: string
}

interface Project {
  id: number
  name: string
  logo: string
  description: string
  category: string
  is_public: boolean
}

interface Organization {
  id: number
  name: string
  logo: string
  description: string
  founded: string
  website: string
  members: User[]
  projects: Project[]
}

export default function OrganizationDetailPage() {
  const params = useParams()
  const organizationId = params.id as string

  const [organization, setOrganization] = useState<Organization | null>(null)
  const [loading, setLoading] = useState(true)
  const [userRole, setUserRole] = useState<string | null>(null)

  useEffect(() => {
    const fetchOrganization = async () => {
      try {
        // In a real app, you would fetch from Supabase
        // For demo purposes, we'll use mock data
        const mockOrganization: Organization = {
          id: Number.parseInt(organizationId),
          name: "Eco Innovations Inc.",
          logo: "/placeholder.svg?height=80&width=80",
          description: "A company focused on sustainable technology solutions for a better future.",
          founded: "2020",
          website: "https://ecoinnovations.example.com",
          members: [
            {
              id: 1,
              name: "Alex Rivera",
              email: "alex@example.com",
              avatar: "/placeholder.svg?height=40&width=40",
              role: "admin",
              joined: "1 year ago",
            },
            {
              id: 2,
              name: "Jamie Chen",
              email: "jamie@example.com",
              avatar: "/placeholder.svg?height=40&width=40",
              role: "member",
              joined: "10 months ago",
            },
            {
              id: 3,
              name: "Sam Washington",
              email: "sam@example.com",
              avatar: "/placeholder.svg?height=40&width=40",
              role: "member",
              joined: "8 months ago",
            },
          ],
          projects: [
            {
              id: 1,
              name: "EcoStream",
              logo: "/placeholder.svg?height=40&width=40",
              description: "Sustainable video streaming platform with carbon-neutral infrastructure",
              category: "Media",
              is_public: true,
            },
          ],
        }

        setOrganization(mockOrganization)
        setUserRole("admin") // Mock user role
      } catch (error) {
        console.error("Error fetching organization:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchOrganization()
  }, [organizationId])

  const handleMembersChange = () => {
    // In a real app, you would refetch the organization data
    // fetchOrganization()
  }

  const handleProjectVisibilityChange = (projectId: number, isPublic: boolean) => {
    setOrganization((prev) => {
      if (!prev) return prev

      return {
        ...prev,
        projects: prev.projects.map((project) =>
          project.id === projectId ? { ...project, is_public: isPublic } : project,
        ),
      }
    })
  }

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-12 flex justify-center">
        <p>Loading organization details...</p>
      </div>
    )
  }

  if (!organization) {
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
        <div className="text-center py-12">
          <h1 className="text-2xl font-bold mb-4">Organization Not Found</h1>
          <p className="text-slate-600 dark:text-slate-300 mb-6">
            The organization you're looking for doesn't exist or you don't have access to view it.
          </p>
          <Button asChild>
            <Link href="/">Back to Home</Link>
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-12">
      <div className="flex items-center gap-2 mb-8">
        <Button asChild variant="ghost" size="sm" className="gap-1">
          <Link href="/my-profile">
            <ArrowLeft className="h-4 w-4" />
            <span>Back to Profile</span>
          </Link>
        </Button>
      </div>

      <div className="grid md:grid-cols-3 gap-8">
        <div className="md:col-span-2 space-y-8">
          <Card>
            <CardHeader className="flex flex-row items-start justify-between">
              <div className="flex items-start gap-4">
                <Avatar className="h-16 w-16">
                  <AvatarImage src={organization.logo} alt={organization.name} />
                  <AvatarFallback>{organization.name.substring(0, 2)}</AvatarFallback>
                </Avatar>
                <div>
                  <CardTitle className="text-2xl">{organization.name}</CardTitle>
                  <CardDescription>Founded in {organization.founded}</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-medium mb-2">About</h3>
                  <p className="text-slate-600 dark:text-slate-300">{organization.description}</p>
                </div>

                <div>
                  <h3 className="text-lg font-medium mb-2">Website</h3>
                  <a
                    href={organization.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-emerald-600 dark:text-emerald-400 hover:underline"
                  >
                    {organization.website}
                  </a>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Briefcase className="h-5 w-5 text-slate-500" />
                <CardTitle className="text-lg">Projects</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 gap-4">
                {organization.projects.map((project) => (
                  <Card key={project.id} className="overflow-hidden">
                    <Link href={`/projects/${project.id}`} className="block">
                      <CardHeader className="pb-2">
                        <div className="flex justify-between items-start">
                          <div className="flex items-center gap-2">
                            <Avatar className="h-10 w-10">
                              <AvatarImage src={project.logo} alt={project.name} />
                              <AvatarFallback>{project.name.substring(0, 2)}</AvatarFallback>
                            </Avatar>
                            <div>
                              <CardTitle className="text-lg">{project.name}</CardTitle>
                            </div>
                          </div>
                          <Badge variant="outline">{project.category}</Badge>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm text-slate-600 dark:text-slate-300 mb-2">{project.description}</p>
                        <Badge variant={project.is_public ? "outline" : "secondary"}>
                          {project.is_public ? "Public" : "Private"}
                        </Badge>
                      </CardContent>
                    </Link>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <OrganizationMembers
            organizationId={organization.id}
            organizationName={organization.name}
            members={organization.members}
            currentUserId={1} // In a real app, this would be the current user's ID
            onMembersChange={handleMembersChange}
          />

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {userRole === "admin" && <Button className="w-full">Create New Project</Button>}
              <Button variant="outline" className="w-full">
                Organization Settings
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
