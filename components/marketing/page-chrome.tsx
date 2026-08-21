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
        "relative overflow-hidden bg-[var(--marketing-paper)] text-[var(--marketing-ink)]",
        className,
      )}
    >
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-x-0 top-0 h-[36rem] bg-[radial-gradient(circle_at_top_left,var(--marketing-glow-1),transparent_34%),radial-gradient(circle_at_75%_15%,var(--marketing-glow-2),transparent_28%),radial-gradient(circle_at_55%_55%,var(--marketing-glow-3),transparent_36%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(var(--surface-grid)_1px,transparent_1px),linear-gradient(90deg,var(--surface-grid)_1px,transparent_1px)] bg-[size:4rem_4rem] opacity-30 dark:opacity-15" />
        <div className="absolute inset-0 opacity-[0.05] [background-image:radial-gradient(circle_at_1px_1px,currentColor_1px,transparent_0)] [background-size:18px_18px]" />
      </div>
      <div className="relative">{children}</div>
    </div>
  )
}

export function MarketingSection({ children, className, containerClassName, id }: MarketingSectionProps) {
  return (
    <section id={id} className={cn("relative py-[var(--space-section)] sm:py-[var(--space-section-lg)]", className)}>
      <div className={cn("mx-auto w-full max-w-7xl px-[var(--page-gutter)]", containerClassName)}>{children}</div>
    </section>
  )
}

export function SectionEyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p
      className={cn(
        "text-[length:var(--type-eyebrow)] font-semibold uppercase tracking-[var(--tracking-eyebrow)] text-[var(--marketing-muted)]",
        className,
      )}
    >
      {children}
    </p>
  )
}

export function SectionTitle({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <h2
      className={cn(
        "font-display text-[length:var(--type-section-title)] leading-[0.94] tracking-[var(--tracking-display)] text-[var(--marketing-ink)]",
        className,
      )}
    >
      {children}
    </h2>
  )
}

export function SectionBody({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p
      className={cn(
        "max-w-2xl text-[length:var(--type-body-lg)] leading-7 text-[var(--marketing-muted-strong)]",
        className,
      )}
    >
      {children}
    </p>
  )
}
