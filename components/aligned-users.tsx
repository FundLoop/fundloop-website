"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs"
import { Card, CardContent } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "@/components/ui/use-toast"
import type { Database } from "@/types/supabase"

interface User {
  user_id: string
  full_name: string
  avatar_url: string | null
  contribution_details: string | null
  created_at: string | null
  location_id: number | null
  location?: string
  project_count?: number
  is_full_name_public?: boolean
  is_location_public?: boolean
  is_contribution_details_public?: boolean
}

export default function AlignedUsers() {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClientComponentClient<Database>()

  useEffect(() => {
    const fetchUsers = async () => {
      setLoading(true)

      try {
        // Get user ids that participate in at least one project
        const { data: participants, error: partError } = await supabase
          .from("participants")
          .select("user_id")

        if (partError) throw partError

        const ids = Array.from(new Set(participants?.map((p) => p.user_id)))

        if (ids.length === 0) {
          setUsers([])
          return
        }

        // Query only users that belong to a project
        const { data: userData, error: userError } = await supabase
          .from("users")
          .select(
            "user_id, full_name, avatar_url, contribution_details, created_at, location_id, is_full_name_public, is_location_public, is_contribution_details_public"
          )
          .in("user_id", ids)
          .is("deleted_at", null)
          .eq("status", "active")
          .order("created_at", { ascending: false })
          .limit(8)

        if (userError) throw userError

        // Get location names in a separate query
        const locationIds = userData.map((user) => user.location_id).filter((id): id is number => id !== null)

        let locationMap: Record<number, string> = {}

        if (locationIds.length > 0) {
          const { data: locationData } = await supabase.from("ref_locations").select("id, name").in("id", locationIds)

          if (locationData) {
            locationMap = locationData.reduce((acc: Record<number, string>, loc) => {
              acc[loc.id] = loc.name
              return acc
            }, {})
          }
        }

        // Count projects per user in a separate query
        const { data: projectData } = await supabase.from("participants").select("user_id, project_id")

        // Count unique projects per user
        const projectCounts: Record<string, Set<number>> = {}

        if (projectData) {
          projectData.forEach((participation) => {
            if (!projectCounts[participation.user_id]) {
              projectCounts[participation.user_id] = new Set()
            }
            projectCounts[participation.user_id].add(participation.project_id)
          })
        }

        // Format the user data
        const formattedUsers = userData.map((user) => ({
          ...user,
          location: user.location_id ? locationMap[user.location_id] || "Unknown Location" : "Unknown Location",
          project_count: projectCounts[user.user_id] ? projectCounts[user.user_id].size : 0,
        }))

        setUsers(formattedUsers)
      } catch (err) {
        console.error("Error fetching users:", err)
        toast({
          title: "Error",
          description: "Failed to load community members.",
          variant: "destructive",
        })
      } finally {
        setLoading(false)
      }
    }

    fetchUsers()
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
    <>
      <div className="py-8 text-center">
        <h2 className="text-5xl font-extrabold text-emerald-600 dark:text-emerald-400 mb-4">
          Is FundLoop For My Project?
        </h2>
        <p className="text-lg text-slate-600 dark:text-slate-300">
          Do you have revenue? Do you have users you want to reward? Do you need more users?
        </p>
        <p className="text-lg text-slate-600 dark:text-slate-300">If so, FundLoop is exactly right for you.</p>
        <Button
          asChild
          className="mt-4 bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-700 hover:to-cyan-700"
        >
          Add My Project
        </Button>
      </div>
      <div className="py-8 text-center">
        <h2 className="text-5xl font-extrabold text-emerald-600 dark:text-emerald-400 mb-4">
          How Much Will The Users Of Our Project Get?
        </h2>
        <p className="text-lg text-slate-600 dark:text-slate-300">
          At least as much as you pay per user. Probably much more. Because when we pool our resources, the result is
          better for everyone.
        </p>
      </div>
      <section className="py-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">Community Members</h2>
            <p className="text-slate-600 dark:text-slate-300 mt-2">
              Meet the people who make up the FundLoop ecosystem
            </p>
          </div>
          <Button asChild className="mt-4 md:mt-0">
            <Link href="/users">View All Members</Link>
          </Button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          {loading
            ? Array(8)
                .fill(0)
                .map((_, i) => (
                  <Card key={i}>
                    <CardContent className="p-4 text-center">
                      <Skeleton className="h-16 w-16 rounded-full mx-auto mb-2" />
                      <Skeleton className="h-5 w-24 mx-auto mb-2" />
                      <Skeleton className="h-4 w-16 mx-auto mb-2" />
                      <Skeleton className="h-4 w-20 mx-auto mb-1" />
                      <Skeleton className="h-4 w-24 mx-auto" />
                    </CardContent>
                  </Card>
                ))
            : users.map((user) => (
                <Card key={user.user_id}>
                  <Link href={`/users/${user.user_id}`}
                    className="block">
                    <CardContent className="p-4 text-center">
                      <Avatar className="h-16 w-16 mx-auto mb-2">
                        <AvatarImage
                          src={user.avatar_url || "/placeholder.svg?height=40&width=40"}
                          alt={user.full_name}
                        />
                        <AvatarFallback>{user.full_name ? user.full_name.substring(0, 2) : "?"}</AvatarFallback>
                      </Avatar>
                      {user.is_full_name_public !== false && (
                        <h3 className="font-medium mb-1">{user.full_name}</h3>
                      )}
                      {user.is_contribution_details_public !== false && (
                        <Badge className="mb-2">{user.contribution_details || "Community Member"}</Badge>
                      )}
                      {user.is_location_public !== false && (
                        <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">{user.location}</p>
                      )}
                      <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">
                        Joined {getTimeAgo(user.created_at)}
                      </p>
                      <p className="text-xs font-medium">Active in {user.project_count} projects</p>
                    </CardContent>
                  </Link>
                </Card>
              ))}
        </div>
      </section>
    </>
  )
}
