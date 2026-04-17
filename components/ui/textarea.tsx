import * as React from "react"

import { cn } from "@/lib/utils"

const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.ComponentProps<"textarea">
>(({ className, ...props }, ref) => {
  return (
    <textarea
      className={cn(
        "flex min-h-[80px] w-full rounded-[calc(var(--radius-lg)-0.125rem)] border border-[color:var(--surface-border)] bg-[var(--surface-panel-strong)] px-3 py-2 text-base text-[var(--text-strong)] shadow-[var(--surface-shadow-soft)] ring-offset-background placeholder:text-[var(--text-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        className
      )}
      ref={ref}
      {...props}
    />
  )
})
Textarea.displayName = "Textarea"

export { Textarea }
