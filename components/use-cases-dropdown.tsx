"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"
import { ChevronDown } from "lucide-react"
import { Link, usePathname } from "@/i18n/navigation"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { useCaseLinks } from "@/lib/use-cases"
import { cn } from "@/lib/utils"

type UseCasesDropdownProps = {
  triggerClassName?: string
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

export default function UseCasesDropdown({ triggerClassName, open: controlledOpen, onOpenChange }: UseCasesDropdownProps) {
  const t = useTranslations("shell")
  const [internalOpen, setInternalOpen] = useState(false)
  const pathname = usePathname()
  const isActive = pathname.startsWith("/use-cases")
  const open = controlledOpen ?? internalOpen

  const handleOpenChange = (nextOpen: boolean) => {
    onOpenChange?.(nextOpen)

    if (controlledOpen === undefined) {
      setInternalOpen(nextOpen)
    }
  }

  return (
    <DropdownMenu open={open} onOpenChange={handleOpenChange}>
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
          {t("nav.useCases")}
          <ChevronDown className="ml-1 h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        className="w-[36rem] max-w-[calc(100vw-2rem)] rounded-[1.5rem] border-[color:var(--marketing-line)] bg-[rgba(255,248,238,0.94)] p-3 shadow-[0_30px_90px_rgba(15,23,23,0.14)] backdrop-blur-xl dark:bg-[rgba(13,21,21,0.95)]"
      >
        <div className="grid gap-1 sm:grid-cols-2">
          {useCaseLinks.map((useCase) => (
            <DropdownMenuItem key={useCase.slug} asChild className="p-0">
              <Link
                href={useCase.href}
                onClick={() => handleOpenChange(false)}
                className="flex min-h-24 flex-col items-start rounded-2xl px-4 py-4 outline-none transition-transform duration-200 hover:-translate-y-0.5 hover:bg-black/[0.03]"
              >
                <span className="text-sm font-semibold uppercase tracking-[0.18em]">{useCase.label}</span>
                <span className="mt-2 text-xs leading-5 text-[var(--marketing-muted-strong)]">{useCase.description}</span>
              </Link>
            </DropdownMenuItem>
          ))}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
