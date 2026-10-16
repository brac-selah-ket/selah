"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { HugeiconsIcon } from "@hugeicons/react"
import { DiscordIcon, Loading03Icon } from "@hugeicons/core-free-icons"
import { postContiPraiseThread } from "@/lib/actions/conti-praise-thread"
import { deriveContiPraiseThreadButtonState } from "@/lib/utils/conti-praise-thread"

interface ContiPraiseThreadButtonProps {
  contiId: string
  hasSongs: boolean
  initialThreadUrl: string | null
  initialLastSentAt: string | null
  iconOnly?: boolean
}

const STATUS_MESSAGE: Record<"sent" | "edited" | "skipped", string> = {
  sent: "스레드에 올렸습니다",
  edited: "스레드 메시지를 업데이트했습니다",
  skipped: "이미 최신 상태입니다",
}

function formatLastSentAt(value: string): string {
  return new Date(value).toLocaleString("ko-KR", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

export function ContiPraiseThreadButton({
  contiId,
  hasSongs,
  initialThreadUrl,
  initialLastSentAt,
  iconOnly = false,
}: ContiPraiseThreadButtonProps) {
  const [isPending, startTransition] = useTransition()
  const [threadUrl, setThreadUrl] = useState(initialThreadUrl)
  const [lastSentAt, setLastSentAt] = useState(initialLastSentAt)

  const { disabled, label, disabledReason } = deriveContiPraiseThreadButtonState({
    hasSongs,
    hasThread: Boolean(threadUrl),
    lastSentAt,
    isPending,
  })

  function handleClick() {
    startTransition(async () => {
      const result = await postContiPraiseThread(contiId)
      if (!result.success || !result.data) {
        toast.error(result.error ?? "스레드에 올리는 중 오류가 발생했습니다")
        return
      }

      setThreadUrl(result.data.threadUrl)
      setLastSentAt(result.data.lastSentAt)

      const nextThreadUrl = result.data.threadUrl
      toast.success(STATUS_MESSAGE[result.data.status], {
        action: nextThreadUrl
          ? {
              label: "스레드 열기",
              onClick: () => window.open(nextThreadUrl, "_blank"),
            }
          : undefined,
      })
    })
  }

  return (
    <div className="inline-flex items-center gap-2">
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              variant="outline"
              size={iconOnly ? "icon" : undefined}
              aria-label={label}
              onClick={handleClick}
              disabled={disabled}
            />
          }
        >
          <HugeiconsIcon
            icon={isPending ? Loading03Icon : DiscordIcon}
            strokeWidth={2}
            className={isPending ? "animate-spin" : undefined}
            data-icon={iconOnly ? undefined : "inline-start"}
          />
          {!iconOnly && label}
        </TooltipTrigger>
        {disabledReason && <TooltipContent>{disabledReason}</TooltipContent>}
      </Tooltip>
      {!iconOnly && lastSentAt && (
        <span className="hidden text-xs text-muted-foreground sm:inline">
          {formatLastSentAt(lastSentAt)}
        </span>
      )}
    </div>
  )
}
