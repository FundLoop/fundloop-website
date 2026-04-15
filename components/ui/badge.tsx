import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-[var(--interactive-primary)] text-[var(--interactive-primary-foreground)] hover:brightness-105",
        secondary:
          "border-transparent bg-[var(--surface-inset)] text-[var(--text-strong)] hover:bg-[var(--interactive-secondary)]",
        destructive:
          "border-transparent bg-[var(--status-danger-soft)] text-[var(--status-danger)] hover:brightness-105",
        outline: "border-[color:var(--surface-border-strong)] text-[var(--text-base)]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }
