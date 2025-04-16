"use client"

import { useState, useEffect } from "react"
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "@/components/ui/use-toast"
import { format } from "date-fns"
import type { Database } from "@/types/supabase"

interface InvitationCodeWithUser {
  code: string
  created_by: string
  inviter_name: string
  usage_count: number
  max_uses: number | null
  expires_at: string | null
  created_at: string
  invited_users: {
    user_id: string
    full_name: string
    created_at: string
  }[]
}

export function InvitationAttribution() {
  const [invitationCodes, setInvitationCodes] = useState<InvitationCodeWithUser[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClientComponentClient<Database>()

  useEffect(() => {
    fetchInvitationCodes()
  }, [])

  const fetchInvitationCodes = async () => {
    try {
      setLoading(true)

      // Fetch invitation codes
      const { data: codesData, error: codesError } = await supabase
        .from("invitation_codes")
        .select("*")
        .order("created_at", { ascending: false })

      if (codesError) throw codesError

      if (!codesData || codesData.length === 0) {
        setInvitationCodes([])
        return
      }

      // Get all creator user IDs
      const creatorIds = codesData.map((code) => code.created_by).filter(Boolean)

      // Fetch creator names
      const { data: creatorsData, error: creatorsError } = await supabase
        .from("users")
        .select("user_id, full_name")
        .in("user_id", creatorIds)

      if (creatorsError) throw creatorsError

      // Create a map of user IDs to names
      const creatorMap = new Map()
      creatorsData?.forEach((creator) => {
        creatorMap.set(creator.user_id, creator.full_name)
      })

      // Fetch users who used each invitation code
      const invitationCodesWithUsers = await Promise.all(
        codesData.map(async (code) => {
          const { data: invitedUsers, error: invitedError } = await supabase
            .from("users")
            .select("user_id, full_name, created_at")
            .eq("invited_by_code", code.code)
            .order("created_at", { ascending: false })

          if (invitedError) {
            console.error("Error fetching invited users:", invitedError)
            return {
              ...code,
              inviter_name: creatorMap.get(code.created_by) || "Unknown",
              invited_users: [],
            }
          }

          return {
            ...code,
            inviter_name: creatorMap.get(code.created_by) || "Unknown",
            invited_users: invitedUsers || [],
          }
        }),
      )

      setInvitationCodes(invitationCodesWithUsers)
    } catch (error) {
      console.error("Error fetching invitation codes:", error)
      toast({
        title: "Error",
        description: "Failed to load invitation codes",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateString: string) => {
    return format(new Date(dateString), "MMM d, yyyy h:mm a")
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Invitation Attribution</CardTitle>
          <CardDescription>Track invitation codes and their usage</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Invitation Attribution</CardTitle>
        <CardDescription>Track invitation codes and their usage</CardDescription>
      </CardHeader>
      <CardContent>
        {invitationCodes.length === 0 ? (
          <div className="text-center py-6">
            <p className="text-slate-500 dark:text-slate-400">No invitation codes found</p>
          </div>
        ) : (
          <div className="space-y-6">
            {invitationCodes.map((code) => (
              <div key={code.code} className="border rounded-lg p-4">
                <div className="flex flex-col md:flex-row justify-between mb-4">
                  <div>
                    <h3 className="font-medium flex items-center gap-2">
                      <span className="font-mono">{code.code}</span>
                      <Badge variant="outline" className="ml-2">
                        {code.usage_count} {code.usage_count === 1 ? "use" : "uses"}
                      </Badge>
                      {code.max_uses && <Badge variant="outline">{code.max_uses - code.usage_count} remaining</Badge>}
                    </h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      Created by {code.inviter_name} on {formatDate(code.created_at)}
                    </p>
                    {code.expires_at && (
                      <p className="text-sm text-slate-500 dark:text-slate-400">
                        Expires on {formatDate(code.expires_at)}
                      </p>
                    )}
                  </div>
                </div>

                {code.invited_users.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>User</TableHead>
                        <TableHead>Joined</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {code.invited_users.map((user) => (
                        <TableRow key={user.user_id}>
                          <TableCell className="font-medium">{user.full_name}</TableCell>
                          <TableCell>{formatDate(user.created_at)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <p className="text-sm text-slate-500 dark:text-slate-400 py-2">
                    No users have used this invitation code yet
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
