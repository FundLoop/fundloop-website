"use client"

import * as React from "react"
import { Check, ChevronsUpDown, PlusCircle } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

export interface ComboboxOption {
  value: string
  label: string
}

interface ComboboxProps {
  options: ComboboxOption[]
  value: string
  onChange: (value: string) => void
  onCreateOption?: (value: string) => Promise<void> | void
  placeholder?: string
  emptyMessage?: string
  createMessage?: string
  className?: string
  disabled?: boolean
}

export function Combobox({
  options,
  value,
  onChange,
  onCreateOption,
  placeholder = "Select an option",
  emptyMessage = "No options found",
  createMessage = "Create new option",
  className,
  disabled = false,
}: ComboboxProps) {
  const [open, setOpen] = React.useState(false)
  const [inputValue, setInputValue] = React.useState("")
  const [isCreating, setIsCreating] = React.useState(false)

  const handleCreateOption = async () => {
    if (!inputValue.trim() || !onCreateOption) return

    setIsCreating(true)
    try {
      await onCreateOption(inputValue)
      setInputValue("")
      setOpen(false)
    } catch (error) {
      console.error("Error creating option:", error)
    } finally {
      setIsCreating(false)
    }
  }

  const selectedOption = options.find((option) => option.value === value)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("w-full justify-between", className)}
          disabled={disabled}
        >
          {value && selectedOption ? selectedOption.label : placeholder}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full p-0">
        <Command>
          <CommandInput placeholder={placeholder} value={inputValue} onValueChange={setInputValue} />
          <CommandList>
            <CommandEmpty>
              {emptyMessage}
              {onCreateOption && (
                <Button
                  variant="ghost"
                  className="mt-2 w-full justify-start"
                  onClick={handleCreateOption}
                  disabled={isCreating || !inputValue.trim()}
                >
                  <PlusCircle className="mr-2 h-4 w-4" />
                  {isCreating ? "Creating..." : `${createMessage}: "${inputValue}"`}
                </Button>
              )}
            </CommandEmpty>
            <CommandGroup>
              {options.map((option) => (
                <CommandItem
                  key={option.value}
                  value={option.value}
                  onSelect={() => {
                    onChange(option.value === value ? "" : option.value)
                    setOpen(false)
                  }}
                >
                  <Check className={cn("mr-2 h-4 w-4", value === option.value ? "opacity-100" : "opacity-0")} />
                  {option.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
