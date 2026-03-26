"use client"

import { useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Separator } from "@/components/ui/separator"
import { toast } from "@/components/ui/use-toast"
import { ArrowLeft, Edit2, Check, X, ExternalLink, Building2, Users, Share2, DollarSign } from "lucide-react"
import { ProjectVisibilityToggle } from "@/components/project-visibility-toggle"

interface SocialLink {
  name: string
  url: string
}

export interface ProjectParticipant {
  id: string
  name: string
  avatar: string
  role: string
}

export interface ProjectOrganization {
  id: number
  name: string
  logo: string
}

export interface ProjectFinancials {
  epochCount: number
  latestContributed: number
  avgContributed: number
  avgContributedPerParticipant: number
  avgSalary: number | null
}

export interface ProjectDetail {
  id: number
  slug: string
  name: string
  logo: string
  description: string
  category: string
  joined: string
  website: string
  detailed_description: string
  is_public: boolean
  organization?: ProjectOrganization
}

interface ProjectDetailPageProps {
  project: ProjectDetail
  participants: ProjectParticipant[]
  financials: ProjectFinancials | null
  hasAccess: boolean
  userRole: "admin" | "member" | null
}

export function ProjectDetailPage({ project: initialProject, participants, financials, hasAccess, userRole }: ProjectDetailPageProps) {
  const [project, setProject] = useState(initialProject)
  const [socials] = useState<SocialLink[]>([])
  const [editingField, setEditingField] = useState<string | null>(null)
  const [editValues, setEditValues] = useState<Record<string, string>>({
    name: initialProject.name,
    description: initialProject.description,
    detailed_description: initialProject.detailed_description,
    website: initialProject.website,
    category: initialProject.category,
  })

  const handleEdit = (field: string) => {
    setEditingField(field)
  }

  const handleSave = async (field: string) => {
    try {
      setProject((prev) => ({
        ...prev,
        [field]: editValues[field],
      }))

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
    setEditValues((prev) => ({
      ...prev,
      [field]: project[field as keyof ProjectDetail] as string,
    }))
    setEditingField(null)
  }

  const handleVisibilityChange = (isPublic: boolean) => {
    setProject((prev) => ({
      ...prev,
      is_public: isPublic,
    }))
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

      <div className="grid gap-8 md:grid-cols-3">
        <div className="space-y-8 md:col-span-2">
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
                        onChange={(event) => setEditValues({ ...editValues, name: event.target.value })}
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
                      {hasAccess && userRole === "admin" ? (
                        <Button size="icon" variant="ghost" onClick={() => handleEdit("name")}>
                          <Edit2 className="h-4 w-4" />
                        </Button>
                      ) : null}
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
                  <h3 className="mb-2 text-lg font-medium">Description</h3>
                  {editingField === "description" ? (
                    <div className="space-y-2">
                      <Textarea
                        value={editValues.description}
                        onChange={(event) => setEditValues({ ...editValues, description: event.target.value })}
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
                      {hasAccess && userRole === "admin" ? (
                        <Button size="icon" variant="ghost" onClick={() => handleEdit("description")}>
                          <Edit2 className="h-4 w-4" />
                        </Button>
                      ) : null}
                    </div>
                  )}
                </div>

                <div>
                  <h3 className="mb-2 text-lg font-medium">Detailed Information</h3>
                  {editingField === "detailed_description" ? (
                    <div className="space-y-2">
                      <Textarea
                        value={editValues.detailed_description}
                        onChange={(event) =>
                          setEditValues({ ...editValues, detailed_description: event.target.value })
                        }
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
                      {hasAccess && userRole === "admin" ? (
                        <Button size="icon" variant="ghost" onClick={() => handleEdit("detailed_description")}>
                          <Edit2 className="h-4 w-4" />
                        </Button>
                      ) : null}
                    </div>
                  )}
                </div>

                <div>
                  <h3 className="mb-2 text-lg font-medium">Website</h3>
                  {editingField === "website" ? (
                    <div className="space-y-2">
                      <Input
                        value={editValues.website}
                        onChange={(event) => setEditValues({ ...editValues, website: event.target.value })}
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
                        className="flex items-center gap-1 text-emerald-600 hover:underline dark:text-emerald-400"
                      >
                        {project.website}
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                      {hasAccess && userRole === "admin" ? (
                        <Button size="icon" variant="ghost" onClick={() => handleEdit("website")}>
                          <Edit2 className="h-4 w-4" />
                        </Button>
                      ) : null}
                    </div>
                  )}
                </div>

                <div>
                  <h3 className="mb-2 text-lg font-medium">Socials</h3>
                  <div className="flex flex-wrap gap-2">
                    {socials.map((social) => (
                      <Badge key={social.name} variant="outline">
                        <a href={social.url} target="_blank" rel="noopener noreferrer">
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
          {financials ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Financial Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 text-sm">
                <div>Epochs: {financials.epochCount}</div>
                <div className="mt-2 font-medium">Latest Epoch</div>
                <div>Contributed: ${financials.latestContributed.toLocaleString()}</div>
                {financials.epochCount > 1 ? (
                  <>
                    <Separator className="my-2" />
                    <div className="font-medium">Average per Epoch</div>
                    <div>
                      Contributed: ${financials.avgContributed.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                    </div>
                    <div>
                      Avg per Participant: $
                      {financials.avgContributedPerParticipant.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                    </div>
                    {financials.avgSalary !== null ? (
                      <div>Avg Citizen Salary: ${financials.avgSalary.toLocaleString()}</div>
                    ) : null}
                  </>
                ) : null}
              </CardContent>
            </Card>
          ) : null}

          {hasAccess && userRole === "admin" ? (
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
          ) : null}

          {hasAccess && project.organization ? (
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Building2 className="h-5 w-5 text-slate-500" />
                  <CardTitle className="text-lg">Organization</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <div className="mb-4 flex items-center gap-3">
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
          ) : null}

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-slate-500" />
                <CardTitle className="text-lg">People</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {participants.map((person) => (
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
              <Button asChild className="mt-2 w-full">
                <Link href={`/projects/${project.slug}/payments`}>
                  <DollarSign className="mr-2 h-4 w-4" />
                  Manage Payments
                </Link>
              </Button>
              {hasAccess && userRole === "admin" ? (
                <Button asChild variant="outline" className="w-full">
                  <Link href={`/projects/${project.slug}/zkas`}>Manage zkActivitySum</Link>
                </Button>
              ) : null}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
