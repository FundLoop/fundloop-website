"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { toast } from "@/components/ui/use-toast"
import { ArrowLeft, ArrowRight, Check, Info } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { Tabs, TabsContent } from "@/components/ui/tabs"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Textarea } from "@/components/ui/textarea"
import { Combobox, type ComboboxOption } from "@/components/ui/combobox"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

// Sample recommended projects
const recommendedProjects = [
  {
    id: 1,
    name: "EcoStream",
    logo: "/placeholder.svg?height=40&width=40",
    description: "Sustainable video streaming platform with carbon-neutral infrastructure",
    category: "Media",
  },
  {
    id: 2,
    name: "Harvest",
    logo: "/placeholder.svg?height=40&width=40",
    description: "Farm-to-table marketplace connecting local farmers with consumers",
    category: "Food",
  },
  {
    id: 3,
    name: "Nomad Workspace",
    logo: "/placeholder.svg?height=40&width=40",
    description: "Global network of sustainable co-working spaces for digital nomads",
    category: "Workspace",
  },
  {
    id: 4,
    name: "GreenFinance",
    logo: "/placeholder.svg?height=40&width=40",
    description: "Ethical banking and investment platform focused on sustainability",
    category: "Finance",
  },
]

// Contribution skills
const contributionSkills = [
  { id: "build", label: "Build", description: "Software development, design, or other creation" },
  { id: "market", label: "Market", description: "Marketing, promotion, and community outreach" },
  { id: "manage", label: "Manage", description: "Project management and coordination" },
  { id: "govern", label: "Govern", description: "Governance, decision-making, and policy" },
  { id: "operate", label: "Operate", description: "Day-to-day operations and maintenance" },
  { id: "test", label: "Test", description: "Testing, quality assurance, and feedback" },
  { id: "research", label: "Research", description: "Research, analysis, and data collection" },
  { id: "educate", label: "Educate", description: "Education, training, and documentation" },
  { id: "support", label: "Support", description: "User support and community assistance" },
]

// Add this function to validate email
const validateEmail = (email: string) => {
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return regex.test(email)
}

// Dummy functions for creating new options
const createNewLocation = (value: string) => {
  console.log("Creating new location:", value)
  // In a real app, you would save this to the database
}

const createNewOccupation = (value: string) => {
  console.log("Creating new occupation:", value)
  // In a real app, you would save this to the database
}

const createNewInterest = (value: string) => {
  console.log("Creating new interest:", value)
  // In a real app, you would save this to the database
}

