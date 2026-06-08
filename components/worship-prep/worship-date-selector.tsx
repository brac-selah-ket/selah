"use client"

import { usePathname, useRouter, useSearchParams } from "next/navigation"

import { DatePicker } from "@/components/ui/date-picker"
import { getDefaultWorshipPrepIsoDate } from "@/lib/worship-prep/default-date"

function normalizeDate(value: string | null, fallback: string): string {
  if (value && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value
  }

  return fallback
}

export function WorshipDateSelector() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const selectedDate = normalizeDate(searchParams.get("date"), getDefaultWorshipPrepIsoDate())

  function handleChange(nextDate: string) {
    const params = new URLSearchParams(searchParams.toString())
    params.set("date", nextDate)
    router.push(`${pathname}?${params.toString()}`)
  }

  return (
    <div className="w-full max-w-xs">
      <DatePicker value={selectedDate} onChange={handleChange} className="h-9" />
    </div>
  )
}
