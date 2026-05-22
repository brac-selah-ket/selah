"use client"

import type { Conti } from "@/lib/types"
import { ContiCard } from "@/components/contis/conti-card"

export function ContiList({ contis }: { contis: Conti[] }) {
  if (contis.length === 0) {
    return (
      <div className="flex min-h-48 flex-col items-center justify-center rounded-lg border border-dashed bg-card/70 px-6 py-12 text-center">
        <p className="font-serif-kr text-2xl font-semibold text-foreground">
          아직 콘티가 없습니다
        </p>
        <p className="mt-2 text-base text-muted-foreground">
          첫 콘티를 만들고 이번 주 예배 흐름을 정리해보세요.
        </p>
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-lg border bg-card shadow-sm">
      {contis.map((conti) => (
        <ContiCard key={conti.id} conti={conti} />
      ))}
    </div>
  )
}
