import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

type MarketingPageProps = {
  children: ReactNode
  className?: string
}

type MarketingSectionProps = {
  children: ReactNode
  className?: string
  containerClassName?: string
  id?: string
}

export function MarketingPage({ children, className }: MarketingPageProps) {
  return (
    <div
      className={cn(
        "relative overflow-hidden bg-[var(--marketing-paper)] text-[var(--marketing-ink)] dark:bg-[var(--marketing-ink)] dark:text-[var(--marketing-paper)]",
        className,
      )}
    >
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-x-0 top-0 h-[36rem] bg-[radial-gradient(circle_at_top_left,rgba(255,214,144,0.42),transparent_34%),radial-gradient(circle_at_75%_15%,rgba(204,92,44,0.28),transparent_28%),radial-gradient(circle_at_55%_55%,rgba(99,112,86,0.14),transparent_36%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(22,33,33,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(22,33,33,0.05)_1px,transparent_1px)] bg-[size:4rem_4rem] opacity-30 dark:opacity-15" />
        <div className="absolute inset-0 opacity-[0.05] [background-image:radial-gradient(circle_at_1px_1px,currentColor_1px,transparent_0)] [background-size:18px_18px]" />
      </div>
      <div className="relative">{children}</div>
    </div>
  )
}

export function MarketingSection({ children, className, containerClassName, id }: MarketingSectionProps) {
  return (
    <section id={id} className={cn("relative py-16 sm:py-20", className)}>
      <div className={cn("mx-auto w-full max-w-7xl px-6 sm:px-8 lg:px-12", containerClassName)}>{children}</div>
    </section>
  )
}

export function SectionEyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p className={cn("text-[0.72rem] font-semibold uppercase tracking-[0.32em] text-[var(--marketing-muted)]", className)}>
      {children}
    </p>
  )
}

export function SectionTitle({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <h2 className={cn("font-display text-4xl leading-none tracking-[-0.03em] sm:text-5xl lg:text-6xl", className)}>
      {children}
    </h2>
  )
}

export function SectionBody({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p className={cn("max-w-2xl text-base leading-7 text-[var(--marketing-muted-strong)] sm:text-lg", className)}>
      {children}
    </p>
  )
}
