function formatIsoDate(date: Date): string {
  const yyyy = `${date.getFullYear()}`
  const mm = `${date.getMonth() + 1}`.padStart(2, "0")
  const dd = `${date.getDate()}`.padStart(2, "0")
  return `${yyyy}-${mm}-${dd}`
}

export function getDefaultWorshipPrepIsoDate(baseDate = new Date()): string {
  const date = new Date(baseDate)
  date.setHours(0, 0, 0, 0)

  const day = date.getDay()
  const daysUntilSunday = (7 - day) % 7
  date.setDate(date.getDate() + daysUntilSunday)

  return formatIsoDate(date)
}
