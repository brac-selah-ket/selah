const koreaDateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Seoul",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
})

function datePart(parts: Intl.DateTimeFormatPart[], type: Intl.DateTimeFormatPartTypes): number {
  const value = parts.find((part) => part.type === type)?.value
  if (!value) {
    throw new Error(`Missing ${type} date part`)
  }
  return Number(value)
}

function getKoreaCalendarDate(baseDate: Date): Date {
  const parts = koreaDateFormatter.formatToParts(baseDate)
  return new Date(Date.UTC(
    datePart(parts, "year"),
    datePart(parts, "month") - 1,
    datePart(parts, "day"),
  ))
}

function formatIsoDate(date: Date): string {
  const yyyy = `${date.getUTCFullYear()}`
  const mm = `${date.getUTCMonth() + 1}`.padStart(2, "0")
  const dd = `${date.getUTCDate()}`.padStart(2, "0")
  return `${yyyy}-${mm}-${dd}`
}

export function getDefaultWorshipPrepIsoDate(baseDate = new Date()): string {
  const date = getKoreaCalendarDate(baseDate)

  const day = date.getUTCDay()
  const daysUntilSunday = (7 - day) % 7
  date.setUTCDate(date.getUTCDate() + daysUntilSunday)

  return formatIsoDate(date)
}
