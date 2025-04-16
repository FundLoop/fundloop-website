"use client"

import { useState, useEffect } from "react"
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs"
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination"
import { Search, RefreshCw, ChevronDown, ChevronRight, Trash2 } from "lucide-react"
import { toast } from "@/components/ui/use-toast"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { formatDistanceToNow } from "date-fns"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

interface Organization {
  id: number
  name: string
  description: string | null
  status: string
  created_at: string
  members: {
    id: number
    user_id: string
    full_name: string
    role: string
  }[]
  projects: {
    id: number
    name: string
    description: string
    status: string
  }[]
}

export function OrganizationsTable() {
  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const [expandedOrgs, setExpandedOrgs] = useState<Record<number, boolean>>({})
  const [selectedOrganization, setSelectedOrganization] = useState<Organization | null>(null)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const pageSize = 5

  const supabase = createClientComponentClient()

  const fetchOrganizations = async () => {
    setLoading(true)
    try {
      // Build the query for organizations
      let query = supabase.from("organizations").select(
        `
          id, 
          name, 
          description, 
          status, 
          created_at
        `,
        { count: "exact" },
      )

      // Apply search filter
      if (searchTerm) {
        query = query.ilike("name", `%${searchTerm}%`)
      }

      // Get count first
      const { count, error: countError } = await query

      if (countError) throw countError

      setTotalCount(count || 0)
      setTotalPages(Math.ceil((count || 0) / pageSize))

      // Then get paginated data
      const { data: orgsData, error } = await query.range((page - 1) * pageSize, page * pageSize - 1).order("name")

      if (error) throw error

      if (!orgsData) {
        setOrganizations([])
        return
      }

      // For each organization, fetch members and projects
      const orgsWithDetails = await Promise.all(
        orgsData.map(async (org) => {
          // Fetch members
          const { data: membersData, error: membersError } = await supabase
            .from("organization_members")
            .select(
              `
            id,
            user_id,
            role_id,
            users(full_name),
            ref_roles!inner(name)
          `,
            )
            .eq("organization_id", org.id)
            .eq("status", "active")

          if (membersError) throw membersError

          // Fetch projects
          const { data: projectsData, error: projectsError } = await supabase
            .from("projects")
            .select(`
            id,
            name,
            description,
            status
          `)
            .eq("organization_id", org.id)

          if (projectsError) throw projectsError

          // Format the data
          const members = membersData.map((member) => ({
            id: member.id,
            user_id: member.user_id,
            full_name: member.users?.full_name,
            role: member.ref_roles.name,
          }))

          const projects = projectsData || []

          return {
            ...org,
            members,
            projects,
          }
        }),
      )

      setOrganizations(orgsWithDetails)
    } catch (error) {
      console.error("Error fetching organizations:", error)
      toast({
        title: "Error",
        description: "Failed to load organizations data",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchOrganizations()
  }, [page, searchTerm])

  const formatDate = (dateString: string) => {
    return formatDistanceToNow(new Date(dateString), { addSuffix: true })
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return <Badge variant="success">Active</Badge>
      case "inactive":
        return <Badge variant="secondary">Inactive</Badge>
      case "deleted":
        return <Badge variant="destructive">Deleted</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  const toggleOrgExpanded = (orgId: number) => {
    setExpandedOrgs((prev) => ({
      ...prev,
      [orgId]: !prev[orgId],
    }))
  }

  const handleDeleteOrganization = async () => {
    if (!selectedOrganization) return

    try {
      const { error } = await supabase.rpc("soft_delete_organizations", { p_id: selectedOrganization.id })

      if (error) throw error

      toast({
        title: "Organization Deleted",
        description: `${selectedOrganization.name} has been deleted.`,
      })
      fetchOrganizations()
    } catch (error) {
      console.error("Error deleting organization:", error)
      toast({
        title: "Error",
        description: "Failed to delete organization",
        variant: "destructive",
      })
    } finally {
      setIsDeleteDialogOpen(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row justify-between gap-4">
        <div className="flex gap-2 w-full md:w-auto">
          <div className="relative flex-grow">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
            <Input
              placeholder="Search by name..."
              className="pl-8"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value)
                setPage(1) // Reset to first page on search
              }}
            />
          </div>

          <Button variant="outline" size="icon" onClick={fetchOrganizations} title="Refresh">
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>

        <div className="text-sm text-slate-500">Total: {totalCount} organizations</div>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableCaption>List of all organizations with their members and projects</TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[50px]"></TableHead>
              <TableHead>Organization</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Created At</TableHead>
              <TableHead>Members</TableHead>
              <TableHead>Projects</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8">
                  Loading organizations...
                </TableCell>
              </TableRow>
            ) : organizations.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8">
                  No organizations found
                </TableCell>
              </TableRow>
            ) : (
              organizations.map((org) => (
                <Collapsible
                  key={org.id}
                  open={expandedOrgs[org.id]}
                  onOpenChange={() => toggleOrgExpanded(org.id)}
                  className="w-full"
                >
                  <TableRow className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800">
                    <TableCell>
                      <CollapsibleTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                          {expandedOrgs[org.id] ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                        </Button>
                      </CollapsibleTrigger>
                    </TableCell>
                    <TableCell className="font-medium">{org.name}</TableCell>
                    <TableCell>{getStatusBadge(org.status)}</TableCell>
                    <TableCell>{formatDate(org.created_at)}</TableCell>
                    <TableCell>{org.members.length}</TableCell>
                    <TableCell>{org.projects.length}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => {
                          setSelectedOrganization(org)
                          setIsDeleteDialogOpen(true)
                        }}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete
                      </Button>
                    </TableCell>
                  </TableRow>

                  <CollapsibleContent>
                    <TableRow>
                      <TableCell colSpan={7} className="p-0">
                        <div className="p-4 bg-slate-50 dark:bg-slate-800">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Members Section */}
                            <div>
                              <h3 className="text-sm font-medium mb-2">Members</h3>
                              <div className="rounded-md border bg-white dark:bg-slate-950">
                                <Table>
                                  <TableHeader>
                                    <TableRow>
                                      <TableHead>Name</TableHead>
                                      <TableHead>Role</TableHead>
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {org.members.length === 0 ? (
                                      <TableRow>
                                        <TableCell colSpan={2} className="text-center py-4">
                                          No members
                                        </TableCell>
                                      </TableRow>
                                    ) : (
                                      org.members.map((member) => (
                                        <TableRow key={member.id}>
                                          <TableCell>{member.full_name}</TableCell>
                                          <TableCell>
                                            <Badge variant="outline">{member.role}</Badge>
                                          </TableCell>
                                        </TableRow>
                                      ))
                                    )}
                                  </TableBody>
                                </Table>
                              </div>
                            </div>

                            {/* Projects Section */}
                            <div>
                              <h3 className="text-sm font-medium mb-2">Projects</h3>
                              <div className="rounded-md border bg-white dark:bg-slate-950">
                                <Table>
                                  <TableHeader>
                                    <TableRow>
                                      <TableHead>Name</TableHead>
                                      <TableHead>Status</TableHead>
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {org.projects.length === 0 ? (
                                      <TableRow>
                                        <TableCell colSpan={2} className="text-center py-4">
                                          No projects
                                        </TableCell>
                                      </TableRow>
                                    ) : (
                                      org.projects.map((project) => (
                                        <TableRow key={project.id}>
                                          <TableCell>{project.name}</TableCell>
                                          <TableCell>{getStatusBadge(project.status)}</TableCell>
                                        </TableRow>
                                      ))
                                    )}
                                  </TableBody>
                                </Table>
                              </div>
                            </div>
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                  </CollapsibleContent>
                </Collapsible>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && (
        <Pagination>
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} />
            </PaginationItem>

            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              // Show pages around the current page
              let pageNum = page
              if (page <= 3) {
                pageNum = i + 1
              } else if (page >= totalPages - 2) {
                pageNum = totalPages - 4 + i
              } else {
                pageNum = page - 2 + i
              }

              if (pageNum > 0 && pageNum <= totalPages) {
                return (
                  <PaginationItem key={pageNum}>
                    <PaginationLink isActive={page === pageNum} onClick={() => setPage(pageNum)}>
                      {pageNum}
                    </PaginationLink>
                  </PaginationItem>
                )
              }
              return null
            })}

            <PaginationItem>
              <PaginationNext
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      )}

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Organization</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {selectedOrganization?.name}? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setIsDeleteDialogOpen(false)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteOrganization} className="bg-red-500 hover:bg-red-600">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
