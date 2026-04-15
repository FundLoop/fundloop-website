"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { ArrowLeft, Search } from "lucide-react"
import { getSupabaseBrowserClient } from "@/lib/supabase"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

interface User {
  user_id: string
  full_name: string | null
  avatar_url: string | null
  contribution_details: string | null
  created_at: string | null
  location_id: number | null
  location: string | null
  project_count: number
}

interface Participant {
  user_id: string
  project_id: number
}

interface ProjectOption {
  id: number
  name: string
}

const PAGE_SIZE = 12

export default function UsersPage() {
  const loader = useRef<HTMLDivElement | null>(null)
  const loadedSliceKeys = useRef(new Set<string>())
  const getSupabase = () => getSupabaseBrowserClient()

  const [users, setUsers] = useState<User[]>([])
  const [page, setPage] = useState(0)
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedProjectId, setSelectedProjectId] = useState("all")
  const [participants, setParticipants] = useState<Participant[]>([])
  const [projects, setProjects] = useState<ProjectOption[]>([])
  const [isBootstrapping, setIsBootstrapping] = useState(true)
  const [isLoadingUsers, setIsLoadingUsers] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  useEffect(() => {
    const fetchBaseData = async () => {
      setIsBootstrapping(true)
      setErrorMsg(null)

      try {
        const supabase = getSupabase()
        const [{ data: participantData, error: participantError }, { data: projectData, error: projectError }] =
          await Promise.all([
            supabase.from("participants").select("user_id, project_id"),
            supabase
              .from("projects")
              .select("id, name")
              .eq("status", "active")
              .eq("is_public", true)
              .is("deleted_at", null)
              .order("name"),
          ])

        if (participantError) {
          throw participantError
        }

        if (projectError) {
          throw projectError
        }

        setParticipants(participantData ?? [])
        setProjects(projectData ?? [])
      } catch (error) {
        console.error("Error fetching members page data:", error)
        setErrorMsg("Failed to load members.")
      } finally {
        setIsBootstrapping(false)
      }
    }

    void fetchBaseData()
  }, [])

  const visibleUserIds = useMemo(() => {
    const relevantParticipants =
      selectedProjectId === "all"
        ? participants
        : participants.filter((participant) => participant.project_id === Number(selectedProjectId))

    return Array.from(new Set(relevantParticipants.map((participant) => participant.user_id)))
  }, [participants, selectedProjectId])

  const projectCounts = useMemo(() => {
    const counts: Record<string, Set<number>> = {}

    participants.forEach((participant) => {
      if (!counts[participant.user_id]) {
        counts[participant.user_id] = new Set()
      }
      counts[participant.user_id].add(participant.project_id)
    })

    return counts
  }, [participants])

  useEffect(() => {
    setUsers([])
    setPage(0)
    loadedSliceKeys.current.clear()
  }, [selectedProjectId])

  useEffect(() => {
    loadedSliceKeys.current.clear()
  }, [visibleUserIds])

  useEffect(() => {
    if (visibleUserIds.length === 0 || errorMsg) {
      setIsLoadingUsers(false)
      return
    }

    const fetchUsers = async () => {
      setIsLoadingUsers(true)

      try {
        const supabase = getSupabase()
        const slice = visibleUserIds.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE)
        const sliceKey = slice.join(",")

        if (slice.length === 0) {
          setIsLoadingUsers(false)
          return
        }

        if (loadedSliceKeys.current.has(sliceKey)) {
          setIsLoadingUsers(false)
          return
        }

        loadedSliceKeys.current.add(sliceKey)

        const { data: userData, error: userError } = await supabase
          .from("users")
          .select("user_id, full_name, avatar_url, contribution_details, created_at, location_id")
          .in("user_id", slice)
          .is("deleted_at", null)
          .eq("status", "active")
          .eq("is_public", true)

        if (userError) {
          throw userError
        }

        const uniqueUserData = Array.from(
          new Map((userData ?? []).map((user) => [user.user_id, user])).values(),
        )

        const locationIds = uniqueUserData
          .map((user) => user.location_id)
          .filter((locationId): locationId is number => locationId !== null)

        let locationMap: Record<number, string> = {}

        if (locationIds.length > 0) {
          const { data: locationData, error: locationError } = await supabase
            .from("ref_locations")
            .select("id, name")
            .in("id", locationIds)

          if (locationError) {
            throw locationError
          }

          locationMap = (locationData ?? []).reduce<Record<number, string>>((accumulator, location) => {
            accumulator[location.id] = location.name
            return accumulator
          }, {})
        }

        const formattedUsers = uniqueUserData.map((user) => ({
          ...user,
          location: user.location_id ? locationMap[user.location_id] ?? null : null,
          project_count: projectCounts[user.user_id]?.size ?? 0,
        }))

        setUsers((previous) => {
          const existingIds = new Set(previous.map((user) => user.user_id))
          return [...previous, ...formattedUsers.filter((user) => !existingIds.has(user.user_id))]
        })
      } catch (error) {
        console.error("Error fetching users:", error)
        loadedSliceKeys.current.delete(visibleUserIds.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE).join(","))
        setErrorMsg("Failed to load members. Please try again later.")
      } finally {
        setIsLoadingUsers(false)
      }
    }

    void fetchUsers()
  }, [errorMsg, page, projectCounts, visibleUserIds])

  const filteredUsers = useMemo(() => {
    const normalizedTerm = searchTerm.trim().toLowerCase()

    if (!normalizedTerm) {
      return users
    }

    return users.filter((user) => {
      return (
        (user.full_name ?? "").toLowerCase().includes(normalizedTerm) ||
        (user.location ?? "").toLowerCase().includes(normalizedTerm) ||
        (user.contribution_details ?? "").toLowerCase().includes(normalizedTerm)
      )
    })
  }, [searchTerm, users])

  useEffect(() => {
    const observedLoader = loader.current
    if (!observedLoader) {
      return
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0].isIntersecting || isLoadingUsers) {
          return
        }

        setPage((currentPage) => {
          if ((currentPage + 1) * PAGE_SIZE < visibleUserIds.length) {
            return currentPage + 1
          }
          return currentPage
        })
      },
      { threshold: 1 },
    )

    observer.observe(observedLoader)

    return () => observer.disconnect()
  }, [isLoadingUsers, visibleUserIds.length])

  const getTimeAgo = (dateString: string | null) => {
    if (!dateString) return "Recently"

    const date = new Date(dateString)
    const now = new Date()
    const diffInMonths = (now.getFullYear() - date.getFullYear()) * 12 + now.getMonth() - date.getMonth()

    if (diffInMonths < 1) return "Less than a month ago"
    if (diffInMonths === 1) return "1 month ago"
    return `${diffInMonths} months ago`
  }

  const clearFilters = () => {
    setSearchTerm("")
    setSelectedProjectId("all")
  }

  const showSkeletons = isBootstrapping || (isLoadingUsers && users.length === 0)

  return (
    <div className="container mx-auto px-4 py-12">
      <div className="mb-8 flex items-center gap-2">
        <Button asChild variant="ghost" size="sm" className="gap-1">
          <Link href="/">
            <ArrowLeft className="h-4 w-4" />
            <span>Back to Home</span>
          </Link>
        </Button>
      </div>

      <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="max-w-3xl">
          <h1 className="text-3xl font-bold md:text-4xl">Community Members</h1>
          <p className="mt-2 text-slate-600 dark:text-slate-300">
            Meet some of the people who make up the FundLoop ecosystem.
          </p>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            Don&apos;t worry, your profile won&apos;t be displayed publicly here unless you first give us permission to do so.
          </p>
        </div>

        <div className="flex w-full flex-col gap-2 md:w-auto md:min-w-[420px]">
          <div className="relative w-full">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-500 dark:text-slate-400" />
            <Input
              placeholder="Search public members..."
              className="pl-8"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
            />
          </div>
          <div className="flex gap-2">
            <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
              <SelectTrigger className="w-full md:w-[260px]">
                <SelectValue placeholder="Filter by project" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All projects</SelectItem>
                {projects.map((project) => (
                  <SelectItem key={project.id} value={project.id.toString()}>
                    {project.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {(searchTerm || selectedProjectId !== "all") && (
              <Button variant="outline" onClick={clearFilters}>
                Clear
              </Button>
            )}
          </div>
        </div>
      </div>

      {errorMsg && !showSkeletons ? (
        <div className="py-12 text-center text-red-600 dark:text-red-400">{errorMsg}</div>
      ) : showSkeletons ? (
        <div className="grid grid-cols-2 gap-6 md:grid-cols-3 lg:grid-cols-4">
          {Array(8)
            .fill(0)
            .map((_, index) => (
              <Card key={index}>
                <CardHeader className="pb-2 text-center">
                  <div className="mx-auto mb-2 h-16 w-16 rounded-full bg-slate-200 dark:bg-slate-700" />
                  <div className="mx-auto h-5 w-24 rounded bg-slate-200 dark:bg-slate-700" />
                </CardHeader>
                <CardContent className="text-center">
                  <div className="mx-auto mb-2 h-6 w-16 rounded bg-slate-200 dark:bg-slate-700" />
                  <div className="mx-auto mb-1 h-4 w-20 rounded bg-slate-200 dark:bg-slate-700" />
                  <div className="mx-auto mb-2 h-4 w-24 rounded bg-slate-200 dark:bg-slate-700" />
                  <div className="mx-auto h-4 w-16 rounded bg-slate-200 dark:bg-slate-700" />
                </CardContent>
              </Card>
            ))}
        </div>
      ) : filteredUsers.length === 0 ? (
        <div className="py-12 text-center">
          <p className="mb-4 text-lg text-slate-600 dark:text-slate-300">
            {selectedProjectId === "all"
              ? "No public members found matching your search."
              : "No public members found for that project and search combination."}
          </p>
          <Button onClick={clearFilters}>Clear Filters</Button>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-6 md:grid-cols-3 lg:grid-cols-4">
          {filteredUsers.map((user) => (
            <Card key={user.user_id}>
              <Link href={`/users/${user.user_id}`} className="block">
                <CardHeader className="pb-2 text-center">
                  <Avatar className="mx-auto mb-2 h-16 w-16">
                    <AvatarImage
                      src={user.avatar_url || "/placeholder.svg?height=40&width=40"}
                      alt={user.full_name || "User"}
                    />
                    <AvatarFallback>{(user.full_name || "U").substring(0, 2)}</AvatarFallback>
                  </Avatar>
                  <CardTitle className="text-base">{user.full_name || "Unnamed User"}</CardTitle>
                </CardHeader>
                <CardContent className="text-center">
                  <Badge className="mb-2">{user.contribution_details || "Community Member"}</Badge>
                  {user.location ? (
                    <p className="mb-1 text-xs text-slate-500 dark:text-slate-400">{user.location}</p>
                  ) : null}
                  <p className="mb-2 text-xs text-slate-500 dark:text-slate-400">Joined {getTimeAgo(user.created_at)}</p>
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
