import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[calc(var(--radius-lg)+0.125rem)] text-sm font-medium ring-offset-background transition-[background-color,border-color,color,box-shadow,transform] duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-[var(--interactive-primary)] text-[var(--interactive-primary-foreground)] shadow-[var(--surface-shadow-soft)] hover:bg-[var(--interactive-primary-hover)]",
        destructive:
          "bg-[var(--status-danger)] text-white shadow-[var(--surface-shadow-soft)] hover:brightness-105",
        outline:
          "border border-[color:var(--surface-border-strong)] bg-[var(--surface-panel-strong)] text-[var(--text-strong)] shadow-[var(--surface-shadow-soft)] hover:bg-[var(--interactive-secondary)] hover:text-[var(--text-strong)]",
        secondary: "bg-[var(--interactive-secondary)] text-[var(--text-strong)] hover:bg-[var(--interactive-secondary-hover)]",
        ghost: "text-[var(--text-base)] hover:bg-[var(--interactive-ghost-hover)] hover:text-[var(--text-strong)]",
        link: "text-[var(--interactive-primary)] underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-md px-8",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
