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
  onScroll,
  className,
  ...props
}: VisibleWhitespaceTextareaProps) {
  const overlayRef = React.useRef<HTMLPreElement>(null)
  const textareaRef = React.useRef<HTMLTextAreaElement>(null)
  const visibleValue = toVisibleWhitespaceText(value)

  const handleScroll = (event: React.UIEvent<HTMLTextAreaElement>) => {
    if (overlayRef.current) {
      overlayRef.current.scrollTop = event.currentTarget.scrollTop
      overlayRef.current.scrollLeft = event.currentTarget.scrollLeft
    }

    onScroll?.(event)
  }

  return (
    <div className="relative">
      <pre
        ref={overlayRef}
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
        ref={textareaRef}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onScroll={handleScroll}
        spellCheck={false}
        className={cn(
          "relative min-h-32 resize-y bg-transparent font-mono leading-6 text-transparent caret-foreground selection:bg-primary/25 [tab-size:4]",
          className,
        )}
      />
    </div>
  )
}
