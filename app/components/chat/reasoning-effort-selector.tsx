"use client"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import { Brain, CaretDown } from "@phosphor-icons/react"
import { useState } from "react"

export type ReasoningEffort = "low" | "medium" | "high"

interface ReasoningEffortSelectorProps {
  value: ReasoningEffort
  onChange: (effort: ReasoningEffort) => void
  className?: string
  disabled?: boolean
}

const REASONING_EFFORTS: Array<{
  value: ReasoningEffort
  label: string
  description: string
  icon: string
  color: string
}> = [
  {
    value: "low",
    label: "Low",
    description: "Fast responses, basic reasoning",
    icon: "🚀",
    color: "text-green-500"
  },
  {
    value: "medium", 
    label: "Medium",
    description: "Balanced speed and depth (default)",
    icon: "⚖️",
    color: "text-blue-500"
  },
  {
    value: "high",
    label: "High", 
    description: "Deep analysis, slower responses",
    icon: "🧠",
    color: "text-purple-500"
  }
]

export function ReasoningEffortSelector({
  value,
  onChange,
  className,
  disabled = false
}: ReasoningEffortSelectorProps) {
  const [isOpen, setIsOpen] = useState(false)
  
  const selectedEffort = REASONING_EFFORTS.find(effort => effort.value === value)

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className={cn(
                  "flex items-center gap-2 text-sm font-medium",
                  disabled && "opacity-50 cursor-not-allowed",
                  className
                )}
                disabled={disabled}
              >
                <Brain className="size-4" />
                <span className="hidden sm:inline">
                  {selectedEffort?.label || "Medium"}
                </span>
                <span className="sm:hidden">
                  {selectedEffort?.icon}
                </span>
                <CaretDown className="size-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              {REASONING_EFFORTS.map((effort) => (
                <DropdownMenuItem
                  key={effort.value}
                  onClick={() => {
                    onChange(effort.value)
                    setIsOpen(false)
                  }}
                  className={cn(
                    "flex items-center gap-3 p-3 cursor-pointer",
                    value === effort.value && "bg-secondary"
                  )}
                >
                  <span className="text-lg">{effort.icon}</span>
                  <div className="flex-1">
                    <div className={cn("font-medium", effort.color)}>
                      {effort.label}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {effort.description}
                    </div>
                  </div>
                  {value === effort.value && (
                    <div className="size-2 rounded-full bg-primary" />
                  )}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </TooltipTrigger>
        <TooltipContent>
          <p className="text-sm">
            Reasoning Effort: {selectedEffort?.description}
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}