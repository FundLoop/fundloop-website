"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import { ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"

type ResourcesDropdownProps = {
  triggerClassName?: string
}

export default function ResourcesDropdown({ triggerClassName }: ResourcesDropdownProps) {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()

  const resources = [
    {
      href: "/pricing",
      label: "Pricing",
      description: "How FundLoop stays free for users and how projects are asked to support the ecosystem.",
    },
    {
      href: "/documentation",
      label: "Documentation",
      description: "Implementation guides, setup details, and reference material for the platform.",
    },
    {
      href: "/faq",
      label: "FAQ",
      description: "Straight answers to common questions from projects, users, and contributors.",
    },
    {
      href: "/support",
      label: "Support",
      description: "Get help when you are stuck or need a path through onboarding and platform flows.",
    },
    {
      href: "/api",
      label: "API",
      description: "Developer-facing endpoints and integration details for product and data workflows.",
    },
  ]

  const isActive = resources.some((resource) => pathname === resource.href)

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className={cn(
            "text-sm font-medium",
            isActive ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground hover:text-foreground",
            triggerClassName,
          )}
        >
          Resources
          <ChevronDown className="ml-1 h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[30rem] max-w-[calc(100vw-2rem)] p-2">
        <div className="grid gap-1 sm:grid-cols-2">
        {resources.map((resource) => (
          <DropdownMenuItem key={resource.href} asChild className="p-0">
            <Link
              href={resource.href}
              className={`flex min-h-24 flex-col items-start rounded-sm px-3 py-3 outline-none transition-colors hover:bg-accent ${
                pathname === resource.href ? "text-emerald-600 dark:text-emerald-400" : ""
              }`}
              onClick={() => setOpen(false)}
            >
              <span className="text-sm font-semibold">{resource.label}</span>
              <span className="mt-1 text-xs leading-5 text-muted-foreground">{resource.description}</span>
            </Link>
          </DropdownMenuItem>
        ))}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
