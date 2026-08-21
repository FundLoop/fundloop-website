"use client"

import { MoonIcon, SunIcon } from "@radix-ui/react-icons"
import { useTheme } from "next-themes"

import { Button } from "@/components/ui/button"

export function ThemeToggle() {
  const { setTheme, theme } = useTheme()

  return (
    <Button
      variant="ghost"
      size="icon"
      className="rounded-full border border-[color:var(--surface-border)] bg-[var(--surface-panel)] text-[var(--text-base)] shadow-[var(--surface-shadow-soft)] hover:bg-[var(--interactive-secondary)] hover:text-[var(--text-strong)]"
      onClick={() => {
        const newTheme =
          theme === "system"
            ? window.matchMedia("(prefers-color-scheme: dark)").matches
              ? "light"
              : "dark"
            : theme === "light"
              ? "dark"
              : "light"
        setTheme(newTheme)
      }}
    >
      <SunIcon className="rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
      <MoonIcon className="absolute rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
      <span className="sr-only">Toggle theme</span>
    </Button>
  )
}
