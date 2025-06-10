"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { toast } from "@/components/ui/use-toast"
import { UploadIcon as FileUpload, Upload, ArrowLeft, ArrowRight, Check, X } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { Tabs, TabsContent } from "@/components/ui/tabs"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Combobox, type ComboboxOption } from "@/components/ui/combobox"
import ProjectSignupStep1 from "@/components/project-signup-step1"

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

export default function ProjectSignupFlow({
  onClose,
  initialStep = 1,
  initialProject,
}: {
  onClose: () => void
  initialStep?: number
  initialProject?: {
    id: number
    slug: string
    name: string
    website: string
    description: string
  }
}) {
  const [step, setStep] = useState(initialStep)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [projectData, setProjectData] = useState({
    name: initialProject?.name || "",
    website: initialProject?.website || "",
    description: initialProject?.description || "",
    email: "",
    logo: null as File | null,
    userName: "", // Add this line
    detailedDescription: "",
    categories: [] as string[],
    paymentMethodId: "",
    billingEmail: "",
    billingFrequency: "monthly",
    payment_percentage: 1.0,
    payment_periodicityId: "",
    payment_custom_days: null as number | null,
    status: "active", // Add status field
  })

  // User data for skills contribution
  const [userData, setUserData] = useState({
    willContribute: false,
    contributionSkills: [] as string[],
    contributionDetails: "",
  })

  // Reference data
  const [categories, setCategories] = useState<ComboboxOption[]>([])
  const [paymentMethods, setPaymentMethods] = useState<ComboboxOption[]>([])
  const [paymentPeriodicities, setPaymentPeriodicities] = useState<ComboboxOption[]>([])
  const [loadingReferenceData, setLoadingReferenceData] = useState(true)

  useEffect(() => {
    fetchReferenceData()
  }, [])

  const fetchReferenceData = async () => {
    try {
      setLoadingReferenceData(true)

      // In a real app, you would fetch from Supabase
      // For demo purposes, we'll use mock data

      // Fetch categories
      const { data: categoriesData, error: categoriesError } = await supabase
        .from("ref_categories")
        .select("id, name")
        .order("name")

      if (categoriesError) throw categoriesError

      // Fetch payment methods
      const { data: paymentMethodsData, error: paymentMethodsError } = await supabase
        .from("ref_payment_methods")
        .select("id, name, code, description")
        .order("display_order")

      if (paymentMethodsError) throw paymentMethodsError

      // Fetch payment periodicities
      const { data: paymentPeriodicitiesData, error: paymentPeriodicitiesError } = await supabase
        .from("ref_payment_periodicities")
        .select("id, name, code")
        .order("display_order")

      if (paymentPeriodicitiesError) throw paymentPeriodicitiesError

      // Transform data for comboboxes and selects
      setCategories(categoriesData?.map((item) => ({ value: item.id.toString(), label: item.name })) || [])
      setPaymentMethods(
        paymentMethodsData?.map((item) => ({
          value: item.id.toString(),
          label: item.name,
          code: item.code,
          description: item.description,
        })) || [],
      )
      setPaymentPeriodicities(
        paymentPeriodicitiesData?.map((item) => ({
          value: item.id.toString(),
          label: item.name,
          code: item.code,
        })) || [],
      )

      // Set default payment periodicity to monthly
      const monthlyPeriodicity = paymentPeriodicitiesData?.find((item) => item.code === "month")
      if (monthlyPeriodicity) {
        setProjectData((prev) => ({ ...prev, payment_periodicityId: monthlyPeriodicity.id.toString() }))
      }

      // Set default payment method to bank transfer
      const bankTransferMethod = paymentMethodsData?.find((item) => item.code === "bank_transfer")
      if (bankTransferMethod) {
        setProjectData((prev) => ({ ...prev, paymentMethodId: bankTransferMethod.id.toString() }))
      }
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
    setProjectData((prev) => ({ ...prev, [id.replace("project-", "")]: value }))
  }

  const handleCategoryToggle = (categoryId: string) => {
    setProjectData((prev) => {
      const categories = [...prev.categories]
      if (categories.includes(categoryId)) {
        return { ...prev, categories: categories.filter((c) => c !== categoryId) }
      } else {
        return { ...prev, categories: [...categories, categoryId] }
      }
    })
  }

  const createNewCategory = async (categoryName: string) => {
    try {
      // Format category name properly
      const formattedName = categoryName
        .split(" ")
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(" ")

      // In a real app, you would insert into Supabase
      const { data, error } = await supabase
        .from("ref_categories")
        .insert([{ name: formattedName }])
        .select()

      if (error) throw error

      if (data && data[0]) {
        // Add the new category to the options
        const newCategory = { value: data[0].id.toString(), label: data[0].name }
        setCategories((prev) => [...prev, newCategory])

        // Add to selected categories
        handleCategoryToggle(data[0].id.toString())
      }
    } catch (error) {
      console.error("Error creating category:", error)
      throw error
    }
  }


  const handleSubmitStep2 = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      // Update project in Supabase with detailed description and categories
      const { error } = await supabase
        .from("projects")
        .update({
          detailed_description: projectData.detailedDescription,
        })
        .eq("name", projectData.name) // Using name as a unique identifier for this example

      if (error) throw error

      // Insert project categories
      if (projectData.categories.length > 0) {
        const projectCategoriesData = projectData.categories.map((categoryId) => ({
          project_id: 1, // In a real app, this would be the actual project ID
          category_id: Number.parseInt(categoryId),
        }))

        const { error: categoriesError } = await supabase.from("project_categories").insert(projectCategoriesData)

        if (categoriesError) throw categoriesError
      }

      toast({
        title: "Project details updated!",
        description: "Now let's set up your contribution method.",
      })

      setStep(3)
    } catch (error) {
      console.error("Error updating project details:", error)
      toast({
        title: "Error updating project details",
        description: "There was an error updating your project details. Please try again.",
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
      // Update project in Supabase with payment method details
      const { error } = await supabase
        .from("projects")
        .update({
          default_payment_method_id: projectData.paymentMethodId ? Number.parseInt(projectData.paymentMethodId) : null,
          billing_email: projectData.billingEmail,
          billing_frequency: projectData.billingFrequency,
          payment_percentage: projectData.payment_percentage,
          payment_periodicity_id: projectData.payment_periodicityId
            ? Number.parseInt(projectData.payment_periodicityId)
            : null,
          payment_custom_days: projectData.payment_custom_days,
        })
        .eq("name", projectData.name) // Using name as a unique identifier for this example

      if (error) throw error

      toast({
        title: "Project registration complete!",
        description: "Welcome to the FundLoop ecosystem. You'll receive onboarding information shortly.",
      })

      // Close the modal after a short delay
      setTimeout(() => {
        onClose()
      }, 2000)
    } catch (error) {
      console.error("Error updating payment details:", error)
      toast({
        title: "Error updating payment details",
        description: "There was an error updating your payment details. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      // In a real implementation, you would:
      // 1. Create a user record
      // 2. Create an organization record
      // 3. Create a project record
      // 4. Send OTP verification

      // For now, we'll just simulate success
      setTimeout(() => {
        setIsSubmitting(false)
        toast({
          title: "Project registered successfully!",
          description: "Welcome to the FundLoop ecosystem. You'll receive onboarding information shortly.",
        })
        onClose()
      }, 1500)
    } catch (error) {
      console.error("Error registering project:", error)
      setIsSubmitting(false)
      toast({
        title: "Error",
        description: "There was an error registering your project. Please try again.",
        variant: "destructive",
      })
    }
  }

  const handleSkillToggle = (skillId: string) => {
    setUserData((prev) => {
      const skills = [...prev.contributionSkills]
      if (skills.includes(skillId)) {
        return { ...prev, contributionSkills: skills.filter((s) => s !== skillId) }
      } else {
        return { ...prev, contributionSkills: [...skills, skillId] }
      }
    })
  }

  const handleSubmitStep4 = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      // In a real implementation, you would:
      // 1. Save user contribution preferences
      // 2. Update user record with skills and details

      // For now, we'll just simulate success
      setTimeout(() => {
        setIsSubmitting(false)
        toast({
          title: "Skills contribution preferences saved!",
          description: "Thank you for your interest in contributing to the FundLoop ecosystem.",
        })
        onClose()
      }, 1500)
    } catch (error) {
      console.error("Error saving skills contribution preferences:", error)
      setIsSubmitting(false)
      toast({
        title: "Error",
        description: "There was an error saving your skills contribution preferences. Please try again.",
        variant: "destructive",
      })
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
        </div>
      </div>

      {/* Step 1: Basic Information */}
      <TabsContent value="step-1" className="mt-0">
        <ProjectSignupStep1
          onSuccess={(project) => {
            setProjectData((prev) => ({
              ...prev,
              name: project.name,
              website: project.website,
              description: project.description,
            }))
            setStep(2)
          }}
        />
      </TabsContent>

      {/* Rest of the steps remain the same */}
      {/* Step 2: Detailed Description and Categories */}
      <TabsContent value="step-2" className="mt-0">
        <Card className="w-full">
          <CardHeader>
            <CardTitle className="text-2xl">Project Details</CardTitle>
            <CardDescription>Tell us more about your project and select relevant categories</CardDescription>
          </CardHeader>
          <CardContent>
            <form id="step2-form" onSubmit={handleSubmitStep2} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="project-detailedDescription">Detailed Description</Label>
                <Textarea
                  id="project-detailedDescription"
                  placeholder="Provide a comprehensive description of your project, its mission, and how it aligns with FundLoop's values"
                  className="min-h-[150px]"
                  value={projectData.detailedDescription}
                  onChange={handleInputChange}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label>Project Categories (select all that apply)</Label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-2">
                  {categories.map((category) => (
                    <div key={category.value} className="flex items-center space-x-2">
                      <Checkbox
                        id={`category-${category.value}`}
                        checked={projectData.categories.includes(category.value)}
                        onCheckedChange={() => handleCategoryToggle(category.value)}
                      />
                      <label
                        htmlFor={`category-${category.value}`}
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                      >
                        {category.label}
                      </label>
                    </div>
                  ))}
                </div>
                <div className="mt-2">
                  <Combobox
                    options={[]}
                    value=""
                    onChange={() => {}}
                    onCreateOption={createNewCategory}
                    placeholder="Add a new category"
                    emptyMessage="Type to add a new category"
                    createMessage="Add category"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Selected Categories</Label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {projectData.categories.length === 0 ? (
                    <p className="text-sm text-slate-500 dark:text-slate-400">No categories selected</p>
                  ) : (
                    projectData.categories.map((categoryId) => {
                      const category = categories.find((c) => c.value === categoryId)
                      return category ? (
                        <Badge key={categoryId} variant="outline" className="flex items-center gap-1">
                          {category.label}
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-4 w-4 p-0 hover:bg-transparent"
                            onClick={() => handleCategoryToggle(categoryId)}
                          >
                            <X className="h-3 w-3" />
                            <span className="sr-only">Remove {category.label}</span>
                          </Button>
                        </Badge>
                      ) : null
                    })
                  )}
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
              className="bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-700 hover:to-cyan-700 gap-1"
              disabled={isSubmitting || projectData.categories.length === 0}
            >
              {isSubmitting ? "Saving..." : "Continue"}
              <ArrowRight className="h-4 w-4" />
            </Button>
          </CardFooter>
        </Card>
      </TabsContent>

      {/* Step 3: Payment Method */}
      <TabsContent value="step-3" className="mt-0">
        <Card className="w-full">
          <CardHeader>
            <CardTitle className="text-2xl">Contribution Method</CardTitle>
            <CardDescription>Select how you'll contribute 1% of your revenue to the FundLoop ecosystem</CardDescription>
          </CardHeader>
          <CardContent>
            <form id="step3-form" onSubmit={handleSubmitStep3} className="space-y-6">
              <div className="space-y-4">
                <Label>Payment Method</Label>
                <RadioGroup
                  value={projectData.paymentMethodId}
                  onValueChange={(value) => setProjectData((prev) => ({ ...prev, paymentMethodId: value }))}
                  className="space-y-3"
                >
                  {paymentMethods.map((method) => (
                    <div key={method.value} className="flex items-center space-x-2">
                      <RadioGroupItem value={method.value} id={method.value} />
                      <Label htmlFor={method.value} className="flex flex-col">
                        <span>{method.label}</span>
                        <span className="text-sm font-normal text-slate-500 dark:text-slate-400">
                          {method.description}
                        </span>
                      </Label>
                    </div>
                  ))}
                </RadioGroup>
              </div>

              <div className="space-y-2">
                <Label htmlFor="payment-percentage">Revenue Share Percentage</Label>
                <div className="relative">
                  <Input
                    id="payment-percentage"
                    type="number"
                    min="1"
                    step="0.1"
                    placeholder="1.0"
                    value={projectData.payment_percentage || 1}
                    onChange={(e) => {
                      const value = Number.parseFloat(e.target.value)
                      if (value < 1) {
                        toast({
                          title: "Invalid percentage",
                          description: "The minimum revenue share percentage is 1%",
                          variant: "destructive",
                        })
                        setProjectData((prev) => ({ ...prev, payment_percentage: 1 }))
                      } else {
                        setProjectData((prev) => ({ ...prev, payment_percentage: value }))
                      }
                    }}
                    className="pr-8"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500">%</span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  The minimum contribution is 1% of your revenue. You can choose to contribute more if you wish.
                </p>
              </div>

              <div className="space-y-2">
                <Label>Payment Periodicity</Label>
                <Select
                  value={projectData.payment_periodicityId}
                  onValueChange={(value) => {
                    setProjectData((prev) => ({
                      ...prev,
                      payment_periodicityId: value,
                      // Reset custom days if not custom periodicity
                      payment_custom_days:
                        value === paymentPeriodicities.find((p) => p.code === "custom")?.value
                          ? prev.payment_custom_days
                          : null,
                    }))
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select payment periodicity" />
                  </SelectTrigger>
                  <SelectContent>
                    {paymentPeriodicities.map((periodicity) => (
                      <SelectItem key={periodicity.value} value={periodicity.value}>
                        {periodicity.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {projectData.payment_periodicityId === paymentPeriodicities.find((p) => p.code === "custom")?.value && (
                <div className="space-y-2">
                  <Label htmlFor="custom-days">Custom Period (Days)</Label>
                  <Input
                    id="custom-days"
                    type="number"
                    min="1"
                    max="365"
                    placeholder="30"
                    value={projectData.payment_custom_days || ""}
                    onChange={(e) =>
                      setProjectData((prev) => ({ ...prev, payment_custom_days: Number.parseInt(e.target.value) }))
                    }
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="project-billingEmail">Billing Email</Label>
                <Input
                  id="project-billingEmail"
                  type="email"
                  placeholder="billing@yourproject.com"
                  value={projectData.billingEmail}
                  onChange={handleInputChange}
                  required
                />
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  We'll send invoices and payment receipts to this email address
                </p>
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
              className="bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-700 hover:to-cyan-700"
              disabled={isSubmitting || !projectData.paymentMethodId}
            >
              {isSubmitting ? "Completing Registration..." : "Continue"}
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
                        onChange={(e) => setUserData((prev) => ({ ...prev, contributionDetails: e.target.value }))}
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
