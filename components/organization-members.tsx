"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { toast } from "@/components/ui/use-toast"
import { Users, MoreHorizontal, UserPlus, UserMinus, Shield, LogOut } from "lucide-react"
import { InviteMemberForm } from "@/components/invite-member-form"
import { softDelete, updateWithTracking } from "@/lib/db-utils"

interface Member {
  id: number
  name: string
  email: string
  avatar: string
  role: string
  joined: string
}

interface OrganizationMembersProps {
  organizationId: number
  organizationName: string
  members: Member[]
  currentUserId: number
  onMembersChange?: () => void
}

export function OrganizationMembers({
  organizationId,
  organizationName,
  members,
  currentUserId,
  onMembersChange,
}: OrganizationMembersProps) {
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false)
  const [removeDialogOpen, setRemoveDialogOpen] = useState(false)
  const [selectedMember, setSelectedMember] = useState<Member | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const currentUserRole = members.find((m) => m.id === currentUserId)?.role || "member"
  const isAdmin = currentUserRole === "admin"

  const handleRemoveMember = async () => {
    if (!selectedMember) return

    setIsSubmitting(true)

    try {
      // Check if this is the last admin
      if (selectedMember.role === "admin") {
        const adminCount = members.filter((m) => m.role === "admin").length
        if (adminCount <= 1) {
          toast({
            title: "Cannot remove member",
            description: "You cannot remove the last admin from the organization.",
            variant: "destructive",
          })
          setRemoveDialogOpen(false)
          return
        }
      }

      // Check if this would leave the organization empty
      if (members.length <= 1) {
        toast({
          title: "Cannot remove member",
          description: "Organizations must have at least one member.",
          variant: "destructive",
        })
        setRemoveDialogOpen(false)
        return
      }

      // Use the softDelete utility function
      const { error } = await softDelete("organization_members", selectedMember.id)

      if (error) throw error

      toast({
        title: "Member removed",
        description: `${selectedMember.name} has been removed from the organization.`,
      })

      if (onMembersChange) {
        onMembersChange()
      }
    } catch (error) {
      console.error("Error removing member:", error)
      toast({
        title: "Error",
        description: "Failed to remove member. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
      setRemoveDialogOpen(false)
    }
  }

  const handleLeaveOrganization = async () => {
    setIsSubmitting(true)

    try {
      // Check if this is the last admin
      if (currentUserRole === "admin") {
        const adminCount = members.filter((m) => m.role === "admin").length
        if (adminCount <= 1) {
          toast({
            title: "Cannot leave organization",
            description: "You are the last admin. Please promote another member to admin before leaving.",
            variant: "destructive",
          })
          setRemoveDialogOpen(false)
          return
        }
      }

      // Check if this would leave the organization empty
      if (members.length <= 1) {
        toast({
          title: "Cannot leave organization",
          description: "Organizations must have at least one member.",
          variant: "destructive",
        })
        setRemoveDialogOpen(false)
        return
      }

      // Find the member record for the current user
      const currentMember = members.find((m) => m.id === currentUserId)
      if (!currentMember) {
        throw new Error("Current user not found in organization members")
      }

      // Use the softDelete utility function
      const { error } = await softDelete("organization_members", currentMember.id)

      if (error) throw error

      toast({
        title: "Left organization",
        description: `You have left ${organizationName}.`,
      })

      // Redirect to home or profile page
      window.location.href = "/my-profile"
    } catch (error) {
      console.error("Error leaving organization:", error)
      toast({
        title: "Error",
        description: "Failed to leave organization. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
      setRemoveDialogOpen(false)
    }
  }

  const handlePromoteToAdmin = async (member: Member) => {
    try {
      // Use the updateWithTracking utility function
      const { error } = await updateWithTracking("organization_members", member.id, { role: "admin" })

      if (error) throw error

      toast({
        title: "Member promoted",
        description: `${member.name} has been promoted to admin.`,
      })

      if (onMembersChange) {
        onMembersChange()
      }
    } catch (error) {
      console.error("Error promoting member:", error)
      toast({
        title: "Error",
        description: "Failed to promote member. Please try again.",
        variant: "destructive",
      })
    }
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-slate-500" />
            <div>
              <CardTitle className="text-lg">Members</CardTitle>
              <CardDescription>
                {members.length} {members.length === 1 ? "member" : "members"}
              </CardDescription>
            </div>
          </div>
          {isAdmin && (
            <Button size="sm" onClick={() => setInviteDialogOpen(true)}>
              <UserPlus className="h-4 w-4 mr-2" />
              Invite
            </Button>
          )}
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {members.map((member) => (
              <div key={member.id} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={member.avatar} alt={member.name} />
                    <AvatarFallback>{member.name.substring(0, 2)}</AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium">{member.name}</h3>
                      {member.id === currentUserId && (
                        <Badge variant="outline" className="text-xs">
                          You
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Joined {member.joined}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={member.role === "admin" ? "default" : "outline"}>{member.role}</Badge>

                  {(isAdmin || member.id === currentUserId) && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4" />
                          <span className="sr-only">More options</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {isAdmin && member.id !== currentUserId && (
                          <>
                            {member.role !== "admin" && (
                              <DropdownMenuItem onClick={() => handlePromoteToAdmin(member)}>
                                <Shield className="h-4 w-4 mr-2" />
                                Promote to admin
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem
                              onClick={() => {
                                setSelectedMember(member)
                                setRemoveDialogOpen(true)
                              }}
                              className="text-red-600 dark:text-red-400"
                            >
                              <UserMinus className="h-4 w-4 mr-2" />
                              Remove from organization
                            </DropdownMenuItem>
                          </>
                        )}

                        {member.id === currentUserId && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => {
                                setSelectedMember(member)
                                setRemoveDialogOpen(true)
                              }}
                              className="text-red-600 dark:text-red-400"
                            >
                              <LogOut className="h-4 w-4 mr-2" />
                              Leave organization
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Invite Member Dialog */}
      <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invite Member</DialogTitle>
            <DialogDescription>Invite someone to join your organization.</DialogDescription>
          </DialogHeader>

          <InviteMemberForm
            organizationId={organizationId}
            organizationName={organizationName}
            onInviteSent={() => {
              if (onMembersChange) {
                onMembersChange()
              }
            }}
          />
        </DialogContent>
      </Dialog>

      {/* Remove/Leave Member Dialog */}
      <Dialog open={removeDialogOpen} onOpenChange={setRemoveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selectedMember?.id === currentUserId ? "Leave Organization" : "Remove Member"}</DialogTitle>
            <DialogDescription>
              {selectedMember?.id === currentUserId
                ? `Are you sure you want to leave ${organizationName}?`
                : `Are you sure you want to remove ${selectedMember?.name} from ${organizationName}?`}
            </DialogDescription>
          </DialogHeader>

          <DialogFooter>
            <Button variant="outline" onClick={() => setRemoveDialogOpen(false)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={selectedMember?.id === currentUserId ? handleLeaveOrganization : handleRemoveMember}
              disabled={isSubmitting}
            >
              {isSubmitting
                ? selectedMember?.id === currentUserId
                  ? "Leaving..."
                  : "Removing..."
                : selectedMember?.id === currentUserId
                  ? "Leave"
                  : "Remove"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
