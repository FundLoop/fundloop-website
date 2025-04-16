import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ArrowLeft, FileText, Code, BookOpen, Lightbulb, Puzzle } from "lucide-react"

export default function DocumentationPage() {
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

      <div className="max-w-5xl mx-auto">
        <h1 className="text-3xl md:text-4xl font-bold mb-4">Documentation</h1>
        <p className="text-slate-600 dark:text-slate-300 text-lg mb-8">
          Comprehensive guides and resources to help you understand and participate in the FundLoop ecosystem.
        </p>

        <Tabs defaultValue="getting-started" className="w-full mb-12">
          <TabsList className="grid w-full grid-cols-2 md:grid-cols-4 mb-8">
            <TabsTrigger value="getting-started">Getting Started</TabsTrigger>
            <TabsTrigger value="projects">For Projects</TabsTrigger>
            <TabsTrigger value="users">For Users</TabsTrigger>
            <TabsTrigger value="api">API Reference</TabsTrigger>
          </TabsList>

          <TabsContent value="getting-started">
            <div className="grid gap-6">
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2 mb-2">
                    <BookOpen className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                    <CardTitle>Introduction to FundLoop</CardTitle>
                  </div>
                  <CardDescription>Learn about the core concepts and vision behind FundLoop</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-slate-600 dark:text-slate-300 mb-4">
                    FundLoop is a revolutionary network state that creates a sustainable economic ecosystem through
                    mutual aid and shared prosperity. This guide will help you understand the core principles and how
                    the ecosystem functions.
                  </p>
                  <Button variant="outline" size="sm" className="gap-1">
                    <FileText className="h-4 w-4" />
                    Read the Guide
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2 mb-2">
                    <Lightbulb className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                    <CardTitle>How FundLoop Works</CardTitle>
                  </div>
                  <CardDescription>Understand the mechanics of the 1% pledge and citizen salary</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-slate-600 dark:text-slate-300 mb-4">
                    Learn how projects contribute 1% of their revenue to fund the citizen salary program, and how users
                    can participate and benefit from the ecosystem.
                  </p>
                  <Button variant="outline" size="sm" className="gap-1">
                    <FileText className="h-4 w-4" />
                    Read the Guide
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2 mb-2">
                    <Puzzle className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                    <CardTitle>Getting Started</CardTitle>
                  </div>
                  <CardDescription>Step-by-step guide to joining the FundLoop ecosystem</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-slate-600 dark:text-slate-300 mb-4">
                    Follow this guide to create your account, set up your profile, and start participating in the
                    FundLoop ecosystem as either a project or a user.
                  </p>
                  <Button variant="outline" size="sm" className="gap-1">
                    <FileText className="h-4 w-4" />
                    Read the Guide
                  </Button>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="projects">
            <div className="grid gap-6">
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2 mb-2">
                    <BookOpen className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                    <CardTitle>Project Onboarding</CardTitle>
                  </div>
                  <CardDescription>Guide for projects joining the FundLoop ecosystem</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-slate-600 dark:text-slate-300 mb-4">
                    Learn how to register your project, set up your profile, and integrate with the FundLoop ecosystem
                    to start contributing and benefiting.
                  </p>
                  <Button variant="outline" size="sm" className="gap-1">
                    <FileText className="h-4 w-4" />
                    Read the Guide
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2 mb-2">
                    <Code className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                    <CardTitle>Integration Guide</CardTitle>
                  </div>
                  <CardDescription>Technical documentation for integrating with FundLoop</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-slate-600 dark:text-slate-300 mb-4">
                    Technical guide for developers to integrate their projects with FundLoop's API for user syncing,
                    contribution tracking, and more.
                  </p>
                  <Button variant="outline" size="sm" className="gap-1">
                    <FileText className="h-4 w-4" />
                    Read the Guide
                  </Button>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="users">
            <div className="grid gap-6">
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2 mb-2">
                    <BookOpen className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                    <CardTitle>User Guide</CardTitle>
                  </div>
                  <CardDescription>Complete guide for users in the FundLoop ecosystem</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-slate-600 dark:text-slate-300 mb-4">
                    Learn how to create your profile, connect with projects, and start receiving citizen salary payments
                    as an active member of the ecosystem.
                  </p>
                  <Button variant="outline" size="sm" className="gap-1">
                    <FileText className="h-4 w-4" />
                    Read the Guide
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2 mb-2">
                    <Lightbulb className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                    <CardTitle>Contribution Guide</CardTitle>
                  </div>
                  <CardDescription>How to actively contribute to the FundLoop ecosystem</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-slate-600 dark:text-slate-300 mb-4">
                    Discover ways to contribute your skills and expertise to help grow the FundLoop ecosystem and
                    maximize your benefits.
                  </p>
                  <Button variant="outline" size="sm" className="gap-1">
                    <FileText className="h-4 w-4" />
                    Read the Guide
                  </Button>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="api">
            <div className="grid gap-6">
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2 mb-2">
                    <Code className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                    <CardTitle>API Reference</CardTitle>
                  </div>
                  <CardDescription>Complete reference for the FundLoop API</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-slate-600 dark:text-slate-300 mb-4">
                    Comprehensive documentation of all API endpoints, request parameters, and response formats for
                    integrating with the FundLoop ecosystem.
                  </p>
                  <Button variant="outline" size="sm" className="gap-1">
                    <FileText className="h-4 w-4" />
                    View API Reference
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2 mb-2">
                    <Code className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                    <CardTitle>SDK Documentation</CardTitle>
                  </div>
                  <CardDescription>Documentation for the FundLoop SDK</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-slate-600 dark:text-slate-300 mb-4">
                    Learn how to use the FundLoop SDK to easily integrate your project with the ecosystem using our
                    client libraries for various programming languages.
                  </p>
                  <Button variant="outline" size="sm" className="gap-1">
                    <FileText className="h-4 w-4" />
                    View SDK Docs
                  </Button>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
