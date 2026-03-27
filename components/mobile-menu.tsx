"use client"

import type React from "react"

import { Button } from "@/components/ui/button"
import { X, Menu } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"

interface MobileMenuProps {
  setMobileMenuOpen: React.Dispatch<React.SetStateAction<boolean>>
  mobileMenuOpen?: boolean
  navLinks?: { label: string; href: string }[]
  useCaseLinks?: { label: string; href: string }[]
  resourceLinks?: { label: string; href: string }[]
  showTrigger?: boolean
}

export function MobileMenu({
  setMobileMenuOpen,
  mobileMenuOpen,
  navLinks,
  useCaseLinks,
  resourceLinks,
  showTrigger = true,
}: MobileMenuProps) {
  const pathname = usePathname()

  return (
    <>
      {showTrigger ? (
        <Button
          variant="ghost"
          size="icon"
          className="rounded-full border border-[color:var(--marketing-line)] bg-[rgba(255,248,238,0.72)] text-[var(--marketing-ink)] shadow-sm hover:bg-[rgba(255,248,238,0.92)] lg:hidden dark:bg-[rgba(13,21,21,0.72)] dark:text-[var(--marketing-paper)] dark:hover:bg-[rgba(13,21,21,0.92)]"
          onClick={() => setMobileMenuOpen(true)}
        >
          <Menu className="h-5 w-5" />
        </Button>
      ) : null}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 bg-[var(--marketing-paper)]/95 p-6 backdrop-blur-xl dark:bg-[var(--marketing-ink)]/95">
          <div className="mb-8 flex items-center justify-between">
            <div>
              <p className="text-[0.68rem] font-semibold uppercase tracking-[0.28em] text-[var(--marketing-muted)]">
                Navigate
              </p>
              <h2 className="mt-2 font-display text-3xl">FundLoop</h2>
            </div>
            <Button variant="ghost" size="icon" className="rounded-full" onClick={() => setMobileMenuOpen(false)}>
              <X className="h-6 w-6" />
            </Button>
          </div>
          <div className="flex flex-col gap-8">
            {useCaseLinks?.length ? (
              <div className="space-y-4">
                <p className="text-[0.68rem] font-semibold uppercase tracking-[0.28em] text-[var(--marketing-muted)]">
                  Use Cases
                </p>
                <div className="flex flex-col space-y-3">
                  {useCaseLinks.map(({ href, label }) => (
                    <Link
                      key={href}
                      href={href}
                      onClick={() => setMobileMenuOpen(false)}
                      className={`font-display text-2xl ${
                        pathname === href ? "text-[var(--marketing-accent)]" : "text-[var(--marketing-ink)] dark:text-[var(--marketing-paper)]"
                      }`}
                    >
                      {label}
                    </Link>
                  ))}
                </div>
              </div>
            ) : null}
            {navLinks?.length ? (
              <div className="space-y-4">
                <p className="text-[0.68rem] font-semibold uppercase tracking-[0.28em] text-[var(--marketing-muted)]">
                  Explore
                </p>
                <div className="grid gap-3">
                  {navLinks.map(({ href, label }) => (
                    <Link
                      key={href}
                      href={href}
                      onClick={() => setMobileMenuOpen(false)}
                      className="border-b border-[color:var(--marketing-line)] pb-3 text-lg text-[var(--marketing-muted-strong)]"
                    >
                      {label}
                    </Link>
                  ))}
                </div>
              </div>
            ) : null}
            {resourceLinks?.length ? (
              <div className="space-y-4">
                <p className="text-[0.68rem] font-semibold uppercase tracking-[0.28em] text-[var(--marketing-muted)]">
                  Resources
                </p>
                <div className="grid gap-3">
                  {resourceLinks.map(({ href, label }) => (
                    <Link
                      key={href}
                      href={href}
                      onClick={() => setMobileMenuOpen(false)}
                      className="text-sm uppercase tracking-[0.2em] text-[var(--marketing-muted-strong)]"
                    >
                      {label}
                    </Link>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </>
  )
}
