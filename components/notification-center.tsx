"use client"

import { useState, useEffect } from "react"
import { Bell, Check, X, Building2 } from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { toast } from "@/components/ui/use-toast"
import { supabase } from "@/lib/supabase"

interface Notification {
  id: number
  type: string
  content: any
  is_read: boolean
  created_at: string
}

export function NotificationCenter() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    fetchNotifications()

    // Set up real-time subscription for new notifications
    const channel = supabase
      .channel("notification_changes")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "user_notifications",
          filter: `user_id=eq.${getCurrentUserId()}`,
        },
        (payload) => {
          setNotifications((prev) => [payload.new as Notification, ...prev])
          setUnreadCount((prev) => prev + 1)
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  // Mock function to get current user ID - replace with your auth logic
  const getCurrentUserId = () => {
    return 1 // Mock user ID
  }

  const fetchNotifications = async () => {
    try {
      // In a real app, you would fetch from Supabase
      // For demo purposes, we'll use mock data
      const mockNotifications: Notification[] = [
        {
          id: 1,
          type: "invitation",
          content: {
            organization_id: 2,
            organization_name: "Digital Nomads Collective",
            invitation_id: 101,
            role: "member",
            invited_by: "Jamie Chen",
          },
          is_read: false,
          created_at: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
        },
        {
          id: 2,
          type: "invitation",
          content: {
            organization_id: 3,
            organization_name: "Green Earth Initiative",
            invitation_id: 102,
            role: "admin",
            invited_by: "Sam Washington",
          },
          is_read: false,
          created_at: new Date(Date.now() - 86400000).toISOString(), // 1 day ago
        },
      ]

      setNotifications(mockNotifications)
      setUnreadCount(mockNotifications.filter((n) => !n.is_read).length)
    } catch (error) {
      console.error("Error fetching notifications:", error)
    }
  }

  const handleAcceptInvitation = async (notificationId: number, invitationId: number, organizationId: number) => {
    setIsLoading(true)
    try {
      // In a real app, you would update in Supabase
      // For demo purposes, we'll just update the local state

      // 1. Accept the invitation in the database
      // await supabase.from('organization_invitations').update({ status: 'accepted' }).eq('id', invitationId)

      // 2. Add the user to the organization
      // await supabase.from('organization_members').insert({
      //   organization_id: organizationId,
      //   user_id: getCurrentUserId(),
      //   role: notification.content.role
      // })

      // 3. Mark the notification as read
      // await supabase.from('user_notifications').update({ is_read: true }).eq('id', notificationId)

      // Update local state
      setNotifications((prev) =>
        prev.map((n) =>
          n.id === notificationId ? { ...n, is_read: true, content: { ...n.content, status: "accepted" } } : n,
        ),
      )
      setUnreadCount((prev) => Math.max(0, prev - 1))

      toast({
        title: "Invitation accepted",
        description: "You have been added to the organization.",
      })
    } catch (error) {
      console.error("Error accepting invitation:", error)
      toast({
        title: "Error",
        description: "Failed to accept invitation. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleDeclineInvitation = async (notificationId: number, invitationId: number) => {
    setIsLoading(true)
    try {
      // In a real app, you would update in Supabase
      // For demo purposes, we'll just update the local state

      // 1. Decline the invitation in the database
      // await supabase.from('organization_invitations').update({ status: 'declined' }).eq('id', invitationId)

      // 2. Mark the notification as read
      // await supabase.from('user_notifications').update({ is_read: true }).eq('id', notificationId)

      // Update local state
      setNotifications((prev) =>
        prev.map((n) =>
          n.id === notificationId ? { ...n, is_read: true, content: { ...n.content, status: "declined" } } : n,
        ),
      )
      setUnreadCount((prev) => Math.max(0, prev - 1))

      toast({
        title: "Invitation declined",
        description: "You have declined the invitation.",
      })
    } catch (error) {
      console.error("Error declining invitation:", error)
      toast({
        title: "Error",
        description: "Failed to decline invitation. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const markAllAsRead = async () => {
    try {
      // In a real app, you would update in Supabase
      // await supabase.from('user_notifications').update({ is_read: true }).eq('user_id', getCurrentUserId())

      // Update local state
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })))
      setUnreadCount(0)

      toast({
        title: "Notifications marked as read",
      })
    } catch (error) {
      console.error("Error marking notifications as read:", error)
    }
  }

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000)

    if (diffInSeconds < 60) return `${diffInSeconds} seconds ago`
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} minutes ago`
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hours ago`
    return `${Math.floor(diffInSeconds / 86400)} days ago`
  }

  const renderNotification = (notification: Notification) => {
    switch (notification.type) {
      case "invitation":
        const { organization_name, invitation_id, organization_id, role, invited_by, status } = notification.content

        if (status === "accepted") {
          return (
            <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-md">
              <div className="flex items-start gap-3">
                <Building2 className="h-5 w-5 text-emerald-500 mt-0.5" />
                <div>
                  <p className="text-sm">
                    You accepted the invitation to join <span className="font-medium">{organization_name}</span> as a{" "}
                    {role}.
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    {formatTimeAgo(notification.created_at)}
                  </p>
                </div>
              </div>
            </div>
          )
        }

        if (status === "declined") {
          return (
            <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-md">
              <div className="flex items-start gap-3">
                <Building2 className="h-5 w-5 text-slate-500 mt-0.5" />
                <div>
                  <p className="text-sm">
                    You declined the invitation to join <span className="font-medium">{organization_name}</span>.
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    {formatTimeAgo(notification.created_at)}
                  </p>
                </div>
              </div>
            </div>
          )
        }

        return (
          <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-md">
            <div className="flex items-start gap-3">
              <Building2 className="h-5 w-5 text-emerald-500 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm">
                  <span className="font-medium">{invited_by}</span> invited you to join{" "}
                  <span className="font-medium">{organization_name}</span> as a {role}.
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  {formatTimeAgo(notification.created_at)}
                </p>
                <div className="flex gap-2 mt-3">
                  <Button
                    size="sm"
                    className="h-8"
                    onClick={() => handleAcceptInvitation(notification.id, invitation_id, organization_id)}
                    disabled={isLoading}
                  >
                    <Check className="h-4 w-4 mr-1" />
                    Accept
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8"
                    onClick={() => handleDeclineInvitation(notification.id, invitation_id)}
                    disabled={isLoading}
                  >
                    <X className="h-4 w-4 mr-1" />
                    Decline
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )

      default:
        return (
          <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-md">
            <p className="text-sm">Unknown notification type</p>
          </div>
        )
    }
  }

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge
              className="absolute -top-1 -right-1 px-1 min-w-[1.25rem] h-5 flex items-center justify-center"
              variant="destructive"
            >
              {unreadCount}
            </Badge>
          )}
          <span className="sr-only">Notifications</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="flex items-center justify-between p-4">
          <h3 className="font-medium">Notifications</h3>
          {unreadCount > 0 && (
            <Button variant="ghost" size="sm" onClick={markAllAsRead}>
              Mark all as read
            </Button>
          )}
        </div>
        <Separator />
        <div className="max-h-[400px] overflow-y-auto">
          {notifications.length === 0 ? (
            <div className="p-4 text-center text-sm text-slate-500 dark:text-slate-400">No notifications</div>
          ) : (
            <div className="space-y-2 p-2">
              {notifications.map((notification) => (
                <div key={notification.id} className={notification.is_read ? "opacity-70" : ""}>
                  {renderNotification(notification)}
                </div>
              ))}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
