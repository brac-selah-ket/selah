"use client"

import * as React from "react"

import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import { VISIBLE_NEWLINE, VISIBLE_SPACE, VISIBLE_TAB } from "@/lib/utils/visible-whitespace"

interface VisibleWhitespaceTextareaProps
  extends Omit<React.ComponentProps<typeof Textarea>, "value" | "onChange"> {
  value: string
  onChange: (value: string) => void
}

function renderVisibleWhitespace(value: string): React.ReactNode {
  if (!value) return " "

  const nodes: React.ReactNode[] = []

  for (let index = 0; index < value.length; index += 1) {
    const character = value[index]

    if (character === "\t") {
      nodes.push(
        <React.Fragment key={`tab-${index}`}>
          <span className="inline-block w-0 overflow-visible text-muted-foreground/70">
            {VISIBLE_TAB}
          </span>
          {"\t"}
        </React.Fragment>,
      )
      continue
    }

    if (character === " ") {
      nodes.push(VISIBLE_SPACE)
      continue
    }

    if (character === "\n") {
      nodes.push(`${VISIBLE_NEWLINE}\n`)
      continue
    }

    nodes.push(character)
  }

  return nodes
}

export function VisibleWhitespaceTextarea({
  value,
  onChange,
  onScroll,
  onKeyDown,
  className,
  ...props
}: VisibleWhitespaceTextareaProps) {
  const overlayRef = React.useRef<HTMLPreElement>(null)
  const textareaRef = React.useRef<HTMLTextAreaElement>(null)
  const pendingSelectionRef = React.useRef<number | null>(null)
  const visibleValue = renderVisibleWhitespace(value)

  React.useLayoutEffect(() => {
    if (pendingSelectionRef.current === null || !textareaRef.current) return

    const selection = pendingSelectionRef.current
    pendingSelectionRef.current = null
    textareaRef.current.setSelectionRange(selection, selection)
  }, [value])

  const handleScroll = (event: React.UIEvent<HTMLTextAreaElement>) => {
    if (overlayRef.current) {
      overlayRef.current.scrollTop = event.currentTarget.scrollTop
      overlayRef.current.scrollLeft = event.currentTarget.scrollLeft
    }

    onScroll?.(event)
  }

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    onKeyDown?.(event)
    if (event.defaultPrevented || event.key !== "Tab") return

    event.preventDefault()

    const target = event.currentTarget
    const { selectionStart, selectionEnd } = target
    const currentValue = target.value
    const nextValue = `${currentValue.slice(0, selectionStart)}\t${currentValue.slice(selectionEnd)}`
    const nextSelection = selectionStart + 1

    pendingSelectionRef.current = nextSelection
    onChange(nextValue)
  }

  return (
    <div className="relative">
      <pre
        ref={overlayRef}
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute inset-0 min-h-32 overflow-hidden whitespace-pre-wrap break-words rounded-md border border-transparent px-3 py-2 font-mono text-base leading-6 text-muted-foreground [tab-size:4]",
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
        onKeyDown={handleKeyDown}
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
