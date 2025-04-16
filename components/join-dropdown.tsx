"use client"

import { Button } from "@/components/ui/button"

interface JoinDropdownProps {
  onAuthenticate: () => void
}

export function JoinDropdown({ onAuthenticate }: JoinDropdownProps) {
  return (
    <Button
      className="bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-700 hover:to-cyan-700"
      onClick={onAuthenticate}
    >
      Authenticate
    </Button>
  )
}
