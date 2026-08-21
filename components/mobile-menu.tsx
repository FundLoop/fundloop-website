"use client"

import type React from "react"

import { Menu, X } from "lucide-react"
import { Link, usePathname } from "@/i18n/navigation"
import { Button } from "@/components/ui/button"

type MobileMenuSection = {
  title: string
  links: { label: string; href: string }[]
}

interface MobileMenuProps {
  setMobileMenuOpen: React.Dispatch<React.SetStateAction<boolean>>
  mobileMenuOpen?: boolean
  title: string
  eyebrow: string
  sections: MobileMenuSection[]
  showTrigger?: boolean
  triggerClassName?: string
}

export function MobileMenu({ setMobileMenuOpen, mobileMenuOpen, title, eyebrow, sections, showTrigger = true, triggerClassName }: MobileMenuProps) {
  const pathname = usePathname()

  return (
    <>
      {showTrigger ? (
        <Button
          variant="ghost"
          size="icon"
          className={
            triggerClassName ??
            "rounded-full border border-[color:var(--marketing-line)] bg-[rgba(255,248,238,0.72)] text-[var(--marketing-ink)] shadow-sm hover:bg-[rgba(255,248,238,0.92)] lg:hidden dark:bg-[rgba(13,21,21,0.72)] dark:hover:bg-[rgba(13,21,21,0.92)]"
          }
          onClick={() => setMobileMenuOpen(true)}
        >
          <Menu className="h-5 w-5" />
        </Button>
      ) : null}
      {mobileMenuOpen ? (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-[var(--marketing-paper)]/95 p-6 backdrop-blur-xl">
          <div className="mb-8 flex items-center justify-between">
            <div>
              <p className="text-[0.68rem] font-semibold uppercase tracking-[0.28em] text-[var(--marketing-muted)]">
                {eyebrow}
              </p>
              <h2 className="mt-2 font-display text-3xl">{title}</h2>
            </div>
            <Button variant="ghost" size="icon" className="rounded-full" onClick={() => setMobileMenuOpen(false)}>
              <X className="h-6 w-6" />
            </Button>
          </div>
          <div className="flex flex-col gap-8">
            {sections.map((section) => (
              <div key={section.title} className="space-y-4">
                <p className="text-[0.68rem] font-semibold uppercase tracking-[0.28em] text-[var(--marketing-muted)]">
                  {section.title}
                </p>
                <div className="grid gap-3">
                  {section.links.map(({ href, label }) => (
                    <Link
                      key={href}
                      href={href}
                      onClick={() => setMobileMenuOpen(false)}
                      className={`border-b border-[color:var(--marketing-line)] pb-3 text-lg ${
                        pathname === href
                          ? "text-[var(--marketing-accent)]"
                          : "text-[var(--marketing-muted-strong)]"
                      }`}
                    >
                      {label}
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </>
  )
}
