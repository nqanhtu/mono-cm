import * as React from "react"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

export interface AutocompleteOption {
  value: string
  label: string
}

interface AutocompleteInputProps extends Omit<React.ComponentProps<"input">, "value" | "onChange"> {
  suggestions: string[] | AutocompleteOption[]
  onValueChange: (val: string) => void
  value?: string
}

export function AutocompleteInput({
  suggestions,
  onValueChange,
  className,
  value,
  ...props
}: AutocompleteInputProps) {
  const [open, setOpen] = React.useState(false)
  const [selectedIndex, setSelectedIndex] = React.useState(-1)
  const containerRef = React.useRef<HTMLDivElement>(null)

  // Normalize suggestions to option object structure
  const normalizedSuggestions = React.useMemo<AutocompleteOption[]>(() => {
    return suggestions.map((item) => {
      if (typeof item === "string") {
        return { value: item, label: item }
      }
      return item
    })
  }, [suggestions])

  // Local input text is the label of the currently selected option, or the typed string
  const [inputValue, setInputValue] = React.useState("")

  React.useEffect(() => {
    const match = normalizedSuggestions.find(o => o.value === value)
    setInputValue(match ? match.label : String(value || ""))
  }, [value, normalizedSuggestions])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setInputValue(val)
    onValueChange(val) // Send raw typed text to parent
    setSelectedIndex(-1)
    setOpen(true)
  }

  const filteredSuggestions = React.useMemo(() => {
    const cleanInput = inputValue.trim().toLowerCase()
    if (!cleanInput) return normalizedSuggestions
    return normalizedSuggestions.filter((item) =>
      item.label.toLowerCase().includes(cleanInput)
    )
  }, [normalizedSuggestions, inputValue])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      if (!open) {
        e.preventDefault()
        setOpen(true)
        return
      }
    }

    if (!open || filteredSuggestions.length === 0) return

    if (e.key === "ArrowDown") {
      e.preventDefault()
      setSelectedIndex((prev) => (prev + 1) % filteredSuggestions.length)
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setSelectedIndex((prev) => (prev - 1 + filteredSuggestions.length) % filteredSuggestions.length)
    } else if (e.key === "Enter") {
      if (selectedIndex >= 0 && selectedIndex < filteredSuggestions.length) {
        e.preventDefault()
        const selectedOption = filteredSuggestions[selectedIndex]
        setInputValue(selectedOption.label)
        onValueChange(selectedOption.value)
        setOpen(false)
      }
    } else if (e.key === "Escape") {
      e.preventDefault()
      e.stopPropagation() // Prevent closing parent dialogs
      setOpen(false)
    }
  }

  return (
    <div className="relative w-full" ref={containerRef} onKeyDown={handleKeyDown}>
      <Input
        {...props}
        value={inputValue}
        onChange={handleInputChange}
        onFocus={() => {
          if (!value) {
            setOpen(true)
          }
        }}
        onBlur={() => setTimeout(() => setOpen(false), 200)}
        className={cn("w-full", className)}
      />
      {open && filteredSuggestions.length > 0 && (
        <div className="absolute top-full left-0 right-0 z-50 mt-1 max-h-48 overflow-y-auto rounded-lg border bg-popover p-1 text-popover-foreground shadow-md outline-none">
          <ul className="flex flex-col gap-0.5">
            {filteredSuggestions.map((item, index) => (
              <li
                key={item.value}
                onMouseDown={(e) => {
                  // Prevent input blur before click registers
                  e.preventDefault()
                }}
                onClick={() => {
                  setInputValue(item.label)
                  onValueChange(item.value)
                  setOpen(false)
                }}
                className={cn(
                  "relative flex cursor-default select-none items-center rounded-md px-3 py-2 text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground cursor-pointer",
                  index === selectedIndex && "bg-accent text-accent-foreground"
                )}
              >
                {item.label}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

