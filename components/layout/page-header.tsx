"use client"

import Link from "next/link"
import { HugeiconsIcon } from "@hugeicons/react"
import { ArrowLeft01Icon } from "@hugeicons/core-free-icons"
import { useOptionalDrawerState } from "@/components/ui/drawer-context"
import { cn } from "@/lib/utils"

interface PageHeaderProps {
  title: string
  description?: string
  eyebrow?: string
  backHref?: string
  children?: React.ReactNode
  titleClassName?: string
}

export function PageHeader({
  title,
  description,
  eyebrow,
  backHref,
  children,
  titleClassName,
}: PageHeaderProps) {
  const { isOpen: drawerOpen } = useOptionalDrawerState()

  return (
    <div
      className={cn(
        "mb-6 flex flex-col gap-4",
        drawerOpen ? "sm:flex-col" : "sm:flex-row sm:items-start sm:justify-between"
      )}
    >
      <div className="flex min-w-0 items-start gap-2">
        {backHref && (
          <Link
            href={backHref}
            className="mt-1 text-muted-foreground transition-colors hover:text-foreground"
            aria-label="이전 화면으로 이동"
          >
            <HugeiconsIcon icon={ArrowLeft01Icon} strokeWidth={2} className="size-7" />
          </Link>
        )}
        <div className="min-w-0">
          {eyebrow && (
            <p className="mb-1 text-sm font-semibold text-primary/75">{eyebrow}</p>
          )}
          <h1
            className={cn(
              "font-serif-kr text-3xl font-bold leading-tight tracking-normal text-foreground",
              drawerOpen ? "sm:text-3xl" : "sm:text-4xl",
              titleClassName
            )}
          >
            {title}
          </h1>
          {description && (
            <p className="mt-2 max-w-2xl text-base text-muted-foreground">{description}</p>
          )}
        </div>
      </div>
      {children && (
        <div
          className={cn(
            "flex flex-wrap items-center gap-2",
            drawerOpen ? "min-w-0" : "shrink-0"
          )}
        >
          {children}
        </div>
      )}
    </div>
  )
}
