"use client"

import * as React from "react"
import { CalendarIcon } from "lucide-react"
import { InputGroup, InputGroupInput, InputGroupAddon, InputGroupButton } from "@/components/ui/input-group"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"

interface DatePickerProps {
  id?: string
  value?: string
  onChange: (val: string) => void
  placeholder?: string
  className?: string
  disabled?: boolean
}

// Convert a Date object to dd/MM/yyyy string
const formatDateToString = (date: Date): string => {
  const day = String(date.getDate()).padStart(2, "0")
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const year = date.getFullYear()
  return `${day}/${month}/${year}`
}

// Parse a dd/MM/yyyy string to a Date object
const parseStringToDate = (dateStr: string): Date | undefined => {
  if (!dateStr) return undefined
  const parts = dateStr.split("/")
  if (parts.length !== 3) return undefined
  const day = parseInt(parts[0], 10)
  const month = parseInt(parts[1], 10) - 1
  const year = parseInt(parts[2], 10)
  if (isNaN(day) || isNaN(month) || isNaN(year)) return undefined
  const date = new Date(year, month, day)
  if (date.getFullYear() === year && date.getMonth() === month && date.getDate() === day) {
    return date
  }
  return undefined
}

export function DatePicker({
  id,
  value = "",
  onChange,
  placeholder = "DD/MM/YYYY",
  className,
  disabled = false,
}: DatePickerProps) {
  const [isOpen, setIsOpen] = React.useState(false)

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value
    // Keep only numbers and slash
    val = val.replace(/[^0-9/]/g, "")

    const isDeleting = e.nativeEvent && (e.nativeEvent as any).inputType === "deleteContentBackward"
    if (!isDeleting) {
      if (val.length === 2 && !val.includes("/")) {
        val = val + "/"
      } else if (val.length === 5 && val.split("/").length === 2) {
        val = val + "/"
      }
    }

    if (val.length > 10) {
      val = val.substring(0, 10)
    }

    onChange(val)
  }

  const handleCalendarSelect = (date: Date | undefined) => {
    if (date) {
      onChange(formatDateToString(date))
      setIsOpen(false)
    }
  }

  const selectedDate = React.useMemo(() => parseStringToDate(value), [value])

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <InputGroup className={cn("w-full bg-background", className)}>
        <InputGroupInput
          id={id}
          value={value}
          onChange={handleInputChange}
          placeholder={placeholder}
          disabled={disabled}
        />
        <InputGroupAddon align="inline-end">
          <PopoverTrigger asChild>
            <InputGroupButton
              size="icon-xs"
              variant="ghost"
              disabled={disabled}
              className="text-muted-foreground hover:text-foreground"
            >
              <CalendarIcon className="h-4 w-4" />
            </InputGroupButton>
          </PopoverTrigger>
        </InputGroupAddon>
      </InputGroup>
      <PopoverContent className="w-auto p-0" align="end">
        <Calendar
          mode="single"
          selected={selectedDate}
          onSelect={handleCalendarSelect}
          initialFocus
        />
      </PopoverContent>
    </Popover>
  )
}
