import * as React from "react"
import { type Column } from "@tanstack/react-table"
import { Check, PlusCircle } from "lucide-react"

import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Separator } from "@/components/ui/separator"

interface DataTableFacetedFilterProps<TData, TValue> {
  column?: Column<TData, TValue>
  title?: string
  options: {
    label: string
    value: string
    icon?: React.ComponentType<{ className?: string }>
  }[]
  // Controlled props
  value?: string[]
  onFilter?: (value: string[] | undefined) => void
  simpleSummary?: boolean
  alwaysShowActions?: boolean
}

export function DataTableFacetedFilter<TData, TValue>({
  column,
  title,
  options,
  value: controlledValue,
  onFilter,
  simpleSummary = false,
  alwaysShowActions = false,
}: DataTableFacetedFilterProps<TData, TValue>) {
  const facets = column?.getFacetedUniqueValues()
  // Use controlled value if provided, otherwise fallback to column
  const selectedValues = new Set(
    controlledValue !== undefined 
      ? controlledValue 
      : (column?.getFilterValue() as string[])
  )

  const handleSelect = (optionValue: string) => {
    const newSelectedValues = new Set(selectedValues)
    if (newSelectedValues.has(optionValue)) {
        newSelectedValues.delete(optionValue)
    } else {
        newSelectedValues.add(optionValue)
    }
    
    const filterValues = Array.from(newSelectedValues)
    const newValue = filterValues.length ? filterValues : undefined

    if (onFilter) {
        onFilter(newValue)
    } else {
        column?.setFilterValue(newValue)
    }
  }

  const handleClear = () => {
      if (onFilter) {
          onFilter(undefined)
      } else {
          column?.setFilterValue(undefined)
      }
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 border-dashed">
          <PlusCircle className="mr-2 h-4 w-4" />
          {title}
          {selectedValues?.size > 0 && (
            simpleSummary ? (
              ` • ${selectedValues.size} đã chọn`
            ) : (
              <>
                <Separator orientation="vertical" className="mx-2 h-4" />
                <Badge
                  variant="secondary"
                  className="rounded-sm px-1 font-normal lg:hidden"
                >
                  {selectedValues.size}
                </Badge>
                <div className="hidden gap-1 lg:flex">
                  {selectedValues.size > 2 ? (
                    <Badge
                      variant="secondary"
                      className="rounded-sm px-1 font-normal"
                    >
                      Đã chọn {selectedValues.size}
                    </Badge>
                  ) : (
                    options
                      .filter((option) => selectedValues.has(option.value))
                      .map((option) => (
                        <Badge
                          variant="secondary"
                          key={option.value}
                          className="rounded-sm px-1 font-normal"
                        >
                          {option.label}
                        </Badge>
                      ))
                  )}
                </div>
              </>
            )
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[200px] p-0" align="start">
        <Command>
          <CommandInput placeholder={title} />
          <CommandList>
            <CommandEmpty>Không tìm thấy kết quả.</CommandEmpty>
            <CommandGroup>
              {options.map((option) => {
                const isSelected = selectedValues.has(option.value)
                return (
                  <CommandItem
                    key={option.value}
                    onSelect={() => handleSelect(option.value)}
                  >
                    <div
                      className={cn(
                        "mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary",
                        isSelected
                          ? "bg-primary text-primary-foreground"
                          : "opacity-50 [&_svg]:invisible"
                      )}
                    >
                      <Check className={cn("h-4 w-4")} />
                    </div>
                    {option.icon && (
                      <option.icon className="mr-2 h-4 w-4 text-muted-foreground" />
                    )}
                    <span>{option.label}</span>
                    {facets?.get(option.value) && (
                      <span className="ml-auto flex h-4 w-4 items-center justify-center font-mono text-xs">
                        {facets.get(option.value)}
                      </span>
                    )}
                  </CommandItem>
                )
              })}
            </CommandGroup>
            {(alwaysShowActions || selectedValues.size > 0 || selectedValues.size < options.length) && (
              <>
                <CommandSeparator />
                <CommandGroup>
                  {alwaysShowActions ? (
                    <div className="flex flex-col gap-0.5">
                      <CommandItem
                        onSelect={() => {
                          const allValues = options.map((o) => o.value)
                          if (onFilter) {
                            onFilter(allValues)
                          } else {
                            column?.setFilterValue(allValues)
                          }
                        }}
                        className="justify-center text-center text-sm font-medium"
                      >
                        Chọn tất cả
                      </CommandItem>
                      <CommandItem
                        onSelect={handleClear}
                        className="justify-center text-center text-sm"
                      >
                        Bỏ chọn tất cả
                      </CommandItem>
                    </div>
                  ) : (
                    <>
                      {selectedValues.size < options.length && (
                        <CommandItem
                          onSelect={() => {
                            const allValues = options.map((o) => o.value)
                            if (onFilter) {
                              onFilter(allValues)
                            } else {
                              column?.setFilterValue(allValues)
                            }
                          }}
                          className="justify-center text-center text-sm font-medium"
                        >
                          Chọn tất cả
                        </CommandItem>
                      )}
                      {selectedValues.size > 0 && (
                        <CommandItem
                          onSelect={handleClear}
                          className="justify-center text-center text-sm"
                        >
                          Bỏ chọn tất cả
                        </CommandItem>
                      )}
                    </>
                  )}
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
