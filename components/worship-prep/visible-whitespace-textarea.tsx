"use client"

import * as React from "react"

import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import { toVisibleWhitespaceText } from "@/lib/utils/visible-whitespace"

interface VisibleWhitespaceTextareaProps
  extends Omit<React.ComponentProps<typeof Textarea>, "value" | "onChange"> {
  value: string
  onChange: (value: string) => void
}

export function VisibleWhitespaceTextarea({
  value,
  onChange,
  className,
  ...props
}: VisibleWhitespaceTextareaProps) {
  const visibleValue = toVisibleWhitespaceText(value)

  return (
    <div className="relative">
      <pre
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute inset-0 min-h-32 overflow-hidden whitespace-pre-wrap break-words rounded-md border border-transparent px-3 py-2 font-mono text-base leading-6 text-muted-foreground",
          "before:text-muted-foreground/60",
        )}
      >
        {visibleValue || " "}
      </pre>
      <Textarea
        {...props}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        spellCheck={false}
        className={cn(
          "relative min-h-32 resize-y bg-transparent font-mono leading-6 text-transparent caret-foreground selection:bg-primary/25 [tab-size:4]",
          className,
        )}
      />
    </div>
  )
}