export default function UserSignupFlow({ onClose }: { onClose: () => void }) {
  const searchParams = useSearchParams()
  const inviteCode = searchParams.get("invite")

  const [step, setStep] = useState(1)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [userData, setUserData] = useState({
    name: "",
    email: "",
    wallet: "",
    age: "",
    genderId: "",
    locationId: "",
    interests: [] as string[],
    occupationId: "",
    selectedProjects: [] as number[],
    willContribute: false,
    contributionSkills: [] as string[],
    contributionDetails: "",
    invitationCode: inviteCode || "", // Initialize with URL invite code if present
    status: "active", // Add status field
  })

  // Reference data
  const [genders, setGenders] = useState<ComboboxOption[]>([])
  const [locations, setLocations] = useState<ComboboxOption[]>([])
  const [occupations, setOccupations] = useState<ComboboxOption[]>([])
  const [interests, setInterests] = useState<ComboboxOption[]>([])
  const [loadingReferenceData, setLoadingReferenceData] = useState(true)
  const [isValidInviteCode, setIsValidInviteCode] = useState(inviteCode ? true : false)
  const [checkingInviteCode, setCheckingInviteCode] = useState(false)

  useEffect(() => {
    fetchReferenceData()

    // If we have an invite code from URL, validate it
    if (inviteCode) {
      validateInviteCode(inviteCode)
    }
  }, [inviteCode])

  const validateInviteCode = async (code: string) => {
    if (!code) {
      setIsValidInviteCode(false)
      return false
    }

    setCheckingInviteCode(true)
    try {
      const { data, error } = await supabase.from("invitation_codes").select("code").eq("code", code).single()

      if (error) {
        console.error("Error validating invite code:", error)
        setIsValidInviteCode(false)
        return false
      }

      setIsValidInviteCode(true)
      return true
    } catch (err) {
      console.error("Error validating invite code:", err)
      setIsValidInviteCode(false)
      return false
    } finally {
      setCheckingInviteCode(false)
    }
  }

  const fetchReferenceData = async () => {
    try {
      setLoadingReferenceData(true)

      // In a real app, you would fetch from Supabase
      // For demo purposes, we'll use mock data

      // Fetch genders
      const { data: gendersData, error: gendersError } = await supabase
        .from("ref_genders")
        .select("id, name")
        .order("display_order")

      if (gendersError) throw gendersError

      // Fetch locations
      const { data: locationsData, error: locationsError } = await supabase
        .from("ref_locations")
        .select("id, name")
        .order("name")

      if (locationsError) throw locationsError

      // Fetch occupations
      const { data: occupationsData, error: occupationsError } = await supabase
        .from("ref_occupations")
        .select("id, name")
        .order("name")

      if (occupationsError) throw occupationsError

      // Fetch interests
      const { data: interestsData, error: interestsError } = await supabase
        .from("ref_interests")
        .select("id, name")
        .order("name")

      if (interestsError) throw interestsError

      // Transform data for comboboxes
      setGenders(gendersData?.map((item) => ({ value: item.id.toString(), label: item.name })) || [])
      setLocations(locationsData?.map((item) => ({ value: item.id.toString(), label: item.name })) || [])
      setOccupations(occupationsData?.map((item) => ({ value: item.id.toString(), label: item.name })) || [])
      setInterests(interestsData?.map((item) => ({ value: item.id.toString(), label: item.name })) || [])
    } catch (error) {
      console.error("Error fetching reference data:", error)
      toast({
        title: "Error",
        description: "Failed to load reference data. Please try again.",
        variant: "destructive",
      })
    } finally {
      setLoadingReferenceData(false)
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { id, value } = e.target
    setUserData((prev) => ({ ...prev, [id.replace("user-", "")]: value }))
  }

  const handleInterestToggle = (interestId: string) => {
    setUserData((prev) => {
      const interests = [...prev.interests]
      if (interests.includes(interestId)) {
        return { ...prev, interests: interests.filter((i) => i !== interestId) }
      } else {
        return { ...prev, interests: [...interests, interestId] }
      }
    })
  }

  const handleProjectToggle = (projectId: number) => {
    setUserData((prev) => {
      const selectedProjects = [...prev.selectedProjects]
      if (selectedProjects.includes(projectId)) {
        return { ...prev, selectedProjects: selectedProjects.filter((id) => id !== projectId) }
      } else {
        return { ...prev, selectedProjects: [...selectedProjects, projectId] }
      }
    })
  }

  const handleSkillToggle = (skill: string) => {
    setUserData((prev) => {
      const skills = [...prev.contributionSkills]
      if (skills.includes(skill)) {
        return { ...prev, contributionSkills: skills.filter((s) => s !== skill) }
      } else {
        return { ...prev, contributionSkills: [...skills, skill] }
      }
    })
  }

  const handleSubmitStep1 = async (e: React.FormEvent) => {
    e.preventDefault()

    // Validate email
    if (!validateEmail(userData.email)) {
      toast({
        title: "Invalid email",
        description: "Please enter a valid email address",
        variant: "destructive",
      })
      return
    }

    // Validate invitation code if provided
    if (userData.invitationCode && !isValidInviteCode) {
      const isValid = await validateInviteCode(userData.invitationCode)
      if (!isValid) {
        toast({
          title: "Invalid invitation code",
          description: "The invitation code you entered is not valid",
          variant: "destructive",
        })
        return
      }
    }

    setIsSubmitting(true)

    try {
      // Create user in Supabase with invitation code if provided
      const insertData: any = {
        full_name: userData.name,
        email: userData.email,
        status: userData.status,
      }

      // Add invitation code if provided
      if (userData.invitationCode) {
        insertData.invited_by_code = userData.invitationCode
      }

      const { data, error } = await supabase.from("users").insert([insertData]).select()

      if (error) throw error

      // If wallet address is provided, add it to wallet_accounts table
      if (userData.wallet) {
        const { error: walletError } = await supabase.from("wallet_accounts").insert([
          {
            user_id: data[0].id, // Use the newly created user's ID
            wallet_address: userData.wallet,
            wallet_type: "ethereum", // Default type
            is_primary: true,
          },
        ])

        if (walletError) throw walletError
      }

      toast({
        title: "Profile created!",
        description: "Let's continue with some additional information.",
      })

      setStep(2)
    } catch (error) {
      console.error("Error saving user:", error)
      toast({
        title: "Error creating profile",
        description: "There was an error creating your profile. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleSubmitStep2 = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      // Update user in Supabase with demographic information
      const { error } = await supabase
        .from("users")
        .update({
          age: userData.age,
          gender_id: userData.genderId ? Number.parseInt(userData.genderId) : null,
          location_id: userData.locationId ? Number.parseInt(userData.locationId) : null,
          occupation_id: userData.occupationId ? Number.parseInt(userData.occupationId) : null,
        })
        .eq("email", userData.email) // Using email as a unique identifier for this example

      if (error) throw error

      // Insert user interests
      if (userData.interests.length > 0) {
        const userInterestsData = userData.interests.map((interestId) => ({
          user_id: 1, // In a real app, this would be the actual user ID
          interest_id: Number.parseInt(interestId),
        }))

        const { error: interestsError } = await supabase.from("user_interests").insert(userInterestsData)

        if (interestsError) throw interestsError
      }

      toast({
        title: "Demographics saved!",
        description: "Now let's find some projects that match your interests.",
      })

      setStep(3)
    } catch (error) {
      console.error("Error updating user demographics:", error)
      toast({
        title: "Error updating demographics",
        description: "There was an error updating your demographic information. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleSubmitStep3 = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      // Update user in Supabase with selected projects
      const { error } = await supabase.from("user_projects").insert(
        userData.selectedProjects.map((projectId) => ({
          user_email: userData.email, // Using email as a unique identifier
          project_id: projectId,
        })),
      )

      if (error) throw error

      toast({
        title: "Projects selected!",
        description: "Now let's see how you might contribute to the ecosystem.",
      })

      setStep(4)
    } catch (error) {
      console.error("Error saving selected projects:", error)
      toast({
        title: "Error saving projects",
        description: "There was an error saving your selected projects. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleSubmitStep4 = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      // Update user in Supabase with contribution information
      const { error } = await supabase
        .from("users")
        .update({
          will_contribute: userData.willContribute,
          contribution_details: userData.willContribute ? userData.contributionDetails : null,
        })
        .eq("email", userData.email) // Using email as a unique identifier for this example

      if (error) throw error

      // Insert user contribution skills
      if (userData.willContribute && userData.contributionSkills.length > 0) {
        const userSkillsData = userData.contributionSkills.map((skillId) => ({
          user_id: 1, // In a real app, this would be the actual user ID
          skill_id: Number.parseInt(skillId),
        }))

        const { error: skillsError } = await supabase.from("user_contribution_skills").insert(userSkillsData)

        if (skillsError) throw skillsError
      }

      toast({
        title: "Registration complete!",
        description: "Welcome to FundLoop. You're now eligible to receive citizen salary payments.",
      })

      // Close the modal after a short delay
      setTimeout(() => {
        onClose()
      }, 2000)
    } catch (error) {
      console.error("Error saving contribution information:", error)
      toast({
        title: "Error saving contribution information",
        description: "There was an error saving your contribution information. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  if (loadingReferenceData && step > 1) {
    return <div className="flex justify-center items-center p-8">Loading...</div>
  }

  return (
    <Tabs value={`step-${step}`} className="w-full">
      {/* Step indicators */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center w-full">
          <div
            className={`flex items-center justify-center w-8 h-8 rounded-full ${
              step >= 1 ? "bg-emerald-600 text-white" : "bg-slate-200 dark:bg-slate-700"
            }`}
          >
            {step > 1 ? <Check className="h-4 w-4" /> : 1}
          </div>
          <div className={`flex-1 h-1 mx-2 ${step >= 2 ? "bg-emerald-600" : "bg-slate-200 dark:bg-slate-700"}`}></div>
          <div
            className={`flex items-center justify-center w-8 h-8 rounded-full ${
              step >= 2 ? "bg-emerald-600 text-white" : "bg-slate-200 dark:bg-slate-700"
            }`}
          >
            {step > 2 ? <Check className="h-4 w-4" /> : 2}
          </div>
          <div className={`flex-1 h-1 mx-2 ${step >= 3 ? "bg-emerald-600" : "bg-slate-200 dark:bg-slate-700"}`}></div>
          <div
            className={`flex items-center justify-center w-8 h-8 rounded-full ${
              step >= 3 ? "bg-emerald-600 text-white" : "bg-slate-200 dark:bg-slate-700"
            }`}
          >
            {step > 3 ? <Check className="h-4 w-4" /> : 3}
          </div>
          <div className={`flex-1 h-1 mx-2 ${step >= 4 ? "bg-emerald-600" : "bg-slate-200 dark:bg-slate-700"}`}></div>
          <div
            className={`flex items-center justify-center w-8 h-8 rounded-full ${
              step >= 4 ? "bg-emerald-600 text-white" : "bg-slate-200 dark:bg-slate-700"
            }`}
          >
            4
          </div>
        </div>
      </div>

      {/* Step 1: Basic Information */}
      <TabsContent value="step-1" className="mt-0">
        <Card className="w-full">
          <CardHeader>
            <CardTitle className="text-2xl">Join as a User</CardTitle>
            <CardDescription>
              Create your profile to participate in the ecosystem and receive citizen salary
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form id="step1-form" onSubmit={handleSubmitStep1} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="user-name">Full Name</Label>
                <Input
                  id="user-name"
                  placeholder="Your name"
                  value={userData.name}
                  onChange={handleInputChange}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="user-email">Email</Label>
                <Input
                  id="user-email"
                  type="email"
                  placeholder="you@example.com"
                  value={userData.email}
                  onChange={handleInputChange}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="user-wallet">Wallet Address (optional)</Label>
                <Input id="user-wallet" placeholder="0x..." value={userData.wallet} onChange={handleInputChange} />
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  For receiving citizen salary payments. You can add this later.
                </p>
              </div>

              {/* Invitation Code Field - only show if not already provided in URL */}
              {!inviteCode && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="user-invitationCode">Invitation Code (optional)</Label>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info className="h-4 w-4 text-slate-400" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="w-[200px] text-xs">
                            Enter an invitation code if you received one from an existing member
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  <Input
                    id="user-invitationCode"
                    placeholder="Enter invitation code"
                    value={userData.invitationCode}
                    onChange={(e) => {
                      setUserData((prev) => ({ ...prev, invitationCode: e.target.value }))
                      setIsValidInviteCode(false) // Reset validation when code changes
                    }}
                  />
                  {userData.invitationCode && (
                    <div className="flex items-center gap-2 text-xs">
                      {checkingInviteCode ? (
                        <span className="text-slate-500">Checking code...</span>
                      ) : isValidInviteCode ? (
                        <span className="text-emerald-600 dark:text-emerald-400">Valid invitation code</span>
                      ) : (
                        <span className="text-red-600 dark:text-red-400">Invalid invitation code</span>
                      )}
                      {!isValidInviteCode && userData.invitationCode && !checkingInviteCode && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-6 px-2 text-xs"
                          onClick={() => validateInviteCode(userData.invitationCode)}
                        >
                          Verify
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* If invitation code was provided in URL, show it as read-only */}
              {inviteCode && (
                <div className="space-y-2">
                  <Label htmlFor="user-invitationCode">Invitation Code</Label>
                  <Input
                    id="user-invitationCode"
                    value={inviteCode}
                    readOnly
                    className="bg-slate-50 dark:bg-slate-800"
                  />
                  <p className="text-xs text-emerald-600 dark:text-emerald-400">You were invited to join FundLoop</p>
                </div>
              )}

              {/* Status Dropdown */}
              <div className="space-y-2">
                <Label htmlFor="user-status">Status</Label>
                <Select
                  value={userData.status}
                  onValueChange={(value) => setUserData((prev) => ({ ...prev, status: value }))}
                >
                  <SelectTrigger id="user-status">
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-start space-x-2 pt-4">
                <Checkbox id="terms" required />
                <div className="grid gap-1.5 leading-none">
                  <label
                    htmlFor="terms"
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    I agree to the terms and conditions
                  </label>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    I understand that my participation data may be anonymously shared with projects in the ecosystem.
                  </p>
                </div>
              </div>
            </form>
          </CardContent>
          <CardFooter>
            <Button
              form="step1-form"
              type="submit"
              className="w-full bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Creating Profile..." : "Continue"}
            </Button>
          </CardFooter>
        </Card>
      </TabsContent>

      {/* Rest of the steps remain the same */}
      {/* Step 2: Demographics */}
      <TabsContent value="step-2" className="mt-0">
        <Card className="w-full">
          <CardHeader>
            <CardTitle className="text-2xl">Demographic Information</CardTitle>
            <CardDescription>
              This information helps us match you with relevant projects and opportunities
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form id="step2-form" onSubmit={handleSubmitStep2} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="user-age">Age Group</Label>
                  <Select
                    value={userData.age}
                    onValueChange={(value) => setUserData((prev) => ({ ...prev, age: value }))}
                  >
                    <SelectTrigger id="user-age">
                      <SelectValue placeholder="Select age group" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="18-24">18-24</SelectItem>
                      <SelectItem value="25-34">25-34</SelectItem>
                      <SelectItem value="35-44">35-44</SelectItem>
                      <SelectItem value="45-54">45-54</SelectItem>
                      <SelectItem value="55-64">55-64</SelectItem>
                      <SelectItem value="65+">65+</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="user-gender">Gender</Label>
                  <Select
                    value={userData.genderId}
                    onValueChange={(value) => setUserData((prev) => ({ ...prev, genderId: value }))}
                  >
                    <SelectTrigger id="user-gender">
                      <SelectValue placeholder="Select gender" />
                    </SelectTrigger>
                    <SelectContent>
                      {genders.map((gender) => (
                        <SelectItem key={gender.value} value={gender.value}>
                          {gender.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="user-location">Location</Label>
                <Combobox
                  options={locations}
                  value={userData.locationId}
                  onChange={(value) => setUserData((prev) => ({ ...prev, locationId: value }))}
                  onCreateOption={createNewLocation}
                  placeholder="Select or enter your location"
                  emptyMessage="No locations found"
                  createMessage="Add location"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="user-occupation">Occupation</Label>
                <Combobox
                  options={occupations}
                  value={userData.occupationId}
                  onChange={(value) => setUserData((prev) => ({ ...prev, occupationId: value }))}
                  onCreateOption={createNewOccupation}
                  placeholder="Select or enter your occupation"
                  emptyMessage="No occupations found"
                  createMessage="Add occupation"
                />
              </div>

              <div className="space-y-2">
                <Label>Interests (select all that apply)</Label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-2">
                  {interests.map((interest) => (
                    <div key={interest.value} className="flex items-center space-x-2">
                      <Checkbox
                        id={`interest-${interest.value}`}
                        checked={userData.interests.includes(interest.value)}
                        onCheckedChange={() => handleInterestToggle(interest.value)}
                        className="mt-1"
                      />
                      <label
                        htmlFor={`interest-${interest.value}`}
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                      >
                        {interest.label}
                      </label>
                    </div>
                  ))}
                </div>
                <div className="mt-2">
                  <Combobox
                    options={[]}
                    value=""
                    onChange={() => {}}
                    onCreateOption={createNewInterest}
                    placeholder="Add a new interest"
                    emptyMessage="Type to add a new interest"
                    createMessage="Add interest"
                  />
                </div>
              </div>
            </form>
          </CardContent>
          <CardFooter className="flex justify-between">
            <Button type="button" variant="outline" onClick={() => setStep(1)} className="gap-1">
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
            <Button
              form="step2-form"
              type="submit"
              className="bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 gap-1"
              disabled={isSubmitting || !userData.age || !userData.locationId || userData.interests.length === 0}
            >
              {isSubmitting ? "Saving..." : "Continue"}
              <ArrowRight className="h-4 w-4" />
            </Button>
          </CardFooter>
        </Card>
      </TabsContent>

      {/* Step 3: Project Recommendations */}
      <TabsContent value="step-3" className="mt-0">
        <Card className="w-full">
          <CardHeader>
            <CardTitle className="text-2xl">Recommended Projects</CardTitle>
            <CardDescription>
              Based on your interests, we recommend these projects. Select at least one to get started.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form id="step3-form" onSubmit={handleSubmitStep3} className="space-y-4">
              <div className="grid gap-4">
                {recommendedProjects.map((project) => (
                  <div
                    key={project.id}
                    className={`p-4 rounded-lg border cursor-pointer transition-colors ${
                      userData.selectedProjects.includes(project.id)
                        ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20"
                        : "border-slate-200 dark:border-slate-700 hover:border-emerald-300 dark:hover:border-emerald-700"
                    }`}
                    onClick={() => handleProjectToggle(project.id)}
                  >
                    <div className="flex items-start gap-4">
                      <Checkbox
                        id={`project-${project.id}`}
                        checked={userData.selectedProjects.includes(project.id)}
                        onCheckedChange={() => handleProjectToggle(project.id)}
                        className="mt-1"
                      />
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={project.logo} alt={project.name} />
                            <AvatarFallback>{project.name.substring(0, 2)}</AvatarFallback>
                          </Avatar>
                          <div>
                            <label htmlFor={`project-${project.id}`} className="text-base font-medium cursor-pointer">
                              {project.name}
                            </label>
                            <p className="text-xs text-slate-500 dark:text-slate-400">{project.category}</p>
                          </div>
                        </div>
                        <p className="text-sm text-slate-600 dark:text-slate-300">{project.description}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </form>
          </CardContent>
          <CardFooter className="flex justify-between">
            <Button type="button" variant="outline" onClick={() => setStep(2)} className="gap-1">
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
            <Button
              form="step3-form"
              type="submit"
              className="bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 gap-1"
              disabled={isSubmitting || userData.selectedProjects.length === 0}
            >
              {isSubmitting ? "Saving..." : "Continue"}
              <ArrowRight className="h-4 w-4" />
            </Button>
          </CardFooter>
        </Card>
      </TabsContent>

      {/* Step 4: Skills Contribution */}
      <TabsContent value="step-4" className="mt-0">
        <Card className="w-full">
          <CardHeader>
            <CardTitle className="text-2xl">Skills Contribution</CardTitle>
            <CardDescription>
              Would you like to actively contribute your skills to the FundLoop ecosystem?
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form id="step4-form" onSubmit={handleSubmitStep4} className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-start space-x-2">
                  <RadioGroup
                    value={userData.willContribute ? "yes" : "no"}
                    onValueChange={(value) => setUserData((prev) => ({ ...prev, willContribute: value === "yes" }))}
                    className="flex flex-col space-y-3"
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="yes" id="contribution-yes" />
                      <Label htmlFor="contribution-yes">Yes, I'd like to actively contribute my skills</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="no" id="contribution-no" />
                      <Label htmlFor="contribution-no">No, I prefer to participate passively at this time</Label>
                    </div>
                  </RadioGroup>
                </div>

                {userData.willContribute && (
                  <>
                    <div className="space-y-2 pt-4">
                      <Label>How would you like to contribute? (select all that apply)</Label>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-2">
                        {contributionSkills.map((skill) => (
                          <div key={skill.id} className="flex items-start space-x-2">
                            <Checkbox
                              id={`skill-${skill.id}`}
                              checked={userData.contributionSkills.includes(skill.id)}
                              onCheckedChange={() => handleSkillToggle(skill.id)}
                              className="mt-1"
                            />
                            <div>
                              <label
                                htmlFor={`skill-${skill.id}`}
                                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                              >
                                {skill.label}
                              </label>
                              <p className="text-xs text-slate-500 dark:text-slate-400">{skill.description}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="user-contributionDetails">
                        Tell us more about your skills and how you'd like to contribute
                      </Label>
                      <Textarea
                        id="user-contributionDetails"
                        placeholder="Describe your skills, experience, and how you'd like to contribute to the ecosystem..."
                        className="min-h-[120px]"
                        value={userData.contributionDetails}
                        onChange={handleInputChange}
                        required={userData.willContribute}
                      />
                    </div>
                  </>
                )}
              </div>
            </form>
          </CardContent>
          <CardFooter className="flex justify-between">
            <Button type="button" variant="outline" onClick={() => setStep(3)} className="gap-1">
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
            <Button
              form="step4-form"
              type="submit"
              className="bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700"
              disabled={
                isSubmitting ||
                (userData.willContribute && (userData.contributionSkills.length === 0 || !userData.contributionDetails))
              }
            >
              {isSubmitting ? "Completing Registration..." : "Complete Registration"}
            </Button>
          </CardFooter>
        </Card>
      </TabsContent>
    </Tabs>
  )
}
