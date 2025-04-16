"use client"

import type React from "react"

import { useState } from "react"
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    // Simulate API call
    setTimeout(() => {
      setIsSubmitting(false)
      toast({
        title: "Project registered successfully!",
        description: "Welcome to the FundLoop ecosystem. You'll receive onboarding information shortly.",
      })
    }, 1500)
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
            <Input id="project-name" placeholder="Your project or company name" required />
          </div>

          <div className="space-y-2">
            <Label htmlFor="project-website">Website</Label>
            <Input id="project-website" type="url" placeholder="https://yourproject.com" required />
          </div>

          <div className="space-y-2">
            <Label htmlFor="project-description">Description</Label>
            <Textarea
              id="project-description"
              placeholder="Briefly describe what your project does"
              className="min-h-[100px]"
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
