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
}

export function MobileMenu({ setMobileMenuOpen, mobileMenuOpen, navLinks }: MobileMenuProps) {
  const pathname = usePathname()

  return (
    <>
      <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setMobileMenuOpen(true)}>
        <Menu className="h-5 w-5" />
      </Button>
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 bg-background p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold">Menu</h2>
            <Button variant="ghost" size="icon" onClick={() => setMobileMenuOpen(false)}>
              <X className="h-6 w-6" />
            </Button>
          </div>
          <div className="flex flex-col space-y-4">
            {navLinks?.map(({ href, label }) => (
              <Link key={href} href={href} onClick={() => setMobileMenuOpen(false)} className="text-md">
                {label}
              </Link>
            ))}
          </div>
        </div>
      )}
    </>
  )
}
