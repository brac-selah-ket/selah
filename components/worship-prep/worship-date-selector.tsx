"use client"

import { usePathname, useRouter, useSearchParams } from "next/navigation"

import { DatePicker } from "@/components/ui/date-picker"

interface WorshipDateSelectorProps {
  selectedDate: string
}

export function WorshipDateSelector({ selectedDate }: WorshipDateSelectorProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

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
