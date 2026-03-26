"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { ChevronDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { useCaseLinks } from "@/lib/use-cases"
import { cn } from "@/lib/utils"

type UseCasesDropdownProps = {
  triggerClassName?: string
}

export default function UseCasesDropdown({ triggerClassName }: UseCasesDropdownProps) {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()
  const isActive = pathname.startsWith("/use-cases")

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className={cn(
            "text-sm font-medium",
            isActive ? "text-emerald-600" : "text-muted-foreground hover:text-foreground",
            triggerClassName,
          )}
        >
          Use Cases
          <ChevronDown className="ml-1 h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-[36rem] max-w-[calc(100vw-2rem)] p-2">
        <div className="grid gap-1 sm:grid-cols-2">
          {useCaseLinks.map((useCase) => (
            <DropdownMenuItem key={useCase.slug} asChild className="p-0">
              <Link
                href={useCase.href}
                onClick={() => setOpen(false)}
                className="flex min-h-24 flex-col items-start rounded-sm px-3 py-3 outline-none transition-colors hover:bg-accent"
              >
                <span className="text-sm font-semibold">{useCase.label}</span>
                <span className="mt-1 text-xs leading-5 text-muted-foreground">{useCase.description}</span>
              </Link>
            </DropdownMenuItem>
          ))}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
