"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import { ChevronDown } from "lucide-react"

export default function ResourcesDropdown() {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()

  const resources = [
    { href: "/documentation", label: "Documentation" },
    { href: "/faq", label: "FAQ" },
    { href: "/support", label: "Support" },
    { href: "/api", label: "API" },
  ]

  const isActive = resources.some((resource) => pathname === resource.href)

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="link"
          className={`p-0 h-auto text-sm font-medium flex items-center gap-1 ${
            isActive ? "text-emerald-600 dark:text-emerald-400" : "text-foreground/60"
          }`}
        >
          Resources
          <ChevronDown className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        {resources.map((resource) => (
          <DropdownMenuItem key={resource.href} asChild>
            <Link
              href={resource.href}
              className={`w-full ${pathname === resource.href ? "text-emerald-600 dark:text-emerald-400" : ""}`}
              onClick={() => setOpen(false)}
            >
              {resource.label}
            </Link>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
