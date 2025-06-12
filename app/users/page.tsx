"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Search, Filter, ArrowLeft } from "lucide-react"
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
}

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(0)
  const loader = useRef<HTMLDivElement | null>(null)
  const [allIds, setAllIds] = useState<string[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [filteredUsers, setFilteredUsers] = useState<User[]>([])
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const supabase = createClientComponentClient<Database>()

  useEffect(() => {
    const fetchParticipants = async () => {
      try {
        const { data, error } = await supabase.from("participants").select("user_id")
        if (error) throw error
        const ids = Array.from(new Set(data.map((d) => d.user_id)))
        setAllIds(ids)
        if (ids.length === 0) {
          setErrorMsg("No community members yet.")
        }
      } catch (err) {
        console.error("Error fetching participants:", err)
        setErrorMsg("Failed to load members.")
      } finally {
        setLoading(false)
      }
    }

    fetchParticipants()
  }, [supabase])

  useEffect(() => {
    if (allIds.length === 0) {
      return
    }

    const fetchUsers = async () => {
      setLoading(true)

      try {
        const limit = 12
        const slice = allIds.slice(page * limit, page * limit + limit)

        if (slice.length === 0) {
          setLoading(false)
          return
        }

        const { data: userData, error: userError } = await supabase
          .from("users")
          .select(
            "user_id, full_name, avatar_url, contribution_details, created_at, location_id"
          )
          .in("user_id", slice)
          .is("deleted_at", null)
          .eq("status", "active")

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

        setUsers((prev) => [...prev, ...formattedUsers])
        setFilteredUsers((prev) => [...prev, ...formattedUsers])
      } catch (err) {
        console.error("Error fetching users:", err)
        setErrorMsg("Failed to load members. Please try again later.")
      } finally {
        setLoading(false)
      }
    }

    fetchUsers()
  }, [supabase, page, allIds])

  // Filter users when search term changes
  useEffect(() => {
    if (searchTerm.trim() === "") {
      setFilteredUsers(users)
    } else {
      const term = searchTerm.toLowerCase()
      const filtered = users.filter(
        (user) =>
          user.full_name.toLowerCase().includes(term) ||
          user.location?.toLowerCase().includes(term) ||
          (user.contribution_details && user.contribution_details.toLowerCase().includes(term)),
      )
      setFilteredUsers(filtered)
    }
  }, [searchTerm, users])

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          const limit = 12
          setPage((p) => {
            if ((p + 1) * limit <= allIds.length) {
              return p + 1
            }
            return p
          })
        }
      },
      { threshold: 1 }
    )
    if (loader.current) observer.observe(loader.current)
    return () => {
      if (loader.current) observer.unobserve(loader.current)
    }
  }, [])

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
          <h1 className="text-3xl md:text-4xl font-bold">Community Members</h1>
          <p className="text-slate-600 dark:text-slate-300 mt-2">
            Meet all the people who make up the FundLoop ecosystem
          </p>
        </div>

        <div className="flex w-full md:w-auto gap-2">
          <div className="relative w-full md:w-[300px]">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-500 dark:text-slate-400" />
            <Input
              placeholder="Search members..."
              className="pl-8"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <Button variant="outline" size="icon">
            <Filter className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {errorMsg && !loading ? (
        <div className="text-center py-12 text-red-600 dark:text-red-400">
          {errorMsg}
        </div>
      ) : loading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {Array(8)
            .fill(0)
            .map((_, i) => (
              <Card key={i}>
                <CardHeader className="pb-2 text-center">
                  <div className="h-16 w-16 rounded-full bg-slate-200 dark:bg-slate-700 mx-auto mb-2" />
                  <div className="h-5 w-24 bg-slate-200 dark:bg-slate-700 rounded mx-auto" />
                </CardHeader>
                <CardContent className="text-center">
                  <div className="h-6 w-16 bg-slate-200 dark:bg-slate-700 rounded mx-auto mb-2" />
                  <div className="h-4 w-20 bg-slate-200 dark:bg-slate-700 rounded mx-auto mb-1" />
                  <div className="h-4 w-24 bg-slate-200 dark:bg-slate-700 rounded mx-auto mb-2" />
                  <div className="h-4 w-16 bg-slate-200 dark:bg-slate-700 rounded mx-auto" />
                </CardContent>
              </Card>
            ))}
        </div>
      ) : filteredUsers.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-lg text-slate-600 dark:text-slate-300 mb-4">No members found matching your search.</p>
          <Button onClick={() => setSearchTerm("")}>Clear Search</Button>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {filteredUsers.map((user) => (
            <Card key={user.user_id}>
              <Link href={`/users/${user.user_id}`} className="block">
                <CardHeader className="pb-2 text-center">
                  <Avatar className="h-16 w-16 mx-auto mb-2">
                    <AvatarImage src={user.avatar_url || "/placeholder.svg?height=40&width=40"} alt={user.full_name} />
                    <AvatarFallback>{user.full_name.substring(0, 2)}</AvatarFallback>
                  </Avatar>
                  <CardTitle className="text-base">{user.full_name}</CardTitle>
                </CardHeader>
                <CardContent className="text-center">
                  <Badge className="mb-2">{user.contribution_details || "Community Member"}</Badge>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">{user.location}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">Joined {getTimeAgo(user.created_at)}</p>
                  <p className="text-xs font-medium">Active in {user.project_count} projects</p>
                </CardContent>
              </Link>
            </Card>
          ))}
        </div>
      )}
      <div ref={loader} className="h-10" />
    </div>
  )
}
