"use client"

import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

type OnboardingShellProps = {
  title: string
  description: string
  eyebrow?: string
  preview?: ReactNode
  children: ReactNode
  footer?: ReactNode
  compact?: boolean
}

export function OnboardingShell({
  title,
  description,
  eyebrow,
  preview,
  children,
  footer,
  compact = false,
}: OnboardingShellProps) {
  return (
    <div className={cn("grid gap-6", preview ? "lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]" : "")}>
      {preview ? (
        <aside className="lg:sticky lg:top-0 lg:self-start">
          {preview}
        </aside>
      ) : null}

      <section
        className={cn(
          "rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm sm:p-8",
          compact ? "max-w-2xl" : "",
        )}
      >
        <div className="space-y-3">
          {eyebrow ? <p className="text-xs font-semibold uppercase tracking-[0.24em] text-emerald-600">{eyebrow}</p> : null}
          <div className="space-y-1">
            <h2 className="text-3xl font-semibold tracking-tight text-slate-950">{title}</h2>
            <p className="max-w-2xl text-sm leading-6 text-slate-600">{description}</p>
          </div>
        </div>

        <div className="mt-8 space-y-6">{children}</div>

        {footer ? <div className="mt-8 border-t border-slate-200 pt-6">{footer}</div> : null}
      </section>
    </div>
  )
}
