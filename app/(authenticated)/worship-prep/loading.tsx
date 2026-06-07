import { Skeleton } from "@/components/ui/skeleton"

export default function WorshipPrepLoading() {
  return (
    <div data-slot="worship-prep-loading" className="flex flex-col gap-5">
      <div className="flex items-center justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-4 w-64 max-w-[70vw]" />
        </div>
        <Skeleton className="h-9 w-28" />
      </div>

      <div className="space-y-4">
        <Skeleton className="h-10 w-56 max-w-full" />
        <Skeleton className="h-28 rounded-xl" />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-32 rounded-xl" />
        ))}
      </div>
    </div>
  )
}
