"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ArrowLeft, Briefcase, Wallet, Settings, Copy, Share2, Plus } from "lucide-react"
import { getUserEmails, getUserWallets } from "@/app/actions/auth-actions"
import { toast } from "@/components/ui/use-toast"
import { Input } from "@/components/ui/input"
import type { Tables } from "@/types/supabase"
import { supabase } from "@/lib/supabase"

type User = Tables<"users">

interface Project {
  id: number
  name: string
  logo: string
  description: string
  category: string
}

interface Organization {
  id: number
  name: string
  logo: string
  role: string
  projects: Project[]
}

interface InvitationCode {
  code: string
  usage_count: number
  max_uses: number | null
  expires_at: string | null
  created_at: string
}

export default function MyProfilePage() {
  const [loading, setLoading] = useState(true)
  const [myProjects, setMyProjects] = useState<Project[]>([])
  const [myOrganizations, setMyOrganizations] = useState<Organization[]>([])
  const [primaryEmail, setPrimaryEmail] = useState<string | null>(null)
  const [primaryWallet, setPrimaryWallet] = useState<string | null>(null)
  const [primaryWalletName, setPrimaryWalletName] = useState<string | null>(null)
  const [primaryWalletType, setPrimaryWalletType] = useState<string | null>(null)
  const [invitationCode, setInvitationCode] = useState<InvitationCode | null>(null)
  const [generatingCode, setGeneratingCode] = useState(false)
  const [inviteLink, setInviteLink] = useState<string>("")

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        setLoading(true)

        // Fetch emails and wallets
        const emails = await getUserEmails()
        const wallets = await getUserWallets()

        // Find primary email
        const primary = emails.find((email) => email.is_primary)
        if (primary) {
          setPrimaryEmail(primary.email)
        }

        // Find primary wallet
        const primaryWallet = wallets.find((wallet) => wallet.is_primary)
        if (primaryWallet) {
          setPrimaryWallet(primaryWallet.wallet_address)
          setPrimaryWalletName(primaryWallet.wallet_name)
          setPrimaryWalletType(primaryWallet.wallet_type)
        }

        // In a real app, you would fetch from Supabase
        // For demo purposes, we'll use mock data
        const mockProjects: Project[] = [
          {
            id: 1,
            name: "EcoStream",
            logo: "/placeholder.svg?height=40&width=40",
            description: "Sustainable video streaming platform with carbon-neutral infrastructure",
            category: "Media",
          },
          {
            id: 3,
            name: "Nomad Workspace",
            logo: "/placeholder.svg?height=40&width=40",
            description: "Global network of sustainable co-working spaces for digital nomads",
            category: "Workspace",
          },
        ]

        const mockOrganizations: Organization[] = [
          {
            id: 1,
            name: "Eco Innovations Inc.",
            logo: "/placeholder.svg?height=40&width=40",
            role: "Admin",
            projects: [
              {
                id: 1,
                name: "EcoStream",
                logo: "/placeholder.svg?height=40&width=40",
                description: "Sustainable video streaming platform with carbon-neutral infrastructure",
                category: "Media",
              },
            ],
          },
          {
            id: 2,
            name: "Digital Nomads Collective",
            logo: "/placeholder.svg?height=40&width=40",
            role: "Member",
            projects: [
              {
                id: 3,
                name: "Nomad Workspace",
                logo: "/placeholder.svg?height=40&width=40",
                description: "Global network of sustainable co-working spaces for digital nomads",
                category: "Workspace",
              },
            ],
          },
        ]

        setMyProjects(mockProjects)
        setMyOrganizations(mockOrganizations)

        // Fetch invitation code if exists
        await fetchInvitationCode()
      } catch (error) {
        console.error("Error fetching user data:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchUserData()
  }, [supabase])

  const fetchInvitationCode = async () => {
    try {
      // Get current user ID
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) return

      // Fetch invitation code
      const { data, error } = await supabase
        .from("invitation_codes")
        .select("*")
        .eq("created_by", user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .single()

      if (error) {
        if (error.code !== "PGRST116") {
          // PGRST116 is "no rows returned" error
          console.error("Error fetching invitation code:", error)
        }
        return
      }

      if (data) {
        setInvitationCode(data)

        // Generate invite link
        const baseUrl = window.location.origin
        const link = `${baseUrl}/join?invite=${data.code}`
        setInviteLink(link)
      }
    } catch (error) {
      console.error("Error fetching invitation code:", error)
    }
  }

  const generateInvitationCode = async () => {
    try {
      setGeneratingCode(true)

      // Generate a new invitation code
      const { data, error } = await supabase
        .from("invitation_codes")
        .insert([{}]) // The default values will be used (code will be auto-generated)
        .select()
        .single()

      if (error) throw error

      setInvitationCode(data)

      // Generate invite link
      const baseUrl = window.location.origin
      const link = `${baseUrl}/join?invite=${data.code}`
      setInviteLink(link)

      toast({
        title: "Invitation code generated",
        description: "Your invitation code has been generated successfully.",
      })
    } catch (error) {
      console.error("Error generating invitation code:", error)
      toast({
        title: "Error",
        description: "Failed to generate invitation code. Please try again.",
        variant: "destructive",
      })
    } finally {
      setGeneratingCode(false)
    }
  }

  const copyToClipboard = (text: string, type: "code" | "link") => {
    navigator.clipboard.writeText(text)
    toast({
      title: `${type === "code" ? "Invitation code" : "Invitation link"} copied`,
      description: `The ${type} has been copied to your clipboard.`,
    })
  }

  const shareInviteLink = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: "Join FundLoop",
          text: "Join FundLoop using my invitation link:",
          url: inviteLink,
        })
      } catch (error) {
        console.error("Error sharing:", error)
      }
    } else {
      copyToClipboard(inviteLink, "link")
    }
  }

  const getTimeAgo = (dateString: string | null) => {
    if (!dateString) return "Recently"

    const date = new Date(dateString)
    const now = new Date()
    const diffInMonths = (now.getFullYear() - date.getFullYear()) * 12 + now.getMonth() - date.getMonth()

    if (diffInMonths < 1) return "Less than a month ago"
    if (diffInMonths === 1) return "1 month ago"
    return `${diffInMonths} months ago`
  }

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-12 flex justify-center">
        <p>Loading profile data...</p>
      </div>
    )
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

      <div className="grid md:grid-cols-4 gap-8">
        <div className="md:col-span-1">
          <Card>
            <CardHeader className="text-center">
              <Avatar className="h-24 w-24 mx-auto mb-4">
                <AvatarImage src="/placeholder.svg?height=100&width=100" alt="Alex Rivera" />
                <AvatarFallback>AR</AvatarFallback>
              </Avatar>
              <CardTitle>Alex Rivera</CardTitle>
              <CardDescription>{primaryEmail}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Badge className="mb-4">Community Moderator</Badge>
              <p className="text-sm text-slate-600 dark:text-slate-300 mb-6">Barcelona, Spain • Joined 6 months ago</p>

              {primaryWallet && (
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                    <Wallet className="h-4 w-4" />
                    <span>Primary Wallet:</span>
                  </div>
                  <p className="text-xs font-mono bg-slate-100 dark:bg-slate-800 p-2 rounded">
                    {primaryWalletName ? `${primaryWalletName} (${primaryWalletType})` : primaryWallet}
                  </p>
                </div>
              )}

              {/* Invitation Code Section */}
              <div className="pt-4 border-t mt-4">
                <h3 className="text-sm font-medium mb-2">Invitation Code</h3>

                {invitationCode ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between bg-slate-100 dark:bg-slate-800 p-2 rounded">
                      <code className="text-xs font-mono">{invitationCode.code}</code>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => copyToClipboard(invitationCode.code, "code")}
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
                    </div>

                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      <p>Used {invitationCode.usage_count} times</p>
                      {invitationCode.max_uses && (
                        <p>{invitationCode.max_uses - invitationCode.usage_count} uses remaining</p>
                      )}
                      {invitationCode.expires_at && (
                        <p>Expires on {new Date(invitationCode.expires_at).toLocaleDateString()}</p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <p className="text-xs font-medium">Invitation Link</p>
                      <div className="flex items-center gap-2">
                        <Input
                          value={inviteLink}
                          readOnly
                          className="text-xs h-8"
                          onClick={(e) => (e.target as HTMLInputElement).select()}
                        />
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => copyToClipboard(inviteLink, "link")}
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </Button>
                      </div>

                      <Button variant="outline" size="sm" className="w-full gap-1" onClick={shareInviteLink}>
                        <Share2 className="h-3.5 w-3.5" />
                        Share Invitation Link
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full gap-1"
                    onClick={generateInvitationCode}
                    disabled={generatingCode}
                  >
                    <Plus className="h-3.5 w-3.5" />
                    {generatingCode ? "Generating..." : "Generate Invitation Code"}
                  </Button>
                )}
              </div>

              <Button asChild className="w-full" variant="outline">
                <Link href="/settings">
                  <Settings className="h-4 w-4 mr-2" />
                  Edit Profile
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>

        <div className="md:col-span-3">
          <Tabs defaultValue="projects">
            <TabsList className="mb-6">
              <TabsTrigger value="projects">My Projects</TabsTrigger>
              <TabsTrigger value="organizations">My Organizations</TabsTrigger>
            </TabsList>

            <TabsContent value="projects" className="space-y-6">
              <h2 className="text-2xl font-bold mb-4">My Projects</h2>
              {myProjects.length === 0 ? (
                <Card>
                  <CardContent className="py-8 text-center">
                    <p className="text-slate-600 dark:text-slate-300 mb-4">You haven't joined any projects yet.</p>
                    <Button asChild>
                      <Link href="/projects">Browse Projects</Link>
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid md:grid-cols-2 gap-4">
                  {myProjects.map((project) => (
                    <Card key={project.id} className="overflow-hidden">
                      <Link href={`/projects/${project.id}`} className="block">
                        <CardHeader className="pb-2">
                          <div className="flex justify-between items-start">
                            <div className="flex items-center gap-2">
                              <Avatar className="h-10 w-10">
                                <AvatarImage src={project.logo || "/placeholder.svg"} alt={project.name} />
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
                          <p className="text-sm text-slate-600 dark:text-slate-300">{project.description}</p>
                        </CardContent>
                      </Link>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="organizations" className="space-y-6">
              <h2 className="text-2xl font-bold mb-4">My Organizations</h2>
              {myOrganizations.length === 0 ? (
                <Card>
                  <CardContent className="py-8 text-center">
                    <p className="text-slate-600 dark:text-slate-300 mb-4">
                      You don't belong to any organizations yet.
                    </p>
                    <Button asChild>
                      <Link href="/organizations">Browse Organizations</Link>
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-8">
                  {myOrganizations.map((org) => (
                    <Card key={org.id}>
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <Avatar className="h-12 w-12">
                              <AvatarImage src={org.logo || "/placeholder.svg"} alt={org.name} />
                              <AvatarFallback>{org.name.substring(0, 2)}</AvatarFallback>
                            </Avatar>
                            <div>
                              <CardTitle>{org.name}</CardTitle>
                              <CardDescription>Your role: {org.role}</CardDescription>
                            </div>
                          </div>
                          <Button asChild variant="outline" size="sm">
                            <Link href={`/organizations/${org.id}`}>View</Link>
                          </Button>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <h3 className="text-lg font-medium mb-3 flex items-center gap-2">
                          <Briefcase className="h-4 w-4" />
                          Organization Projects
                        </h3>
                        <div className="grid md:grid-cols-2 gap-4">
                          {org.projects.map((project) => (
                            <Card key={project.id} className="overflow-hidden">
                              <Link href={`/projects/${project.id}`} className="block">
                                <CardHeader className="pb-2">
                                  <div className="flex items-center gap-2">
                                    <Avatar className="h-8 w-8">
                                      <AvatarImage src={project.logo || "/placeholder.svg"} alt={project.name} />
                                      <AvatarFallback>{project.name.substring(0, 2)}</AvatarFallback>
                                    </Avatar>
                                    <div>
                                      <CardTitle className="text-base">{project.name}</CardTitle>
                                    </div>
                                  </div>
                                </CardHeader>
                                <CardContent>
                                  <p className="text-xs text-slate-600 dark:text-slate-300">{project.description}</p>
                                </CardContent>
                              </Link>
                            </Card>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  )
}
