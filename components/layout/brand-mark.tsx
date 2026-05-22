import { cn } from "@/lib/utils"

interface BrandMarkProps {
  className?: string
  compact?: boolean
}

export function BrandMark({ className, compact = false }: BrandMarkProps) {
  return (
    <span
      className={cn(
        "font-brand leading-none tracking-normal",
        compact ? "text-2xl" : "text-[2rem]",
        className
      )}
    >
      (selah)
    </span>
  )
}
