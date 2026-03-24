"use client"

import { usePathname, useRouter } from "next/navigation"
import { ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { buildUrl } from "@/lib/url"

export default function UserSignup() {
  const pathname = usePathname()
  const router = useRouter()

  const openFlow = () => {
    const nextParams = new URLSearchParams(window.location.search)
    nextParams.set("onboarding", "user")
    router.push(buildUrl(pathname, nextParams), { scroll: false })
  }

  return (
    <Card id="user-signup" className="border-cyan-200/80">
      <CardHeader>
        <CardTitle className="text-2xl">Join as a User</CardTitle>
        <CardDescription>
          Build your profile with a live preview, set your visibility preferences, and resume any draft later.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button className="w-full gap-2" variant="secondary" onClick={openFlow}>
          Start personal onboarding
          <ArrowRight className="h-4 w-4" />
        </Button>
      </CardContent>
    </Card>
  )
}
