"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import type { Database } from "@/types/supabase"
import { toast } from "@/components/ui/use-toast"

interface User {
  user_id: string
  full_name: string
  avatar_url: string | null
  contribution_details: string | null
  created_at: string | null
  location: string | null
}

interface Project {
  id: number
  name: string
  logo_url: string | null
}

export default function UserProfilePage() {
  const params = useParams()
  const userId = params?.id as string
  const supabase = createClientComponentClient<Database>()
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [projects, setProjects] = useState<Project[]>([])

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const { data, error } = await supabase
          .from("users")
          .select(
            "user_id, full_name, avatar_url, contribution_details, created_at, location_id"
          )
          .eq("user_id", userId)
          .single()

        if (error) throw error

        if (!data) return

        let location = null
        if (data.location_id) {
          const { data: loc } = await supabase
            .from("ref_locations")
            .select("name")
            .eq("id", data.location_id)
            .single()
          location = loc?.name ?? null
        }

        setUser({
          ...data,
          location,
        })

        const { data: participantData } = await supabase
          .from("participants")
          .select("project_id")
          .eq("user_id", userId)

        if (participantData && participantData.length > 0) {
          const projectIds = participantData.map((p) => p.project_id)
          const { data: projectData } = await supabase
            .from("projects")
            .select("id, name, logo_url")
            .in("id", projectIds)

          if (projectData) {
            setProjects(projectData)
          }
        }
      } catch (err) {
        console.error("Error loading profile", err)
        toast({
          title: "Error",
          description: "Failed to load profile",
          variant: "destructive",
        })
      } finally {
        setLoading(false)
      }
    }
    if (userId) fetchUser()
  }, [supabase, userId])

  if (loading) {
    return <p className="p-8 text-center">Loading...</p>
  }

  if (!user) {
    return <p className="p-8 text-center">User not found.</p>
  }

  return (
    <div className="container mx-auto px-4 py-12">
      <Card className="max-w-md mx-auto">
        <CardHeader className="text-center">
          <Avatar className="h-24 w-24 mx-auto mb-4">
            <AvatarImage src={user.avatar_url || "/placeholder.svg?height=100&width=100"} alt={user.full_name} />
            <AvatarFallback>{user.full_name.substring(0,2)}</AvatarFallback>
          </Avatar>
          <CardTitle>{user.full_name}</CardTitle>
        </CardHeader>
        <CardContent className="text-center space-y-2">
          <Badge className="mb-2">{user.contribution_details || "Community Member"}</Badge>
          {user.location && (
            <p className="text-sm text-slate-600 dark:text-slate-300">{user.location}</p>
          )}
          {user.created_at && (
            <p className="text-xs text-slate-500 dark:text-slate-400">Joined {new Date(user.created_at).toLocaleDateString()}</p>
          )}
        </CardContent>
      </Card>
      {projects.length > 0 && (
        <div className="max-w-md mx-auto mt-8">
          <h2 className="text-xl font-bold text-center mb-4">Projects</h2>
          <ul className="grid grid-cols-2 gap-4">
            {projects.map((project) => (
              <li key={project.id} className="flex flex-col items-center">
                <Avatar className="h-10 w-10 mb-2">
                  <AvatarImage src={project.logo_url || "/placeholder.svg?height=40&width=40"} alt={project.name} />
                  <AvatarFallback>{project.name.substring(0, 2)}</AvatarFallback>
                </Avatar>
                <span className="text-sm text-center">{project.name}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
