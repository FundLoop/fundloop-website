"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"
import { ChevronDown } from "lucide-react"
import { Link, usePathname } from "@/i18n/navigation"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { resourceLinks } from "@/lib/public-site"

type ResourcesDropdownProps = {
  triggerClassName?: string
}

export default function ResourcesDropdown({ triggerClassName }: ResourcesDropdownProps) {
  const t = useTranslations("shell")
  const [open, setOpen] = useState(false)
  const pathname = usePathname()
  const translatedResourceLinks = resourceLinks.map((resource) => ({
    ...resource,
    label: t(`nav.resourceLinks.${resource.id}.label`),
    description: t(`nav.resourceLinks.${resource.id}.description`),
  }))

  const isActive = resourceLinks.some((resource) => pathname === resource.href)

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className={cn(
            "text-sm font-medium",
            isActive
              ? "text-[var(--marketing-accent)]"
              : "text-[var(--marketing-muted-strong)] hover:text-[var(--marketing-ink)]",
            triggerClassName,
          )}
        >
          {t("nav.resources")}
          <ChevronDown className="ml-1 h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-[30rem] max-w-[calc(100vw-2rem)] rounded-[1.5rem] border-[color:var(--marketing-line)] bg-[rgba(255,248,238,0.94)] p-3 shadow-[0_30px_90px_rgba(15,23,23,0.14)] backdrop-blur-xl dark:bg-[rgba(13,21,21,0.95)]"
      >
        <div className="grid gap-1 sm:grid-cols-2">
          {translatedResourceLinks.map((resource) => (
            <DropdownMenuItem key={resource.href} asChild className="p-0">
              <Link
                href={resource.href}
                className={`flex min-h-24 flex-col items-start rounded-2xl px-4 py-4 outline-none transition-transform duration-200 hover:-translate-y-0.5 hover:bg-black/[0.03] ${
                  pathname === resource.href ? "text-[var(--marketing-accent)]" : ""
                }`}
                onClick={() => setOpen(false)}
              >
                <span className="text-sm font-semibold uppercase tracking-[0.18em]">{resource.label}</span>
                <span className="mt-2 text-xs leading-5 text-[var(--marketing-muted-strong)]">{resource.description}</span>
              </Link>
            </DropdownMenuItem>
          ))}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
