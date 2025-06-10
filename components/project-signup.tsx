"use client"

import type React from "react"

import { useState } from "react"
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs"
import type { Database } from "@/types/supabase"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { toast } from "@/components/ui/use-toast"
import { UploadIcon as FileUpload, Upload } from "lucide-react"
import Link from "next/link"

export default function ProjectSignup() {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [name, setName] = useState("")
  const [slug, setSlug] = useState("")
  const [slugEdited, setSlugEdited] = useState(false)
  const [website, setWebsite] = useState("")
  const [description, setDescription] = useState("")
  const supabase = createClientComponentClient<Database>()
  const router = useRouter()

  const generateSlug = (value: string) =>
    value
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    const { data: existing } = await supabase
      .from("projects")
      .select("slug")
      .eq("slug", slug)
      .maybeSingle()

    if (existing) {
      toast({
        title: "Slug already in use",
        description: (
          <span>
            A project with this slug exists.{' '}
            <Link href={`/projects/${slug}`} className="underline">
              View project
            </Link>
            . Consider choosing a different slug.
          </span>
        ),
        variant: "destructive",
      })
      setIsSubmitting(false)
      return
    }

    const { data, error } = await supabase
      .from("projects")
      .insert({ name, slug, website, description })
      .select()
      .single()

    if (error || !data) {
      toast({ title: "Error", description: "Failed to create project", variant: "destructive" })
      setIsSubmitting(false)
      return
    }

    toast({ title: "Project registered successfully!" })
    router.push(`/projects/${data.slug}`)
  }

  return (
    <Card className="w-full" id="project-signup">
      <CardHeader>
        <CardTitle className="text-2xl">Join as a Project</CardTitle>
        <CardDescription>Sign the 1% pledge and connect your project to the FundLoop ecosystem</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="project-name">Project Name</Label>
            <Input
              id="project-name"
              placeholder="Your project or company name"
              value={name}
              onChange={(e) => {
                setName(e.target.value)
                if (!slugEdited) setSlug(generateSlug(e.target.value))
              }}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="project-slug">Slug</Label>
            <Input
              id="project-slug"
              value={slug}
              onChange={(e) => {
                setSlug(generateSlug(e.target.value))
                setSlugEdited(true)
              }}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="project-website">Website</Label>
            <Input
              id="project-website"
              type="url"
              placeholder="https://yourproject.com"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="project-description">Description</Label>
            <Textarea
              id="project-description"
              placeholder="Briefly describe what your project does"
              className="min-h-[100px]"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="project-email">Contact Email</Label>
            <Input id="project-email" type="email" placeholder="contact@yourproject.com" required />
          </div>

          <div className="space-y-2">
            <Label className="text-base">Project Logo</Label>
            <div className="border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-lg p-6 flex flex-col items-center justify-center gap-2">
              <FileUpload className="h-8 w-8 text-slate-400" />
              <p className="text-sm text-slate-500 dark:text-slate-400">Drag and drop or click to upload</p>
              <Button variant="outline" size="sm" type="button">
                <Upload className="h-4 w-4 mr-2" />
                Select File
              </Button>
            </div>
          </div>

          <div className="flex items-start space-x-2 pt-4">
            <Checkbox id="pledge" required />
            <div className="grid gap-1.5 leading-none">
              <label
                htmlFor="pledge"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                I pledge to contribute 1% of revenue
              </label>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Our project commits to anonymously sync our users and contribute 1% of our revenue to the FundLoop
                ecosystem to fund the citizen salary program.{" "}
                <Link href="/pledge" className="text-emerald-600 hover:underline dark:text-emerald-400">
                  Read the full pledge
                </Link>
              </p>
            </div>
          </div>
        </form>
      </CardContent>
      <CardFooter>
        <Button
          className="w-full bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-700 hover:to-cyan-700"
          onClick={handleSubmit}
          disabled={isSubmitting}
        >
          {isSubmitting ? "Registering..." : "Register Project"}
        </Button>
      </CardFooter>
    </Card>
  )
}
