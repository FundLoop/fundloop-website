"use client"

import { usePathname, useRouter } from "next/navigation"
import { ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

function buildUrl(pathname: string, searchParams: URLSearchParams) {
  const query = searchParams.toString()
  return query ? `${pathname}?${query}` : pathname
}

export default function ProjectSignup() {
  const pathname = usePathname()
  const router = useRouter()

  const openFlow = () => {
    const nextParams = new URLSearchParams(window.location.search)
    nextParams.set("onboarding", "project")
    router.push(buildUrl(pathname, nextParams), { scroll: false })
  }

  return (
    <Card id="project-signup" className="border-emerald-200/80">
      <CardHeader>
        <CardTitle className="text-2xl">Join as a Project</CardTitle>
        <CardDescription>
          Start with your personal profile, then continue into a saved project draft when you are ready.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button className="w-full gap-2" onClick={openFlow}>
          Start project onboarding
          <ArrowRight className="h-4 w-4" />
        </Button>
      </CardContent>
    </Card>
  )
}
