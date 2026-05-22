"use client"

import { getYouTubeReferenceLabel, normalizeYouTubeReference } from "@/lib/utils/youtube"

interface YouTubeReferenceLinkProps {
  reference: string | null | undefined
  title?: string | null
  className?: string
  stopPropagation?: boolean
}

export function YouTubeReferenceLink({
  reference,
  title,
  className,
  stopPropagation = false,
}: YouTubeReferenceLinkProps) {
  const normalized = normalizeYouTubeReference(reference)
  const label = getYouTubeReferenceLabel(reference, title)

  if (!normalized || !label) return null

  return (
    <a
      href={normalized.url}
      target="_blank"
      rel="noopener noreferrer"
      className={className}
      title={label}
      onClick={(event) => {
        if (stopPropagation) event.stopPropagation()
      }}
    >
      {label}
    </a>
  )
}
