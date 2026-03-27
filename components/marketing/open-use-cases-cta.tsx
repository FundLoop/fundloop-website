"use client"

import type { ReactNode } from "react"
import { OPEN_USE_CASES_MENU_EVENT } from "@/lib/use-cases-nav"

type OpenUseCasesCtaProps = {
  children: ReactNode
  className?: string
}

export function OpenUseCasesCta({ children, className }: OpenUseCasesCtaProps) {
  return (
    <button
      type="button"
      className={className}
      onClick={() => window.dispatchEvent(new CustomEvent(OPEN_USE_CASES_MENU_EVENT))}
    >
      {children}
    </button>
  )
}
