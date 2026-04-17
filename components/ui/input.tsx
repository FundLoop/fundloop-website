import * as React from "react"

import { cn } from "@/lib/utils"

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-10 w-full rounded-[calc(var(--radius-lg)-0.125rem)] border border-[color:var(--surface-border)] bg-[var(--surface-panel-strong)] px-3 py-2 text-base text-[var(--text-strong)] shadow-[var(--surface-shadow-soft)] ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-[var(--text-base)] placeholder:text-[var(--text-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }
