"use client"

import type { ReactNode } from "react"
import { getYouTubeReferenceLabel, normalizeYouTubeReference } from "@/lib/utils/youtube"

interface YouTubeReferenceLinkProps {
  reference: string | null | undefined
  title?: string | null
  className?: string
  stopPropagation?: boolean
  fallback?: ReactNode
}

export function YouTubeReferenceLink({
  reference,
  title,
  className,
  stopPropagation = false,
  fallback = null,
}: YouTubeReferenceLinkProps) {
  const normalized = normalizeYouTubeReference(reference)
  const label = getYouTubeReferenceLabel(reference, title)

  if (!normalized || !label) return fallback

  const titleAttribute = title?.trim() ? label : normalized.displayUrl

  return (
    <a
      href={normalized.url}
      target="_blank"
      rel="noopener noreferrer"
      className={className}
      title={titleAttribute}
      onClick={(event) => {
        if (stopPropagation) event.stopPropagation()
      }}
    >
      {label}
    </a>
  )
}
